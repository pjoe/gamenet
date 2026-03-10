import { Color3 } from "@babylonjs/core/Maths/math.color";
import { createComponent } from "@skyboxgg/bjs-ecs";
import { genericSerde } from "./serde";
import { setupSphere } from "./sphere_setup";

type SphereOptions = {
  diameter: number;
  segments: number;
  diffuseColor: Color3;
  specularColor: Color3;
};

export const sphere = createComponent(
  "sphere",
  (options: SphereOptions) => options
);

const sphereNetSyncKeys = [
  "diameter",
  "segments",
  "diffuseColor",
  "specularColor",
] as const;

export const sphereSerde = genericSerde(sphere, sphereNetSyncKeys, setupSphere);
