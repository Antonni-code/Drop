import { bytes, DropError, getClip, id, MAX_STATE_BYTES, object, parseCollection, parseState, requirePro, string, type State } from "./model";

export function applyOrganization(state: State, action: string, data: Record<string, unknown>, pro: boolean): State {
  requirePro(pro);
  const next = structuredClone(state);
  if (action === "pin") {
    const clip = getClip(next, data.id);
    clip.pinned = !clip.pinned;
  } else if (action === "move") {
    const clip = getClip(next, data.id);
    if (data.beforeId === clip.id) return next;
    if (data.beforeId !== null) getClip(next, data.beforeId);
    next.clips = next.clips.filter(x => x.id !== clip.id);
    const index = data.beforeId === null ? next.clips.length : next.clips.findIndex(x => x.id === data.beforeId);
    next.clips.splice(index, 0, clip);
  } else if (action === "collection.save") {
    const collection = parseCollection({ ...data, id: data.id ?? crypto.randomUUID() });
    if (next.collections.some(x => x.id !== collection.id && x.name.toLocaleLowerCase() === collection.name.toLocaleLowerCase())) throw new DropError("duplicate", "That collection already exists.");
    const index = next.collections.findIndex(x => x.id === collection.id);
    if (index >= 0) next.collections[index] = collection;
    else next.collections.push(collection);
  } else if (action === "collection.delete") {
    const collectionId = id(data.id);
    next.collections = next.collections.filter(x => x.id !== collectionId);
    for (const clip of next.clips) if (clip.collectionId === collectionId) clip.collectionId = null;
  } else if (action === "import") {
    const input = string(data.json, MAX_STATE_BYTES, "Backup");
    if (bytes(input) > MAX_STATE_BYTES) throw new DropError("size", "The backup exceeds 4 MB.");
    let raw: unknown;
    try { raw = JSON.parse(input); } catch { throw new DropError("invalid", "Choose a valid Drop JSON backup."); }
    const backup = object(raw);
    if (backup.app !== "drop" || backup.format !== 1) throw new DropError("invalid", "This is not a Drop backup.");
    const incoming = parseState(backup.library);
    const collectionMap = new Map<string, string>();
    for (const collection of incoming.collections) {
      const existing = next.collections.find(x => x.name.toLocaleLowerCase() === collection.name.toLocaleLowerCase());
      const nextId = existing?.id ?? crypto.randomUUID();
      collectionMap.set(collection.id, nextId);
      if (!existing) next.collections.push({ ...collection, id: nextId });
    }
    const contents = new Set(next.clips.map(x => x.content));
    for (const clip of incoming.clips) {
      if (contents.has(clip.content)) continue;
      next.clips.push({ ...clip, id: crypto.randomUUID(), collectionId: clip.collectionId ? collectionMap.get(clip.collectionId)! : null });
      contents.add(clip.content);
    }
  } else {
    throw new DropError("invalid", "Unknown organization action.");
  }
  next.revision += 1;
  return parseState(next);
}

export function exportLibrary(state: State): string {
  return JSON.stringify({ app: "drop", format: 1, exportedAt: new Date().toISOString(), library: parseState(state) }, null, 2);
}
