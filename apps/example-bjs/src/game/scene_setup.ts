import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { Scene } from "@babylonjs/core/scene";
import { setupPlayer } from "./player_setup";

// Side-effect imports
import "@babylonjs/core/Materials/standardMaterial";

export function setupScene(scene: Scene, isServer = false) {
  scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);

  if (isServer) {
    // Minimal camera so Babylon doesn't complain about a missing active camera
    new Camera("camera", Vector3.Zero(), scene);
  } else {
    // Camera — orbitable
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

  // Sphere
  const sphere = CreateSphere("sphere", { diameter: 1.5, segments: 32 }, scene);
  sphere.position.y = 0.75;
  const sphereMat = new StandardMaterial("sphereMat", scene);
  sphereMat.diffuseColor = new Color3(0.2, 0.5, 0.9);
  sphereMat.specularColor = new Color3(0.4, 0.4, 0.4);
  sphere.material = sphereMat;

  // Player
  setupPlayer({ nickname: "Player1", color: new Color3(0.8, 0.2, 0.2) }, scene);
}
