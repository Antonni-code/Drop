/** Serialized by chrome.scripting: intentionally self-contained, with no outer references. */
export function pasteIntoFocusedField(text: string): { ok: boolean; reason?: string } {
  let target = document.activeElement;
  while (target?.shadowRoot?.activeElement) target = target.shadowRoot.activeElement;
  const refusal = { ok: false, reason: "Click a text field first, then try Quick Paste. You can also copy this clip and paste it yourself." };
  if (!(target instanceof HTMLElement) || target.closest('[inert], [aria-disabled="true"]')) return refusal;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const input = target;
    if (input.disabled || input.readOnly || (input instanceof HTMLInputElement && !["text", "search", "email", "url", "tel"].includes(input.type))) return refusal;
    if (/password|one-time-code|cc-|webauthn/i.test(input.autocomplete)) return { ok: false, reason: "Quick Paste is disabled in password, payment and verification fields. Use your password manager or paste manually." };
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const value = input.value.slice(0, start) + text + input.value.slice(end);
    if (input.maxLength >= 0 && value.length > input.maxLength) return { ok: false, reason: "This clip is too long for the selected field." };
    const event = new InputEvent("beforeinput", { bubbles: true, composed: true, cancelable: true, inputType: "insertText", data: text });
    if (!input.dispatchEvent(event)) return { ok: false, reason: "This editor declined Quick Paste. Copy the clip and paste it manually." };
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
    try { input.setSelectionRange(start + text.length, start + text.length); } catch { /* email fields lack selection APIs */ }
    input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: text }));
    return { ok: true };
  }
  if (target.isContentEditable) {
    if (target.closest('[role="combobox"], [data-slate-editor], .ProseMirror, .monaco-editor, .cm-editor, [aria-readonly="true"]')) return { ok: false, reason: "Use normal copy and paste in this rich editor." };
    const selection = document.getSelection();
    if (!selection?.rangeCount || !target.contains(selection.anchorNode) || !target.contains(selection.focusNode)) return refusal;
    if (!target.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, composed: true, cancelable: true, inputType: "insertText", data: text }))) return refusal;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node); range.setStartAfter(node); range.collapse(true);
    selection.removeAllRanges(); selection.addRange(range);
    target.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: text }));
    return { ok: true };
  }
  return refusal;
}
