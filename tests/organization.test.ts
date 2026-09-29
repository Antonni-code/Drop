import { describe, expect, it } from "vitest";
import { applyOrganization, exportLibrary } from "../src/core/organization";
import { applyBasic } from "../src/core/library";
import { emptyState } from "../src/core/model";

describe("Pro organization", () => {
  it("keeps every protected command behind entitlement checks", () => {
    for (const action of ["pin", "move", "collection.save", "collection.delete", "import"]) {
      expect(() => applyOrganization(emptyState(), action, {}, false)).toThrow("Pro");
    }
  });
  it("imports atomically, merges duplicate text and remaps collections", () => {
    let original = applyOrganization(emptyState(), "collection.save", { name: "Work", color: "blue", icon: "work" }, true);
    original = applyBasic(original, "save", { content: "Hello", title: "Reply", collectionId: original.collections[0]!.id }, true);
    const imported = applyOrganization(emptyState(), "import", { json: exportLibrary(original) }, true);
    expect(imported.clips[0]!.collectionId).toBe(imported.collections[0]!.id);
    expect(imported.clips[0]!.id).not.toBe(original.clips[0]!.id);
    expect(applyOrganization(imported, "import", { json: exportLibrary(original) }, true).clips).toHaveLength(1);
    expect(() => applyOrganization(imported, "import", { json: "{}" }, true)).toThrow("not a Drop");
    expect(imported.clips).toHaveLength(1);
  });
  it("deleting a collection keeps its clips", () => {
    let state = applyOrganization(emptyState(), "collection.save", { name: "Work", color: "blue", icon: "work" }, true);
    state = applyBasic(state, "save", { content: "Keep this", collectionId: state.collections[0]!.id }, true);
    const updated = applyOrganization(state, "collection.delete", { id: state.collections[0]!.id }, true);
    expect(updated.clips[0]!.content).toBe("Keep this");
    expect(updated.clips[0]!.collectionId).toBeNull();
  });
  it("retains excess saved clips when Pro expires", () => {
    let state = emptyState();
    for (let i = 0; i < 8; i++) state = applyBasic(state, "save", { content: `Clip ${i}` }, true);
    expect(() => applyBasic(state, "save", { content: "Another" }, false)).toThrow("five free");
    expect(applyBasic(state, "edit", { id: state.clips[0]!.id, content: "Still editable" }, false).clips).toHaveLength(8);
    expect(applyBasic(state, "used", { id: state.clips[0]!.id }, false).clips).toHaveLength(8);
  });
  it("reorders by stable identity and preserves the input state", () => {
    let state = emptyState();
    for (const text of ["One", "Two", "Three"]) state = applyBasic(state, "save", { content: text }, true);
    const moved = applyOrganization(state, "move", { id: state.clips[0]!.id, beforeId: null }, true);
    expect(moved.clips.map(x => x.content)).toEqual(["Two", "One", "Three"]);
    expect(state.clips[0]!.content).toBe("Three");
  });
});
