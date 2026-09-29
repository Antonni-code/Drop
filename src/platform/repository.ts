import { emptyState, parseState, type State } from "../core/model";
export const STATE_KEY = "drop.library.v1";
export const BACKUP_KEY = "drop.backup.v1";
export interface StorageAdapter { get(key: string): Promise<unknown>; set(values: Record<string, unknown>): Promise<void> }

/** One owner, one queue: every read-modify-write is serialized by the background. */
export class Repository {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly storage: StorageAdapter) {}
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.catch(() => undefined);
    return result;
  }
  private async load(): Promise<State> {
    const raw = await this.storage.get(STATE_KEY);
    return raw === undefined ? emptyState() : parseState(raw);
  }
  read(): Promise<State> { return this.enqueue(() => this.load()); }
  update(transform: (state: State) => State | Promise<State>, retainBackup = true): Promise<State> {
    return this.enqueue(async () => {
      const before = await this.load();
      const after = parseState(await transform(before));
      // A single set atomically replaces the library and its prior snapshot.
      await this.storage.set({ [BACKUP_KEY]: retainBackup ? before : emptyState(), [STATE_KEY]: after });
      return after;
    });
  }
}
