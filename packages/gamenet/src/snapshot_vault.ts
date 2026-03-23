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

/** Public API returned by `createSnapshotVault`. */
export interface SnapshotVault {
  registerSchema(compKey: string, schema: ComponentSchema): void;
  push(
    entityId: number,
    compKey: string,
    time: number,
    values: Record<string, unknown>
  ): void;
  query(
    entityId: number,
    compKey: string,
    time: number
  ): Record<string, unknown> | null;
  remove(entityId: number): void;
  clear(): void;
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

function push(
  schemas: Map<string, ComponentSchema>,
  store: Map<string, Snapshot[]>,
  capacity: number,
  entityId: number,
  compKey: string,
  time: number,
  values: Record<string, unknown>
): void {
  const schema = schemas.get(compKey);
  if (!schema) return;

  const filtered: Record<string, unknown> = {};
  for (const key of Object.keys(schema)) {
    if (key in values) {
      filtered[key] = values[key];
    }
  }

  const key = storageKey(entityId, compKey);
  let list = store.get(key);
  if (!list) {
    list = [];
    store.set(key, list);
  }

  list.push({ time, values: filtered });

  while (list.length > capacity) {
    list.shift();
  }
}

function query(
  schemas: Map<string, ComponentSchema>,
  store: Map<string, Snapshot[]>,
  entityId: number,
  compKey: string,
  time: number
): Record<string, unknown> | null {
  const schema = schemas.get(compKey);
  if (!schema) return null;

  const list = store.get(storageKey(entityId, compKey));
  if (!list || list.length === 0) return null;

  if (time <= list[0].time) {
    return { ...list[0].values };
  }

  const last = list[list.length - 1];
  if (time >= last.time) {
    return { ...last.values };
  }

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
      result[prop] = b ?? a;
    }
  }
  return result;
}

function remove(store: Map<string, Snapshot[]>, entityId: number): void {
  const prefix = `${entityId}:`;
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/** Create a snapshot vault with the given history capacity per entity/component. */
export function createSnapshotVault(capacity: number): SnapshotVault {
  const cap = Math.max(1, Math.trunc(capacity));
  const schemas = new Map<string, ComponentSchema>();
  const store = new Map<string, Snapshot[]>();

  return {
    registerSchema: (compKey, schema) => schemas.set(compKey, schema),
    push: (entityId, compKey, time, values) =>
      push(schemas, store, cap, entityId, compKey, time, values),
    query: (entityId, compKey, time) =>
      query(schemas, store, entityId, compKey, time),
    remove: (entityId) => remove(store, entityId),
    clear: () => store.clear(),
  };
}
