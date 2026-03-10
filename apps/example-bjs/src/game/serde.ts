import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { Comp } from "@skyboxgg/bjs-ecs";

export interface ComponentSerde {
  serialize: (comp: true | Comp) => unknown;
  deserialize: (
    data: unknown,
    scene: Scene
  ) => { comp: Comp; node: TransformNode | null };
}

export const genericSerde = <T extends Comp>(
  compType: (options: any) => T,
  keys: readonly string[],
  setupNode:
    | ((options: T["value"], scene: Scene) => { node: TransformNode | null })
    | null = null
): ComponentSerde => ({
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
  deserialize: (data: unknown, scene: Scene) => {
    const compData = data as Record<string, unknown>;
    const comp = compType(compData);
    const { node } = setupNode ? setupNode(comp.value, scene) : { node: null };
    return { comp, node };
  },
});
