import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { queryXforms, xform } from "@skyboxgg/bjs-ecs";
import { player } from "./player_comp";

export function setupPlayerCamera(scene: Scene) {
  const camera = new ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    Math.PI / 3,
    10,
    Vector3.Zero(),
    scene
  );
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 30;
  camera.attachControl();

  scene.onBeforeRenderObservable.add(() => {
    const results = queryXforms([player, "me"]);
    if (results.length === 0) return;
    const xformVal = (results[0].comps.xform as ReturnType<typeof xform>).value;
    camera.target.copyFrom(xformVal.position);
  });

  return camera;
}
