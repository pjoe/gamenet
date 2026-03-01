import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Scene } from "@babylonjs/core/scene";
import { Comp, createComponent } from "@skyboxgg/bjs-ecs";
import { ComponentSerde } from "./serde";
import { setupSphere } from "./sphere_setup";

export const sphere = createComponent(
  "sphere",
  (
    diameter: number,
    segments: number,
    diffuseColor: Color3,
    specularColor: Color3
  ) => ({
    diameter,
    segments,
    diffuseColor,
    specularColor,
  })
);

type sphereNetSyncData = {
  diameter: number;
  segments: number;
  diffuse: Color3;
  specular: Color3;
};
export const sphereSerde: ComponentSerde = {
  serialize: (comp: true | Comp): sphereNetSyncData => {
    const typedComp = comp as ReturnType<typeof sphere>;
    return {
      diameter: typedComp.value.diameter,
      segments: typedComp.value.segments,
      diffuse: typedComp.value.diffuseColor,
      specular: typedComp.value.specularColor,
    };
  },
  deserialize: (data: unknown, scene: Scene) => {
    const sphereData = data as sphereNetSyncData;
    const sphereComp = sphere(
      sphereData.diameter,
      sphereData.segments,
      new Color3().copyFrom(sphereData.diffuse),
      new Color3().copyFrom(sphereData.specular)
    );
    const { sphereNode } = setupSphere(
      {
        diameter: sphereComp.value.diameter,
        segments: sphereComp.value.segments,
        diffuseColor: sphereComp.value.diffuseColor,
        specularColor: sphereComp.value.specularColor,
      },
      scene
    );
    return { comp: sphereComp, node: sphereNode };
  },
};
