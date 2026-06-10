import { Color3 } from "@babylonjs/core/Maths/math.color";
import { genericSerde } from "@gamenet/bjs";
import { createComponent } from "@skyboxgg/bjs-ecs";
import type { GameSerdeState } from "../serdes_config";
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

export const sphereSerde = genericSerde<
  ReturnType<typeof sphere>,
  GameSerdeState
>({
  compType: sphere,
  keys: sphereNetSyncKeys,
  setupNode: (options, state) => setupSphere(options, state.scene),
});
