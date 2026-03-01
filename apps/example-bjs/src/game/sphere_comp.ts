import { Color3 } from "@babylonjs/core/Maths/math.color";
import { createComponent } from "@skyboxgg/bjs-ecs";

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
