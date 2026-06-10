import { Comp, Entity } from "@skyboxgg/bjs-ecs";

/**
 * Base state threaded through all serde hooks.
 *
 * The netsync read/write helpers populate `entity` and `node` per entity
 * before invoking serde hooks. `TNode` is the engine-specific scene-node
 * type (e.g. Babylon's `TransformNode`), keeping this core type free of
 * any engine dependency. Apps extend this with their own fields
 * (scene, snapshot vault, client id, ...) and parametrize their serdes
 * with the extended type.
 */
export interface NetsyncState<TNode = unknown> {
  /** Entity currently being (de)serialized, when available. */
  entity: Entity<["netsync"]> | null;
  /** Scene node of the entity currently being (de)serialized, when available. */
  node: TNode | null;
}

export interface ComponentSerde<TState extends NetsyncState = NetsyncState> {
  /** True when `deserialize` may create a node. Node-creating serdes run first. */
  createsNode?: boolean;
  /** Full payload used when creating an entity. */
  serialize(comp: true | Comp, state: TState): unknown;
  /**
   * Recreate component(s) from a create payload. A node-creating serde
   * must assign the created node to `state.node`, making it available to
   * subsequently deserialized components and to the caller.
   */
  deserialize(data: unknown, state: TState): { comps: (Comp | string)[] };
  /**
   * Per-tick update payload. When absent, the component is not included
   * in update sync messages.
   */
  serializeUpdate?(comp: true | Comp, state: TState): unknown;
  /** Apply a per-tick update payload on the client. */
  applyUpdate?(data: unknown, state: TState): void;
  /**
   * Snapshot values for the client snapshot vault. When absent, the
   * component is not snapshotted.
   */
  captureSnapshot?(
    comp: true | Comp,
    state: TState
  ): Record<string, unknown> | undefined;
}

export const genericSerde = <
  T extends Comp,
  TState extends NetsyncState = NetsyncState,
>(options: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compType: (options: any) => T;
  keys: readonly string[];
  setupNode?: (options: T["value"], state: TState) => { node: TState["node"] };
}): ComponentSerde<TState> => {
  const { keys, compType, setupNode } = options;
  return {
    createsNode: !!setupNode,
    serialize: (comp: true | Comp) => {
      const typedComp = comp as T;
      return keys.reduce(
        (acc, key) => {
          acc[key] = typedComp.value[key];
          return acc;
        },
        {} as Record<string, unknown>
      );
    },
    deserialize: (data: unknown, state: TState) => {
      const compData = data as Record<string, unknown>;
      const comp = compType(compData);
      if (setupNode) {
        const { node } = setupNode(comp.value, state);
        if (node) {
          state.node = node;
        }
      }
      return { comps: [comp] };
    },
  };
};
