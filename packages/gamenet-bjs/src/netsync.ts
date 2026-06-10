import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { SnapshotVault } from "@gamenet/core";
import {
  addNodeEntity,
  Comp,
  Entity,
  queryXforms,
  xform,
} from "@skyboxgg/bjs-ecs";
import { ComponentSerde, NetsyncState } from "./serde";

export type SerializedEntity = {
  id: number;
  name?: string;
  [key: string]: unknown;
};
export type EntitiesSync = SerializedEntity[];

/** Netsync state bound to Babylon.js scene nodes. */
export type BjsNetsyncState = NetsyncState<TransformNode>;

export function writeEntity<TState extends BjsNetsyncState>(
  e: Entity<["netsync"]>,
  registry: Record<string, ComponentSerde<TState>>,
  state: TState,
  isUpdate = false
): SerializedEntity {
  let name = "nameless";
  const xformComp = e.comps.xform as ReturnType<typeof xform> | undefined;
  const entityState: TState = {
    ...state,
    entity: e,
    node: xformComp?.value ?? null,
  };
  const comps: Record<string, unknown> = {};
  for (const [key, comp] of Object.entries(e.comps)) {
    if (key === "xform") {
      name = (comp as ReturnType<typeof xform>).value.name;
    }
    const serde = registry[key];
    let compData: unknown = undefined;
    if (serde) {
      compData = isUpdate
        ? serde.serializeUpdate?.(comp, entityState)
        : serde.serialize(comp, entityState);
    }
    if (compData !== undefined || !isUpdate) {
      // skip comps without update data to minimize bandwidth
      comps[key] = compData ?? true;
    }
  }
  if (isUpdate) {
    // for updates, don't include the name to minimize bandwidth
    return { id: e.id, ...comps };
  }
  return { id: e.id, name, ...comps };
}

export function writeCreateEntities<TState extends BjsNetsyncState>(
  registry: Record<string, ComponentSerde<TState>>,
  state: TState
): EntitiesSync {
  const entities = queryXforms(["netsync"]);
  return entities.map((e) => writeEntity(e, registry, state));
}

export function writeUpdateEntities<TState extends BjsNetsyncState>(
  registry: Record<string, ComponentSerde<TState>>,
  state: TState
): EntitiesSync {
  const entities = queryXforms(["netsync"]);
  return entities.map((e) => writeEntity(e, registry, state, true));
}

export type ServerEntityIdMap = Map<number, Entity<["netsync"]>>;

export function readEntity<TState extends BjsNetsyncState>(
  e: SerializedEntity,
  idMap: ServerEntityIdMap,
  registry: Record<string, ComponentSerde<TState>>,
  state: TState
) {
  const comps: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(e)) {
    if (k === "id" || k === "name") continue;
    comps[k] = v === true ? {} : (v ?? {});
  }
  console.debug(
    `Creating entity serverId:${e.id} (${e.name}) with comps:`,
    comps
  );
  const entityState: TState = { ...state, entity: null, node: null };
  const compsToAdd: (Comp | string)[] = ["netsync"];

  for (const [key, val] of Object.entries(comps)
    .filter(([key]) => key in registry)
    // Sort so that components that create nodes are deserialized first
    .sort(([a], [b]) =>
      registry[a].createsNode === registry[b].createsNode
        ? 0
        : registry[a].createsNode
          ? -1
          : 1
    )) {
    if (val) {
      const { comps: newComps } = registry[key].deserialize(val, entityState);
      compsToAdd.push(...newComps);
    }
  }

  const xformNode = entityState.node;
  if (xformNode) {
    const entity =
      xformNode.metadata?.entity ?? addNodeEntity(xformNode, compsToAdd);
    idMap.set(Number(e.id), entity);
  }
}

export function readCreateEntities<TState extends BjsNetsyncState>(
  data: unknown,
  idMap: ServerEntityIdMap,
  registry: Record<string, ComponentSerde<TState>>,
  state: TState
) {
  const entities = data as SerializedEntity[];
  entities
    .filter((e) => !idMap.has(e.id)) // skip existing entitites
    .forEach((e) => readEntity(e, idMap, registry, state));
}

export function readUpdateEntities<TState extends BjsNetsyncState>(
  entities: EntitiesSync,
  idMap: ServerEntityIdMap,
  registry: Record<string, ComponentSerde<TState>>,
  state: TState
) {
  for (const e of entities) {
    const entity = idMap.get(e.id);
    if (!entity) continue;
    const xformComp = entity.comps.xform as
      | ReturnType<typeof xform>
      | undefined;
    const entityState: TState = {
      ...state,
      entity,
      node: xformComp?.value ?? null,
    };
    for (const [key, val] of Object.entries(e)) {
      if (key === "id" || key === "name") continue;
      registry[key]?.applyUpdate?.(val, entityState);
    }
  }
}

/**
 * Push snapshots for all netsync entities into the vault, using each
 * registered serde's `captureSnapshot` hook (keyed by component name).
 */
export function captureSnapshots<TState extends BjsNetsyncState>(
  registry: Record<string, ComponentSerde<TState>>,
  vault: SnapshotVault,
  state: TState,
  now: number = Date.now()
) {
  queryXforms(["netsync"]).forEach((e) => {
    const xformComp = e.comps.xform as ReturnType<typeof xform> | undefined;
    const entityState: TState = {
      ...state,
      entity: e,
      node: xformComp?.value ?? null,
    };
    for (const [key, comp] of Object.entries(e.comps)) {
      const values = registry[key]?.captureSnapshot?.(comp, entityState);
      if (values !== undefined) {
        vault.push(e.id, key, now, values);
      }
    }
  });
}
