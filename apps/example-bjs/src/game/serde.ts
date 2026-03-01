import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { Comp } from "@skyboxgg/bjs-ecs";

export interface ComponentSerde {
  serialize: (comp: true | Comp) => unknown;
  deserialize: (
    data: unknown,
    scene: Scene
  ) => { comp: Comp; node: TransformNode };
}
