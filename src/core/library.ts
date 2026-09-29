import { canAdd, content, DropError, getClip, id, inferKind, kind, parseClip, parseState, requirePro, string, type State } from "./model";

export function applyBasic(state: State, action: string, data: Record<string, unknown>, pro: boolean, now = Date.now()): State {
  const next = structuredClone(state);
  if (action === "save") {
    const text = content(data.content);
    if (next.clips.some(clip => clip.content === text)) throw new DropError("duplicate", "That clip is already on your shelf.");
    canAdd(next, pro);
    const title = data.title === undefined ? "" : string(data.title, 80, "Title", true);
    const collectionId = data.collectionId == null ? null : id(data.collectionId);
    if (title || collectionId) requirePro(pro);
    next.clips.unshift({ id: crypto.randomUUID(), content: text, title, kind: data.kind === undefined ? inferKind(text) : kind(data.kind), collectionId, pinned: false, createdAt: now, updatedAt: now, usedAt: 0 });
  } else if (action === "edit") {
    const clip = getClip(next, data.id);
    if (data.content !== undefined) {
      const text = content(data.content);
      if (next.clips.some(x => x.id !== clip.id && x.content === text)) throw new DropError("duplicate", "That clip is already on your shelf.");
      clip.content = text;
    }
    if (data.kind !== undefined) clip.kind = kind(data.kind);
    if (data.title !== undefined && data.title !== clip.title) { requirePro(pro); clip.title = string(data.title, 80, "Title", true); }
    if (data.collectionId !== undefined && data.collectionId !== clip.collectionId) { requirePro(pro); clip.collectionId = data.collectionId === null ? null : id(data.collectionId); }
    clip.updatedAt = now;
  } else if (action === "delete") {
    const clip = getClip(next, data.id);
    next.clips = next.clips.filter(x => x.id !== clip.id);
  } else if (action === "restore") {
    const clip = parseClip(data.clip);
    if (next.clips.some(x => x.id === clip.id || x.content === clip.content)) throw new DropError("duplicate", "This clip is already on your shelf.");
    canAdd(next, pro);
    // A removed collection must not make an undo lose the clip.
    if (clip.collectionId && !next.collections.some(x => x.id === clip.collectionId)) clip.collectionId = null;
    if (!pro && (clip.pinned || clip.title || clip.collectionId)) throw new DropError("pro", "Restore this organized clip after reconnecting Pro.");
    next.clips.unshift(clip);
  } else if (action === "used") {
    getClip(next, data.id).usedAt = now;
  } else if (action === "clear") {
    if (data.confirm !== "DELETE") throw new DropError("confirm", "Confirm before deleting your library.");
    next.clips = []; next.collections = [];
  } else {
    throw new DropError("invalid", "Unknown library action.");
  }
  next.revision += 1;
  return parseState(next);
}
