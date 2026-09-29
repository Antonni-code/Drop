import { config, WEBSITE } from "../config";
import { COLORS, ICONS, DropError, MAX_STATE_BYTES, titleOf, type Clip, type Collection, type Snapshot } from "../core/model";
import { send } from "../core/transport";
import { icon } from "./icons";

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const esc = (value: string): string => value.replace(/[&<>"']/g, x => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[x]!);
const dialog = $<HTMLDialogElement>("#dialog"), list = $("#list");
let current: Snapshot | null = null, activeCollection = "all", favorite = false, mode = "copy", limit = 60;
let sort = "recent", kindFilter = "all", draft = "", toastTimer: ReturnType<typeof setTimeout> | undefined;
const colorValues = { blue: "#9fbaf0", violet: "#c5b0df", amber: "#e5c17d", green: "#a5bc88", rose: "#dca7b0", slate: "#aebac3" };
if (location.pathname.endsWith("library.html")) document.body.classList.add("expanded");
function notify(message: string, undo?: () => Promise<void>): void {
  const toast = $("#toast"), button = toast.querySelector("button")!;
  toast.querySelector("span")!.textContent = message; toast.hidden = false;
  button.hidden = !undo; button.onclick = undo ? () => { void run(undo); toast.hidden = true; } : null;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, undo ? 9000 : 5000);
}
async function run(task: () => Promise<void>, button?: HTMLButtonElement): Promise<void> {
  if (button?.disabled) return;
  if (button) button.disabled = true;
  try { await task(); } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong. Try again."); }
  finally { if (button?.isConnected) button.disabled = false; }
}
function accept(value: Snapshot): void {
  if (!current || value.state.revision >= current.state.revision) current = value;
  render();
}
async function act(action: string, data: Record<string, unknown> = {}): Promise<void> { accept(await send<Snapshot>(action, data)); }
function isPro(): boolean { if (current?.pro) return true; proSheet(); return false; }
function show(title: string, body: string): void {
  if (dialog.open) dialog.close();
  $("#dialog-content").innerHTML = `<header class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2><button class="close" aria-label="Close dialog">×</button></header>${body}`;
  dialog.querySelector<HTMLButtonElement>(".close")!.onclick = () => dialog.close();
  dialog.showModal();
}
function render(): void {
  if (!current) return;
  const { state, pro } = current;
  $("#pro").innerHTML = pro ? `Pro ${icon("check")}` : 'Get Pro <span aria-hidden="true">↗</span>';
  $("#usage").textContent = pro ? `${state.clips.length} ${state.clips.length === 1 ? "clip" : "clips"} · Pro` : `${state.clips.length} of 5 spaces used`;
  const search = $<HTMLInputElement>("#search").value.trim().toLocaleLowerCase();
  if (!pro && mode !== "copy") { mode = "copy"; $("#copy-mode").classList.add("selected"); $("#copy-mode").setAttribute("aria-pressed", "true"); $("#paste-mode").classList.remove("selected"); $("#paste-mode").setAttribute("aria-pressed", "false"); }
  if (!pro) { activeCollection = "all"; favorite = false; kindFilter = "all"; sort = "recent"; $("#filters").hidden = true; }
  if (activeCollection !== "all" && !state.collections.some(c => c.id === activeCollection)) activeCollection = "all";
  const collections = $("#collections"); collections.hidden = !pro;
  if (pro) collections.innerHTML = `<button class="collection-chip ${activeCollection === "all" && !favorite ? "active" : ""}" data-collection="all">All clips</button><button class="collection-chip ${favorite ? "active" : ""}" data-favorites="true">${icon("star")} Favorites</button>${state.collections.map(c => `<button class="collection-chip ${activeCollection === c.id ? "active" : ""}" data-collection="${c.id}" style="border-left:3px solid ${colorValues[c.color]}">${icon(c.icon)} ${esc(c.name)}</button>`).join("")}<button class="collection-chip" data-new-collection="true" aria-label="New collection">+</button>${activeCollection !== "all" ? '<button class="collection-chip" data-edit-collection="true" aria-label="Edit collection">Edit</button>' : ""}`;
  let clips = state.clips.filter(c => (!search || `${titleOf(c)} ${c.content}`.toLocaleLowerCase().includes(search)) && (activeCollection === "all" || c.collectionId === activeCollection) && (!favorite || c.pinned) && (kindFilter === "all" || c.kind === kindFilter));
  if (sort !== "manual") clips = [...clips].sort((a, b) => sort === "newest" ? b.createdAt - a.createdAt : (b.usedAt || b.createdAt) - (a.usedAt || a.createdAt));
  list.setAttribute("aria-busy", "false");
  if (!clips.length) {
    list.innerHTML = `<div class="empty"><div class="empty-symbol">${icon(search ? "text" : "copy")}</div><strong>${state.clips.length ? "Nothing here just yet." : "Good things, within reach."}</strong><p>${state.clips.length ? "Try another search or collection." : "A link. A useful line. Your go-to reply.<br>Save a little. Reach for it often."}</p>${!state.clips.length ? '<button class="text-button" data-add="true">Save your first clip →</button>' : ""}</div>`;
    return;
  }
  list.innerHTML = clips.slice(0, limit).map(c => {
    const collection = state.collections.find(item => item.id === c.collectionId);
    const preview = c.title ? c.content : c.kind === "link" ? "Link · ready when you are" : c.content.includes("\n") ? c.content.split("\n").slice(1).join(" ").trim() : `${c.kind === "code" ? "Code" : "Text"} · ${c.content.length} characters`;
    return `<article class="clip-row" data-id="${c.id}"><button class="clip-main" data-copy="${c.id}" aria-label="${mode === "copy" ? "Copy" : "Paste"} ${esc(titleOf(c))}"><span class="type-mark ${c.kind}">${icon(c.kind)}</span><span class="clip-text"><span class="clip-title">${esc(titleOf(c))}</span><span class="clip-preview">${esc(preview)}</span>${pro && collection ? `<span class="clip-meta">${icon(collection.icon)}${esc(collection.name)}</span>` : ""}</span></button><div class="clip-actions">${pro ? `<button data-pin="${c.id}" class="${c.pinned ? "pinned" : ""}" aria-label="${c.pinned ? "Unfavorite" : "Favorite"} ${esc(titleOf(c))}" aria-pressed="${c.pinned}">${icon("star")}</button>` : ""}<button data-edit="${c.id}" aria-label="Edit ${esc(titleOf(c))}">${icon("edit")}</button></div></article>`;
  }).join("") + (clips.length > limit ? '<button class="load-more" data-more="true">Show more clips</button>' : "");
}
function editor(clip?: Clip): void {
  if (!current) return;
  const pro = current.pro;
  show(clip ? "Edit your clip" : "A new little thing", `<form id="clip-form"><label class="field">Your clip<textarea id="clip-content" required maxlength="16384" placeholder="Paste text, a link, or a useful bit of code…">${esc(clip?.content ?? draft)}</textarea></label><div class="two-fields"><label class="field">Type<select id="clip-kind"><option value="auto">Detect automatically</option><option value="text">Text</option><option value="link">Link</option><option value="code">Code</option></select></label>${pro ? `<label class="field">Collection<select id="clip-collection"><option value="">No collection</option>${current.state.collections.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></label>` : ""}</div>${pro ? `<label class="field">A name, if you like<input id="clip-title" maxlength="80" value="${esc(clip?.title ?? "")}" placeholder="e.g. My intro"></label>` : '<p class="helper">Make it yours with names and collections in <button type="button" class="text-button" id="editor-pro">Drop Pro ↗</button></p>'}<p class="form-error" role="alert" id="form-error"></p><div class="dialog-actions">${clip ? `<button type="button" class="danger" id="delete-clip">Delete</button>${pro && sort === "manual" ? '<button type="button" class="secondary" id="move-up">Move up</button>' : ""}` : '<span class="helper">16 KB per clip</span>'}<button class="primary" type="submit">${clip ? "Save changes" : "Save clip"}</button></div></form>`);
  const content = $<HTMLTextAreaElement>("#clip-content"); content.focus();
  if (clip) $<HTMLSelectElement>("#clip-kind").value = clip.kind;
  if (pro) $<HTMLSelectElement>("#clip-collection").value = clip?.collectionId ?? (activeCollection === "all" ? "" : activeCollection);
  content.oninput = () => { if (!clip) draft = content.value; };
  dialog.querySelector<HTMLButtonElement>("#editor-pro")?.addEventListener("click", () => { draft = content.value; proSheet(); });
  const submit = async () => {
    const button = dialog.querySelector<HTMLButtonElement>('[type="submit"]')!;
    if (button.disabled) return; button.disabled = true;
    try {
      const data: Record<string, unknown> = { content: content.value };
      const kind = $<HTMLSelectElement>("#clip-kind").value; if (kind !== "auto") data.kind = kind;
      if (clip) data.id = clip.id;
      if (pro) { data.title = $<HTMLInputElement>("#clip-title").value; data.collectionId = $<HTMLSelectElement>("#clip-collection").value || null; }
      await act(clip ? "edit" : "save", data); if (!clip) draft = ""; dialog.close(); notify(clip ? "Changes saved." : "Saved to your shelf.");
    } catch (error) { $("#form-error").textContent = error instanceof Error ? error.message : "Could not save this clip."; }
    finally { button.disabled = false; }
  };
  $("#clip-form").onsubmit = event => { event.preventDefault(); void submit(); };
  content.onkeydown = event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void submit(); } };
  dialog.querySelector<HTMLButtonElement>("#delete-clip")?.addEventListener("click", event => void run(async () => {
    await act("delete", { id: clip!.id }); dialog.close(); notify("Clip removed.", async () => { await act("restore", { clip }); notify("Clip restored."); });
  }, event.currentTarget as HTMLButtonElement));
  dialog.querySelector<HTMLButtonElement>("#move-up")?.addEventListener("click", event => void run(async () => {
    const index = current!.state.clips.findIndex(c => c.id === clip!.id);
    if (index > 0) await act("move", { id: clip!.id, beforeId: current!.state.clips[index - 1]!.id });
    dialog.close(); notify(index > 0 ? "Moved up one space." : "Already at the top.");
  }, event.currentTarget as HTMLButtonElement));
}
function collectionEditor(collection?: Collection): void {
  if (!isPro()) return;
  let color: typeof COLORS[number] = collection?.color ?? "blue", glyph: typeof ICONS[number] = collection?.icon ?? "folder";
  show(collection ? "Your collection" : "Make some space", `<form id="collection-form"><label class="field">Collection name<input id="collection-name" maxlength="36" required value="${esc(collection?.name ?? "")}" placeholder="e.g. Work, Words, Side project"></label><span class="helper">Color</span><div class="swatches" role="group" aria-label="Collection color">${COLORS.map(c => `<button type="button" class="swatch ${c === color ? "selected" : ""}" data-color="${c}" style="--swatch:${colorValues[c]}" aria-label="${c}" aria-pressed="${c === color}"></button>`).join("")}</div><p class="helper">Icon</p><div class="icon-options" role="group" aria-label="Collection icon">${ICONS.map(i => `<button type="button" class="${i === glyph ? "selected" : ""}" data-icon="${i}" aria-label="${i}" aria-pressed="${i === glyph}">${icon(i)}</button>`).join("")}</div><p class="form-error" id="form-error" role="alert"></p><div class="dialog-actions">${collection ? '<button type="button" class="danger" id="delete-collection">Delete collection</button>' : ""}<button class="primary" type="submit">${collection ? "Save changes" : "Create collection"}</button></div></form>`);
  dialog.querySelectorAll<HTMLButtonElement>("[data-color]").forEach(b => b.onclick = () => { color = b.dataset.color as typeof color; dialog.querySelectorAll<HTMLButtonElement>("[data-color]").forEach(x => { x.classList.toggle("selected", x === b); x.setAttribute("aria-pressed", String(x === b)); }); });
  dialog.querySelectorAll<HTMLButtonElement>("[data-icon]").forEach(b => b.onclick = () => { glyph = b.dataset.icon as typeof glyph; dialog.querySelectorAll<HTMLButtonElement>("[data-icon]").forEach(x => { x.classList.toggle("selected", x === b); x.setAttribute("aria-pressed", String(x === b)); }); });
  $("#collection-form").onsubmit = event => { event.preventDefault(); const b = dialog.querySelector<HTMLButtonElement>('[type="submit"]')!; if (b.disabled) return; b.disabled = true; void (async () => {
    try { await act("collection.save", { ...(collection ? { id: collection.id } : {}), name: $<HTMLInputElement>("#collection-name").value, color, icon: glyph }); dialog.close(); notify("Collection saved."); }
    catch (error) { $("#form-error").textContent = error instanceof Error ? error.message : "Could not save this collection."; } finally { b.disabled = false; }
  })(); };
  dialog.querySelector<HTMLButtonElement>("#delete-collection")?.addEventListener("click", () => {
    show("Delete this collection?", '<p class="helper">Your clips will stay on the shelf, without this collection.</p><button id="confirm-delete-collection" class="danger full">Delete collection, keep clips</button>');
    $("#confirm-delete-collection").onclick = event => void run(async () => { await act("collection.delete", { id: collection!.id }); dialog.close(); notify("Collection removed. Your clips are safe."); }, event.currentTarget as HTMLButtonElement);
  });
  $("#collection-name").focus();
}
function proSheet(): void {
  show(current?.pro ? "Your Drop Pro" : "A little more room.", `<div class="pro-mark"><img src="mark.svg" alt=""><span>DROP PRO</span></div><h3 class="pro-heading">Keep your good<br>things together.</h3><p class="pro-lead">For the replies, links, and little bits of code<br>that make every day a little easier.</p><div class="pro-features">${["More room for clips", "Your own collections", "Favorites & names", "Colors & icons", "Import & export", "Quick Paste"].map(t => `<div>${icon("check")}${t}</div>`).join("")}</div><div class="price">${esc(config.price)}<small>once. yours to keep.</small></div><p class="price-note">Proposed launch price · No subscription.<br>Device safeguards: 5,000 clips, 4 MB total, 16 KB per clip.</p>${current?.pro ? `<p class="helper">${esc(current.licenseStatus)}. Thanks for giving your shelf more room.</p><button id="refresh-license" class="secondary full">Refresh license</button>` : `<button id="checkout" class="primary full" ${current?.canCheckout ? "" : "disabled"}>${current?.canCheckout ? "Get Drop Pro ↗" : "Checkout opens at launch"}</button><p class="price-note">${current?.canCheckout ? "Secure checkout with Creem. Taxes and device allowance are shown before payment." : "This is a development preview. No payment is taken."}</p>`}<details class="activation"><summary>${current?.pro ? "Manage your license" : "Already have a license?"}</summary><form id="license-form"><label class="field">License key<input id="license-input" type="password" autocomplete="off" maxlength="200" placeholder="Paste your Creem license key" ${current?.canActivate ? "" : "disabled"}></label><p class="form-error" id="license-error" role="alert"></p><button class="secondary full" type="submit" ${current?.canActivate ? "" : "disabled"}>Activate on this device</button></form>${current?.canActivate ? '<button class="text-button" id="deactivate">Release this device</button><button class="text-button" id="reset-pending">Reset after support</button>' : '<p class="helper">Activation is not configured in this preview.</p>'}</details><p class="helper">Need a hand? <a href="mailto:delosreyesjudeantonni@gmail.com">Contact support</a>.</p>`);
  dialog.querySelector<HTMLButtonElement>("#checkout")?.addEventListener("click", event => void run(async () => { await send("checkout"); }, event.currentTarget as HTMLButtonElement));
  dialog.querySelector<HTMLButtonElement>("#refresh-license")?.addEventListener("click", event => void run(async () => { await act("license.refresh"); proSheet(); notify("License refreshed."); }, event.currentTarget as HTMLButtonElement));
  $("#license-form").onsubmit = event => { event.preventDefault(); const b = dialog.querySelector<HTMLButtonElement>('#license-form [type="submit"]')!; if (b.disabled) return; b.disabled = true; void (async () => {
    try { await act("license.activate", { key: $<HTMLInputElement>("#license-input").value }); proSheet(); notify("Welcome to Drop Pro."); }
    catch (error) { $("#license-error").textContent = error instanceof Error ? error.message : "Could not activate your license."; } finally { b.disabled = false; }
  })(); };
  dialog.querySelector<HTMLButtonElement>("#deactivate")?.addEventListener("click", () => {
    show("Release this device?", '<p class="helper">Pro tools will pause on this browser. Every saved clip remains available to read and copy. You can activate your key again later.</p><button class="secondary full" id="confirm-release">Release device</button>');
    $("#confirm-release").onclick = event => void run(async () => { await act("license.deactivate"); dialog.close(); notify("Device released. Your clips are still here."); }, event.currentTarget as HTMLButtonElement);
  });
  dialog.querySelector<HTMLButtonElement>("#reset-pending")?.addEventListener("click", () => {
    show("After support helps", '<p class="helper">Only do this after support confirms that the unconfirmed activation has been released in Creem. It does not release a device by itself.</p><label class="field">Type RELEASED<input id="release-confirm" autocomplete="off"></label><button id="confirm-reset" class="secondary full">Reset unconfirmed activation</button>');
    $("#confirm-reset").onclick = event => void run(async () => { await act("license.reset", { confirm: $<HTMLInputElement>("#release-confirm").value }); dialog.close(); notify("You can activate your key again."); }, event.currentTarget as HTMLButtonElement);
  });
}
function download(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function settings(): void {
  show("Your little shelf", `<p class="helper">${esc(current?.licenseStatus ?? "Library unavailable")} · Drop 0.1.0<br>Clips stay in this browser profile. No account. No automatic clipboard recording.</p><div class="settings-row"><span>Room to focus<small>Open the full library in a tab.</small></span><button id="open-library">Open ↗</button></div><div class="settings-row"><span>JSON backup<small>Import and export your shelf with Pro.</small></span><div><button id="export">Export</button> <button id="import">Import</button></div></div><div class="settings-row"><span>Recovery copy<small>Raw current and previous library. Available on Free.</small></span><button id="recovery">Download</button></div><div class="settings-row"><span>Keyboard shortcuts<small>Open: Alt ⇧ D · Quick Paste: Alt ⇧ V<br>Search: / · New clip: N · Save: ⌘ / Ctrl ↵<br>Change browser shortcuts in chrome://extensions/shortcuts.</small></span></div><div class="settings-row"><span>Start fresh<small>Erase all clips and the recovery snapshot.</small></span><button id="clear">Delete all</button></div><nav class="settings-links"><a href="${WEBSITE}/privacy" target="_blank" rel="noopener noreferrer">Privacy</a><a href="${WEBSITE}/terms" target="_blank" rel="noopener noreferrer">Terms</a><a href="mailto:delosreyesjudeantonni@gmail.com">Support</a><button id="manage-pro" class="text-button">Manage Pro</button></nav>`);
  $("#open-library").onclick = () => void run(async () => { await send("library"); });
  $("#export").onclick = () => { if (isPro()) void run(async () => { download(await send<string>("export"), `drop-backup-${new Date().toISOString().slice(0, 10)}.json`); notify("Backup downloaded. Keep it somewhere private."); }); };
  $("#import").onclick = () => { if (isPro()) $<HTMLInputElement>("#import-file").click(); };
  $("#recovery").onclick = () => void run(async () => { download(await send<string>("recovery"), "drop-recovery.json"); notify("Recovery copy downloaded. It contains your clip text."); });
  $("#manage-pro").onclick = proSheet;
  $("#clear").onclick = () => {
    show("Clear your shelf?", '<p class="helper">This permanently removes every clip, collection, and the previous recovery snapshot from this browser. Export first if you need a copy.</p><label class="field">Type DELETE to confirm<input id="clear-confirm" autocomplete="off"></label><button id="confirm-clear" class="danger full">Delete all clips</button>');
    $("#confirm-clear").onclick = event => void run(async () => { await act("clear", { confirm: $<HTMLInputElement>("#clear-confirm").value }); dialog.close(); notify("Your shelf is clear."); }, event.currentTarget as HTMLButtonElement);
  };
}
$("#new-clip").onclick = () => editor(); $("#settings").onclick = settings; $("#pro").onclick = proSheet;
$<HTMLInputElement>("#search").oninput = () => { limit = 60; render(); };
$("#filters-button").onclick = () => { if (isPro()) $("#filters").hidden = !$("#filters").hidden; };
$<HTMLSelectElement>("#kind-filter").onchange = event => { kindFilter = (event.target as HTMLSelectElement).value; render(); };
$<HTMLSelectElement>("#sort").onchange = event => { sort = (event.target as HTMLSelectElement).value; render(); };
function setMode(next: string): void {
  if (next === "paste" && !isPro()) return;
  if (next === "paste" && document.body.classList.contains("expanded")) { notify("Use Quick Paste from the extension popup over a website."); return; }
  mode = next;
  for (const id of ["copy", "paste"]) { $(`#${id}-mode`).classList.toggle("selected", mode === id); $(`#${id}-mode`).setAttribute("aria-pressed", String(mode === id)); }
  if (next === "paste") notify("Choose a clip to paste into the focused web field."); render();
}
$("#copy-mode").onclick = () => setMode("copy"); $("#paste-mode").onclick = () => setMode("paste");
list.onclick = event => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button"); if (!button || !current) return;
  if (button.dataset.add) return editor();
  if (button.dataset.more) { limit += 60; return render(); }
  const clipId = button.dataset.copy ?? button.dataset.edit ?? button.dataset.pin;
  const clip = current.state.clips.find(c => c.id === clipId); if (!clip) return;
  if (button.dataset.edit) return editor(clip);
  void run(async () => {
    if (button.dataset.pin) { await act("pin", { id: clip.id }); return; }
    if (mode === "paste") { await act("paste", { id: clip.id }); notify("Pasted."); if (!document.body.classList.contains("expanded")) window.close(); }
    else { await navigator.clipboard.writeText(clip.content); notify("Copied. Go make it useful."); try { await act("used", { id: clip.id }); } catch { /* Clipboard succeeded; recency is non-critical. */ } }
  }, button);
};
$("#collections").onclick = event => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button"); if (!button || !current) return;
  if (button.dataset.newCollection) return collectionEditor();
  if (button.dataset.editCollection) return collectionEditor(current.state.collections.find(c => c.id === activeCollection));
  if (button.dataset.favorites) { favorite = !favorite; activeCollection = "all"; }
  if (button.dataset.collection) { activeCollection = button.dataset.collection; favorite = false; }
  limit = 60; render();
};
$<HTMLInputElement>("#import-file").onchange = event => {
  const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = ""; if (!file) return;
  void run(async () => {
    if (file.size > MAX_STATE_BYTES) throw new DropError("size", "Choose a Drop JSON backup smaller than 4 MB.");
    const json = await file.text();
    show("Bring your clips over", `<p class="helper">Import ${esc(file.name)}? Clips are merged into your shelf. Duplicate text is skipped, and existing clips stay unchanged. Invalid backups are rejected in full.</p><button id="confirm-import" class="primary full">Merge backup</button>`);
    $("#confirm-import").onclick = event => void run(async () => { await act("import", { json }); dialog.close(); notify("Your backup is on the shelf."); }, event.currentTarget as HTMLButtonElement);
  });
};
document.addEventListener("keydown", event => {
  if (dialog.open) return;
  const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target as HTMLElement)?.isContentEditable;
  if (!typing && event.key === "/" || ((event.metaKey || event.ctrlKey) && event.key === "k")) { event.preventDefault(); $("#search").focus(); }
  else if (!typing && event.key.toLowerCase() === "n" && !event.metaKey && !event.ctrlKey && !event.altKey) { event.preventDefault(); editor(); }
  else if (event.key === "Escape") { $<HTMLInputElement>("#search").value = ""; $("#search").blur(); render(); }
  else if (!typing && ["ArrowDown", "ArrowUp"].includes(event.key)) {
    const buttons = Array.from(list.querySelectorAll<HTMLButtonElement>(".clip-main"));
    if (!buttons.length) return; event.preventDefault();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  }
});
document.addEventListener("paste", event => {
  if (dialog.open || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  const text = event.clipboardData?.getData("text/plain"); if (text) { event.preventDefault(); draft = text; editor(); }
});
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
chrome.storage.onChanged.addListener((changes, area) => { if (area !== "local" || !("drop.library.v1" in changes || "drop.license.v1" in changes)) return; clearTimeout(refreshTimer); refreshTimer = setTimeout(() => void run(async () => accept(await send<Snapshot>("snapshot"))), 80); });
void (async () => {
  try { accept(await send<Snapshot>("snapshot")); const notice = await send<{ notice?: string; quickPaste?: boolean }>("notice"); if (notice.notice) notify(notice.notice); if (notice.quickPaste) setMode("paste"); }
  catch (error) { list.setAttribute("aria-busy", "false"); list.innerHTML = `<div class="empty"><strong>Your library needs a hand.</strong><p>${esc(error instanceof Error ? error.message : "Could not open your shelf.")}</p><p>Settings has a recovery download. Your stored data has not been reset.</p></div>`; }
})();
