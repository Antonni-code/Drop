import { DropError, object, string } from "./model";
export interface Command { action: string; data: Record<string, unknown> }
export function parseCommand(input: unknown): Command {
  const value = object(input);
  return { action: string(value.action, 40, "Action"), data: value.data === undefined ? {} : object(value.data) };
}
export function trustedSender(sender: chrome.runtime.MessageSender, extensionId: string): boolean {
  if (sender.id !== extensionId || sender.tab) return false;
  try {
    const url = new URL(sender.url ?? "");
    return url.protocol === "chrome-extension:" && url.hostname === extensionId && ["/popup.html", "/library.html"].includes(url.pathname);
  } catch { return false; }
}
export async function send<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  const response = await chrome.runtime.sendMessage({ action, data }) as { ok: boolean; data?: T; error?: { code: string; message: string } } | undefined;
  if (!response) throw new DropError("connection", "Drop is reconnecting. Close and reopen the extension.");
  if (!response.ok) throw new DropError(response.error?.code ?? "error", response.error?.message ?? "Something went wrong. Try again.");
  return response.data as T;
}
