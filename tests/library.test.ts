import { describe, it, expect } from "vitest";
import { applyBasic } from "../src/core/library";
import { emptyState, parseState } from "../src/core/model";
import { Repository, STATE_KEY, BACKUP_KEY } from "../src/platform/repository";
import { trustedSender } from "../src/core/transport";

describe("local library", () => {
  it("serializes simultaneous saves and enforces exactly five free spaces", async () => {
    const storage: Record<string, unknown> = {};
    const repo = new Repository({ get: async key => structuredClone(storage[key]), set: async values => { Object.assign(storage, structuredClone(values)); } });
    const results = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => repo.update(s => applyBasic(s, "save", { content: `Clip ${i}` }, false))));
    expect(results.filter(x => x.status === "fulfilled")).toHaveLength(5);
    expect((await repo.read()).clips).toHaveLength(5);
  });
  it("keeps stored data unchanged when a write fails", async () => {
    const original = applyBasic(emptyState(), "save", { content: "Keep me" }, false);
    const repo = new Repository({ get: async () => original, set: async () => { throw Error("quota"); } });
    await expect(repo.update(s => applyBasic(s, "delete", { id: original.clips[0]!.id }, false))).rejects.toThrow("quota");
    expect((await repo.read()).clips[0]!.content).toBe("Keep me");
  });
  it("does not overwrite corrupt or future-version state", async () => {
    let writes = 0;
    const repo = new Repository({ get: async key => key === STATE_KEY ? { version: 2 } : undefined, set: async () => { writes++; } });
    await expect(repo.update(s => s)).rejects.toThrow("unsupported version");
    expect(writes).toBe(0);
  });
  it("preserves Unicode and whitespace; rejects oversized content and duplicates", () => {
    const s = applyBasic(emptyState(), "save", { content: "  hello\nこんにちは  " }, false);
    expect(s.clips[0]!.content).toBe("  hello\nこんにちは  ");
    expect(() => applyBasic(s, "save", { content: s.clips[0]!.content }, false)).toThrow("already");
    expect(() => applyBasic(s, "save", { content: "界".repeat(6000) }, false)).toThrow("16 KB");
  });
  it("rejects forged Pro fields and malformed persistent references", () => {
    expect(() => applyBasic(emptyState(), "save", { content: "text", title: "Pro title" }, false)).toThrow("Pro");
    const state = applyBasic(emptyState(), "save", { content: "text" }, false);
    state.clips[0]!.collectionId = "missing-collection";
    expect(() => parseState(state)).toThrow("missing collection");
  });
  it("accepts only owned extension UI message senders", () => {
    const ext = "a".repeat(32);
    expect(trustedSender({ id: ext, url: `chrome-extension://${ext}/popup.html` }, ext)).toBe(true);
    expect(trustedSender({ id: ext, url: "https://example.com" }, ext)).toBe(false);
    expect(trustedSender({ id: ext, url: `chrome-extension://${ext}/library.html`, tab: {} as chrome.tabs.Tab }, ext)).toBe(true);
    expect(trustedSender({ id: ext, url: `chrome-extension://${ext}/unknown.html`, tab: {} as chrome.tabs.Tab }, ext)).toBe(false);
  });
  it("erases the recovery snapshot when the user explicitly clears the library", async () => {
    const storage: Record<string, unknown> = {};
    const repo = new Repository({ get: async key => storage[key], set: async value => { Object.assign(storage, value); } });
    await repo.update(s => applyBasic(s, "save", { content: "Remove permanently" }, false));
    await repo.update(s => applyBasic(s, "clear", { confirm: "DELETE" }, false), false);
    expect((await repo.read()).clips).toEqual([]);
    expect(storage[BACKUP_KEY]).toEqual(emptyState());
  });
});
