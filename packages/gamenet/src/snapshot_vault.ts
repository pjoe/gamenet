/**
 * Schema-driven snapshot vault for entity state interpolation.
 *
 * Stores the last N state snapshots per entity per component and
 * interpolates between them when queried at an arbitrary timestamp.
 * Interpolation functions are user-provided per property via schemas
 * registered per component key.
 */

/** Interpolation function: blend from `a` to `b` by factor `t` ∈ [0, 1]. */
export type LerpFn<T> = (a: T, b: T, t: number) => T;

/** Per-property interpolation configuration. */
export interface PropertySchema {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lerp: LerpFn<any>;
}

/** Schema for a component: maps property names to their interpolation config. */
export type ComponentSchema = Record<string, PropertySchema>;

/** A timestamped set of property values. */
interface Snapshot {
  time: number;
  values: Record<string, unknown>;
}

function storageKey(entityId: number, compKey: string): string {
  return `${entityId}:${compKey}`;
}

/**
 * Binary-search for the rightmost index whose time is ≤ `target`.
 * Returns -1 when every snapshot is after `target`.
 */
function findFloor(snapshots: Snapshot[], target: number): number {
  let lo = 0;
  let hi = snapshots.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (snapshots[mid].time <= target) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

export class SnapshotVault {
  private readonly capacity: number;
  private readonly schemas = new Map<string, ComponentSchema>();
  private readonly store = new Map<string, Snapshot[]>();

  constructor(capacity: number) {
    this.capacity = Math.max(1, Math.trunc(capacity));
  }

  /** Register an interpolation schema for a component key. */
  registerSchema(compKey: string, schema: ComponentSchema): void {
    this.schemas.set(compKey, schema);
  }

  /**
   * Record a snapshot. Only properties present in the registered schema are
   * stored. Silently skips if no schema is registered for `compKey`.
   */
  push(
    entityId: number,
    compKey: string,
    time: number,
    values: Record<string, unknown>
  ): void {
    const schema = this.schemas.get(compKey);
    if (!schema) return;

    // Extract only the properties declared in the schema.
    const filtered: Record<string, unknown> = {};
    for (const key of Object.keys(schema)) {
      if (key in values) {
        filtered[key] = values[key];
      }
    }

    const key = storageKey(entityId, compKey);
    let list = this.store.get(key);
    if (!list) {
      list = [];
      this.store.set(key, list);
    }

    list.push({ time, values: filtered });

    // Evict oldest when over capacity.
    while (list.length > this.capacity) {
      list.shift();
    }
  }

  /**
   * Query interpolated state for an entity's component at a given time.
   *
   * - Returns `null` when no schema is registered or no snapshots exist.
   * - Clamps to the oldest/newest snapshot when `time` is out of range.
   * - Interpolates between the two bracketing snapshots otherwise.
   */
  query(
    entityId: number,
    compKey: string,
    time: number
  ): Record<string, unknown> | null {
    const schema = this.schemas.get(compKey);
    if (!schema) return null;

    const list = this.store.get(storageKey(entityId, compKey));
    if (!list || list.length === 0) return null;

    // Clamp: before oldest
    if (time <= list[0].time) {
      return { ...list[0].values };
    }

    // Clamp: after newest
    const last = list[list.length - 1];
    if (time >= last.time) {
      return { ...last.values };
    }

    // Find the two bracketing snapshots via binary search.
    const floorIdx = findFloor(list, time);
    const before = list[floorIdx];
    const after = list[floorIdx + 1];

    const span = after.time - before.time;
    const t = span === 0 ? 0 : (time - before.time) / span;

    const result: Record<string, unknown> = {};
    for (const [prop, propSchema] of Object.entries(schema)) {
      const a = before.values[prop];
      const b = after.values[prop];
      if (a !== undefined && b !== undefined) {
        result[prop] = propSchema.lerp(a, b, t);
      } else {
        // Fall back to whichever value exists (or undefined).
        result[prop] = b ?? a;
      }
    }
    return result;
  }

  /** Remove all snapshots for an entity (all component keys). */
  remove(entityId: number): void {
    const prefix = `${entityId}:`;
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /** Clear all stored data (schemas are preserved). */
  clear(): void {
    this.store.clear();
  }
}
