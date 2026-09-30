import { beforeEach, describe, expect, it, vi } from "vitest";
import { BACKUP_KEY, STATE_KEY } from "../src/platform/repository";
import { emptyState } from "../src/core/model";
let stored: Record<string, unknown>;
let listener: (input: unknown, sender: chrome.runtime.MessageSender, respond: (reply: Reply) => void) => boolean;
interface Reply { ok: boolean; data?: { state: { clips: unknown[] }; pro: boolean } | string; error?: { code: string; message: string } }
const ext = "a".repeat(32);
const event = () => ({ addListener: vi.fn() });
beforeEach(async () => {
  vi.resetModules(); stored = {};
  vi.stubGlobal("chrome", {
    runtime: { id: ext, onMessage: { addListener: (fn: typeof listener) => { listener = fn; } }, onInstalled: event(), onStartup: event(), openOptionsPage: async () => undefined },
    storage: { local: { setAccessLevel: async () => undefined, get: async (keys: string | string[]) => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, structuredClone(stored[k])])), set: async (values: Record<string, unknown>) => { Object.assign(stored, structuredClone(values)); } }, session: { get: async () => ({}), remove: async () => undefined } },
    alarms: { onAlarm: event() }, contextMenus: { onClicked: event() }, commands: { onCommand: event() },
  });
  await import("../src/background");
});
function request(action: string, data: Record<string, unknown> = {}, url = `chrome-extension://${ext}/popup.html`): Promise<Reply> {
  return new Promise(resolve => listener({ action, data }, { id: ext, url, ...(url.endsWith("library.html") ? { tab: { id: 1 } as chrome.tabs.Tab } : {}) }, resolve));
}
describe("background command boundary", () => {
  it("rejects foreign senders and supports the owned library tab", async () => {
    expect((await request("save", { content: "Injected" }, "https://evil.example")).ok).toBe(false);
    expect(stored[STATE_KEY]).toBeUndefined();
    expect((await request("save", { content: "My clip" }, `chrome-extension://${ext}/library.html`)).ok).toBe(true);
    const reply = await request("snapshot"); expect(reply.ok).toBe(true); expect(JSON.stringify(reply)).not.toContain("deviceId");
  });
  it("serializes real popup commands and refuses forged Pro fields", async () => {
    const replies = await Promise.all(Array.from({ length: 9 }, (_, i) => request("save", { content: `Clip ${i}` })));
    expect(replies.filter(r => r.ok)).toHaveLength(5);
    expect((stored[STATE_KEY] as { clips: unknown[] }).clips).toHaveLength(5);
    expect((await request("pin", { id: "fake-clip-id" })).error?.code).toBe("pro");
    expect((await request("clear", { confirm: "wrong" })).ok).toBe(false);
    expect((stored[STATE_KEY] as { clips: unknown[] }).clips).toHaveLength(5);
    expect((await request("clear", { confirm: "DELETE" })).ok).toBe(true);
    expect(stored[BACKUP_KEY]).toEqual(emptyState());
    expect((stored[STATE_KEY] as { clips: unknown[] }).clips).toHaveLength(0);
  });
  it("does not reset unreadable data and keeps recovery available", async () => {
    stored[STATE_KEY] = { version: 42, clips: ["Keep this"] };
    const before = structuredClone(stored[STATE_KEY]);
    expect((await request("snapshot")).ok).toBe(false);
    expect((await request("save", { content: "Another" })).ok).toBe(false);
    expect(stored[STATE_KEY]).toEqual(before);
    const recovery = await request("recovery"); expect(recovery.ok).toBe(true); expect(recovery.data).toContain("Keep this");
  });
});
