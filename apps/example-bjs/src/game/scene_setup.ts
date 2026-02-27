import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { Scene } from "@babylonjs/core/scene";

export function setupScene(scene: Scene) {
  scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);

  const canvas = scene.getEngine().getRenderingCanvas();

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
  if (canvas) {
    camera.attachControl(canvas, true);
  }

  // Light
  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 0.9;

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
}
