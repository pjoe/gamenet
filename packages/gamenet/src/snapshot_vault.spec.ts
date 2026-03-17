import { SnapshotVault } from "./snapshot_vault";

/** Simple scalar lerp used for all tests. */
const scalarLerp = (a: number, b: number, t: number) => a + (b - a) * t;

describe("SnapshotVault", () => {
  let vault: SnapshotVault;

  beforeEach(() => {
    vault = new SnapshotVault(10);
    vault.registerSchema("pos", {
      x: { lerp: scalarLerp },
      y: { lerp: scalarLerp },
    });
  });

  it("returns null for empty vault", () => {
    expect(vault.query(1, "pos", 100)).toBeNull();
  });

  it("returns null for unregistered component key", () => {
    vault.push(1, "unknown", 100, { x: 1 });
    expect(vault.query(1, "unknown", 100)).toBeNull();
  });

  it("returns exact values when querying at snapshot time", () => {
    vault.push(1, "pos", 100, { x: 10, y: 20 });
    expect(vault.query(1, "pos", 100)).toEqual({ x: 10, y: 20 });
  });

  it("clamps to oldest snapshot when querying before it", () => {
    vault.push(1, "pos", 100, { x: 10, y: 20 });
    vault.push(1, "pos", 200, { x: 30, y: 40 });
    expect(vault.query(1, "pos", 50)).toEqual({ x: 10, y: 20 });
  });

  it("clamps to newest snapshot when querying after it", () => {
    vault.push(1, "pos", 100, { x: 10, y: 20 });
    vault.push(1, "pos", 200, { x: 30, y: 40 });
    expect(vault.query(1, "pos", 300)).toEqual({ x: 30, y: 40 });
  });

  it("interpolates between two snapshots at midpoint", () => {
    vault.push(1, "pos", 100, { x: 0, y: 0 });
    vault.push(1, "pos", 200, { x: 100, y: 200 });
    const result = vault.query(1, "pos", 150);
    expect(result).toEqual({ x: 50, y: 100 });
  });

  it("interpolates at arbitrary t values", () => {
    vault.push(1, "pos", 0, { x: 0, y: 0 });
    vault.push(1, "pos", 100, { x: 100, y: 50 });
    const result = vault.query(1, "pos", 25);
    expect(result).toEqual({ x: 25, y: 12.5 });
  });

  it("interpolates across multiple snapshots (picks correct pair)", () => {
    vault.push(1, "pos", 100, { x: 0, y: 0 });
    vault.push(1, "pos", 200, { x: 100, y: 100 });
    vault.push(1, "pos", 300, { x: 200, y: 0 });
    // Query between second and third snapshot
    const result = vault.query(1, "pos", 250);
    expect(result).toEqual({ x: 150, y: 50 });
  });

  it("evicts oldest snapshots when over capacity", () => {
    vault = new SnapshotVault(3);
    vault.registerSchema("pos", {
      x: { lerp: scalarLerp },
    });
    vault.push(1, "pos", 100, { x: 10 });
    vault.push(1, "pos", 200, { x: 20 });
    vault.push(1, "pos", 300, { x: 30 });
    vault.push(1, "pos", 400, { x: 40 }); // evicts t=100

    // Clamped to oldest remaining (t=200)
    expect(vault.query(1, "pos", 100)).toEqual({ x: 20 });
    // Latest still works
    expect(vault.query(1, "pos", 400)).toEqual({ x: 40 });
    // Interpolation between remaining snapshots
    expect(vault.query(1, "pos", 350)).toEqual({ x: 35 });
  });

  it("stores multiple components per entity independently", () => {
    vault.registerSchema("stats", {
      hp: { lerp: scalarLerp },
    });
    vault.push(1, "pos", 100, { x: 0, y: 0 });
    vault.push(1, "stats", 100, { hp: 100 });
    vault.push(1, "pos", 200, { x: 10, y: 20 });
    vault.push(1, "stats", 200, { hp: 80 });

    expect(vault.query(1, "pos", 150)).toEqual({ x: 5, y: 10 });
    expect(vault.query(1, "stats", 150)).toEqual({ hp: 90 });
  });

  it("keeps entities isolated from each other", () => {
    vault.push(1, "pos", 100, { x: 0, y: 0 });
    vault.push(2, "pos", 100, { x: 999, y: 999 });

    expect(vault.query(1, "pos", 100)).toEqual({ x: 0, y: 0 });
    expect(vault.query(2, "pos", 100)).toEqual({ x: 999, y: 999 });
  });

  it("returns null after removing an entity", () => {
    vault.push(1, "pos", 100, { x: 10, y: 20 });
    vault.remove(1);
    expect(vault.query(1, "pos", 100)).toBeNull();
  });

  it("remove only affects the target entity", () => {
    vault.push(1, "pos", 100, { x: 10, y: 20 });
    vault.push(2, "pos", 100, { x: 30, y: 40 });
    vault.remove(1);
    expect(vault.query(1, "pos", 100)).toBeNull();
    expect(vault.query(2, "pos", 100)).toEqual({ x: 30, y: 40 });
  });

  it("remove clears all component keys for that entity", () => {
    vault.registerSchema("stats", { hp: { lerp: scalarLerp } });
    vault.push(1, "pos", 100, { x: 10, y: 20 });
    vault.push(1, "stats", 100, { hp: 50 });
    vault.remove(1);
    expect(vault.query(1, "pos", 100)).toBeNull();
    expect(vault.query(1, "stats", 100)).toBeNull();
  });

  it("clear resets all data but preserves schemas", () => {
    vault.push(1, "pos", 100, { x: 10, y: 20 });
    vault.clear();
    expect(vault.query(1, "pos", 100)).toBeNull();
    // Schema still works — can push again
    vault.push(1, "pos", 200, { x: 30, y: 40 });
    expect(vault.query(1, "pos", 200)).toEqual({ x: 30, y: 40 });
  });

  it("only stores schema-declared properties", () => {
    vault.push(1, "pos", 100, { x: 10, y: 20, z: 30 });
    const result = vault.query(1, "pos", 100);
    // Schema only declares x and y
    expect(result).toEqual({ x: 10, y: 20 });
  });

  it("handles a single snapshot (clamp both directions)", () => {
    vault.push(1, "pos", 100, { x: 5, y: 10 });
    expect(vault.query(1, "pos", 50)).toEqual({ x: 5, y: 10 });
    expect(vault.query(1, "pos", 100)).toEqual({ x: 5, y: 10 });
    expect(vault.query(1, "pos", 150)).toEqual({ x: 5, y: 10 });
  });

  it("uses custom lerp functions per property", () => {
    // "step" lerp: snaps to b when t >= 0.5
    const stepLerp = (a: number, b: number, t: number) => (t < 0.5 ? a : b);

    vault.registerSchema("custom", {
      val: { lerp: stepLerp },
    });
    vault.push(1, "custom", 0, { val: 0 });
    vault.push(1, "custom", 100, { val: 100 });

    expect(vault.query(1, "custom", 25)).toEqual({ val: 0 });
    expect(vault.query(1, "custom", 75)).toEqual({ val: 100 });
  });
});
