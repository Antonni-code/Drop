export const FREE_LIMIT = 5;
export const MAX_CLIPS = 5_000;
export const MAX_COLLECTIONS = 100;
export const MAX_CLIP_BYTES = 16_384;
export const MAX_STATE_BYTES = 4_000_000;
export const COLORS = ["blue", "violet", "amber", "green", "rose", "slate"] as const;
export const ICONS = ["folder", "work", "code", "heart", "link", "spark"] as const;
export type Color = (typeof COLORS)[number];
export type CollectionIcon = (typeof ICONS)[number];
export type Kind = "text" | "link" | "code";
export interface Clip {
  id: string; content: string; title: string; kind: Kind; collectionId: string | null;
  pinned: boolean; createdAt: number; updatedAt: number; usedAt: number;
}
export interface Collection { id: string; name: string; color: Color; icon: CollectionIcon }
export interface State { version: 1; revision: number; clips: Clip[]; collections: Collection[] }
export interface Snapshot { state: State; pro: boolean; licenseStatus: string; canActivate: boolean; canCheckout: boolean }
export class DropError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
export const emptyState = (): State => ({ version: 1, revision: 0, clips: [], collections: [] });
export const bytes = (value: string): number => new TextEncoder().encode(value).length;
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DropError("invalid", "That data is not a valid Drop object.");
  return value as Record<string, unknown>;
}
export function string(value: unknown, max: number, label: string, allowEmpty = false): string {
  if (typeof value !== "string" || value.length > max || (!allowEmpty && !value.trim()) || value.includes("\u0000")) {
    throw new DropError("invalid", `${label} is empty or too long.`);
  }
  return value;
}
export function id(value: unknown): string {
  const result = string(value, 80, "ID");
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(result)) throw new DropError("invalid", "Invalid item ID.");
  return result;
}
function timestamp(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 8_640_000_000_000_000) throw new DropError("invalid", "Invalid date.");
  return value;
}
export function content(value: unknown): string {
  const result = string(value, MAX_CLIP_BYTES, "Clip");
  if (bytes(result) > MAX_CLIP_BYTES) throw new DropError("size", "Keep each clip under 16 KB.");
  return result;
}
export function kind(value: unknown): Kind {
  if (value !== "text" && value !== "link" && value !== "code") throw new DropError("invalid", "Unknown clip type.");
  return value;
}
export function inferKind(value: string): Kind {
  try { const url = new URL(value.trim()); if (/^https?:$/.test(url.protocol) && !/\s/.test(value.trim())) return "link"; } catch { /* Ordinary text. */ }
  return "text";
}
export function parseCollection(value: unknown): Collection {
  const item = object(value);
  if (!COLORS.includes(item.color as Color) || !ICONS.includes(item.icon as CollectionIcon)) throw new DropError("invalid", "Unknown collection appearance.");
  return { id: id(item.id), name: string(item.name, 36, "Collection name").trim(), color: item.color as Color, icon: item.icon as CollectionIcon };
}
export function parseClip(value: unknown): Clip {
  const item = object(value);
  if (typeof item.pinned !== "boolean") throw new DropError("invalid", "Invalid favorite value.");
  return { id: id(item.id), content: content(item.content), title: string(item.title, 80, "Title", true), kind: kind(item.kind),
    collectionId: item.collectionId === null ? null : id(item.collectionId), pinned: item.pinned,
    createdAt: timestamp(item.createdAt), updatedAt: timestamp(item.updatedAt), usedAt: timestamp(item.usedAt) };
}
export function parseState(value: unknown): State {
  const data = object(value);
  if (data.version !== 1) throw new DropError("version", "This library uses an unsupported version. Update Drop before opening it.");
  if (!Number.isSafeInteger(data.revision) || (data.revision as number) < 0) throw new DropError("invalid", "Invalid library revision.");
  if (!Array.isArray(data.clips) || data.clips.length > MAX_CLIPS || !Array.isArray(data.collections) || data.collections.length > MAX_COLLECTIONS) throw new DropError("size", "This library is too large.");
  const clips = data.clips.map(parseClip), collections = data.collections.map(parseCollection);
  if (new Set(clips.map(x => x.id)).size !== clips.length || new Set(collections.map(x => x.id)).size !== collections.length) throw new DropError("invalid", "The library contains duplicate IDs.");
  const ids = new Set(collections.map(x => x.id));
  if (clips.some(x => x.collectionId !== null && !ids.has(x.collectionId))) throw new DropError("invalid", "A clip points to a missing collection.");
  const state: State = { version: 1, revision: data.revision as number, clips, collections };
  if (bytes(JSON.stringify(state)) > MAX_STATE_BYTES) throw new DropError("size", "Your library is full. Export a backup, then remove clips you no longer need.");
  return state;
}
export function titleOf(clip: Clip): string { return clip.title || clip.content.trim().split("\n")[0]!.slice(0, 80); }
export function requirePro(pro: boolean): void {
  if (!pro) throw new DropError("pro", "This tool is included in Drop Pro.");
}
export function canAdd(state: State, pro: boolean): void {
  if (!pro && state.clips.length >= FREE_LIMIT) throw new DropError("limit", "Your five free spaces are full. Remove a clip or unlock Pro.");
  if (state.clips.length >= MAX_CLIPS) throw new DropError("size", "This device has reached the safety limit of 5,000 clips. Export and clear unused clips.");
}
export function getClip(state: State, clipId: unknown): Clip {
  const found = state.clips.find(x => x.id === id(clipId));
  if (!found) throw new DropError("missing", "This clip was removed. Refresh your shelf.");
  return found;
}
