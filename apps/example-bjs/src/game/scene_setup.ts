import { Camera } from "@babylonjs/core/Cameras/camera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import type { Scene } from "@babylonjs/core/scene";
import { setupPlayerCamera } from "./player_camera_setup";

// Side-effect imports
import "@babylonjs/core/Materials/standardMaterial";

export async function setupScene(scene: Scene, isServer = false) {
  scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);

  if (isServer) {
    // Minimal camera so Babylon doesn't complain about a missing active camera
    new Camera("camera", Vector3.Zero(), scene);
  } else {
    setupPlayerCamera(scene);

    // Light
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
    light.intensity = 0.9;
  }

  // Ground
  const ground = CreateGround("ground", { width: 20, height: 20 }, scene);
  const groundMat = new StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new Color3(0.2, 0.2, 0.25);
  groundMat.specularColor = new Color3(0.1, 0.1, 0.1);
  ground.material = groundMat;

  // Physics (server-only)
  if (isServer) {
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);
  }
}
