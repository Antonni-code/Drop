import { config, checkoutConfigured, paymentsConfigured } from "./config";
import { applyBasic } from "./core/library";
import { applyOrganization, exportLibrary } from "./core/organization";
import { DropError, getClip, requirePro, type Snapshot } from "./core/model";
import { parseCommand, trustedSender } from "./core/transport";
import { Repository, STATE_KEY, BACKUP_KEY, type StorageAdapter } from "./platform/repository";
import { LicenseService } from "./platform/license";
import { pasteIntoFocusedField } from "./platform/paste";

const storage: StorageAdapter = { get: async key => (await chrome.storage.local.get(key))[key], set: values => chrome.storage.local.set(values) };
const repository = new Repository(storage);
const license = new LicenseService(storage, chrome.runtime.id);
const ready = chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
async function snapshot(): Promise<Snapshot> {
  const state = await repository.read(), status = await license.status();
  return { state, pro: status.pro, licenseStatus: status.label, canActivate: paymentsConfigured(), canCheckout: checkoutConfigured() };
}
async function command(input: unknown): Promise<unknown> {
  await ready;
  const { action, data } = parseCommand(input);
  if (action === "snapshot") { void license.refresh().catch(() => undefined); return snapshot(); }
  if (action === "notice") { const value = await chrome.storage.session.get(["notice", "quickPaste"]); await chrome.storage.session.remove(["notice", "quickPaste"]); await chrome.action.setBadgeText({ text: "" }); return value; }
  if (action === "library") { await chrome.runtime.openOptionsPage(); return null; }
  if (action === "checkout") { if (!checkoutConfigured()) throw new DropError("setup", "Checkout is not available in this preview."); await chrome.tabs.create({ url: config.checkoutUrl }); return null; }
  if (action === "license.activate") await license.activate(data.key);
  else if (action === "license.refresh") await license.refresh(true);
  else if (action === "license.deactivate") await license.deactivate();
  else if (action === "license.reset") await license.resetPending(data.confirm);
  else if (action === "recovery") return JSON.stringify({ app: "drop-recovery", savedAt: new Date().toISOString(), ...(await chrome.storage.local.get([STATE_KEY, BACKUP_KEY])) }, null, 2);
  else if (action === "export") { requirePro((await license.status()).pro); return exportLibrary(await repository.read()); }
  else if (action === "paste") {
    requirePro((await license.status()).pro);
    const clip = getClip(await repository.read(), data.id);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new DropError("paste", "Open a website and focus a text field first.");
    try {
      const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pasteIntoFocusedField, args: [clip.content] });
      if (!result?.result?.ok) throw new DropError("paste", result?.result?.reason ?? "This page does not support Quick Paste. Copy and paste the clip manually.");
    } catch (error) { if (error instanceof DropError) throw error; throw new DropError("paste", "Quick Paste cannot access this page. Copy the clip and paste it manually."); }
    await repository.update(state => applyBasic(state, "used", { id: clip.id }, true));
  } else {
    await repository.update(async state => {
      const pro = (await license.status()).pro;
      return ["pin", "move", "collection.save", "collection.delete", "import"].includes(action) ? applyOrganization(state, action, data, pro) : applyBasic(state, action, data, pro);
    }, action !== "clear");
  }
  return snapshot();
}
chrome.runtime.onMessage.addListener((input, sender, respond) => {
  if (!trustedSender(sender, chrome.runtime.id)) { respond({ ok: false, error: { code: "sender", message: "This request is not allowed." } }); return false; }
  command(input).then(data => respond({ ok: true, data })).catch(error => respond({ ok: false, error: error instanceof DropError ? { code: error.code, message: error.message } : { code: "storage", message: "Drop could not finish that action. Your saved library has been kept. Try again or export recovery data in Settings." } }));
  return true;
});
chrome.runtime.onInstalled.addListener(() => { void (async () => {
  await ready; await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: "save-drop", title: "Save to Drop", contexts: ["selection", "link"] });
  await chrome.alarms.create("license-refresh", { periodInMinutes: 360 });
})().catch(() => undefined); });
chrome.runtime.onStartup.addListener(() => { void chrome.alarms.create("license-refresh", { periodInMinutes: 360 }); void license.refresh().catch(() => undefined); });
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === "license-refresh") void license.refresh().catch(() => undefined); });
chrome.contextMenus.onClicked.addListener(info => { if (info.menuItemId !== "save-drop") return; void (async () => {
  try { await command({ action: "save", data: { content: info.selectionText || info.linkUrl } }); await chrome.storage.session.set({ notice: "Saved to your shelf." }); await chrome.action.setBadgeBackgroundColor({ color: "#2d5be3" }); await chrome.action.setBadgeText({ text: "+1" }); }
  catch (error) { await chrome.storage.session.set({ notice: error instanceof DropError ? error.message : "Could not save this clip." }); await chrome.action.setBadgeBackgroundColor({ color: "#9b3e36" }); await chrome.action.setBadgeText({ text: "!" }); }
})().catch(() => undefined); });
chrome.commands.onCommand.addListener(commandName => { if (commandName === "quick-paste") void (async () => { await chrome.storage.session.set({ quickPaste: true }); await chrome.action.openPopup(); })().catch(() => undefined); });
