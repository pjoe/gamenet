import { Camera } from "@babylonjs/core/Cameras/camera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import type { Scene } from "@babylonjs/core/scene";
import HavokPhysics from "@babylonjs/havok";
import HavokInit from "../../node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import { setupInspector } from "./inspector_setup";
import { setupPlayerCamera } from "./player_camera_setup";
// Side-effect imports
import "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Physics/v2/physicsEngineComponent";

export async function setupScene(scene: Scene, isServer = false) {
  scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);

  if (isServer) {
    // Minimal camera so Babylon doesn't complain about a missing active camera
    new Camera("camera", Vector3.Zero(), scene);

    // Physics (must be enabled before any PhysicsAggregate is created)
    console.debug("Loading Havok physics...");
    const wasmBinary = await fetch(HavokInit).then((res) => res.arrayBuffer());
    const havokInstance = await HavokPhysics({ wasmBinary });
    const havokPlugin = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(new Vector3(0, -9.8, 0), havokPlugin);
    scene
      .getPhysicsEngine()
      ?.setTimeStep(scene.getEngine().getTimeStep() / 1000);
    console.debug("Havok physics loaded and enabled in the scene.");
  } else {
    setupPlayerCamera(scene);

    // Physics
    const havokInstance = await HavokPhysics();
    const havokPlugin = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(new Vector3(0, -9.8, 0), havokPlugin);
    // scene
    //   .getPhysicsEngine()
    //   ?.setTimeStep(scene.getEngine().getTimeStep() / 1000);

    // Light
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
    light.intensity = 0.9;
  }

  // create anchor for constraints
  const anchor = new TransformNode("PhysicsAnchor", scene);
  anchor.position.y = -10;
  new PhysicsAggregate(anchor, PhysicsShapeType.BOX, { mass: 0 }, scene);

  // Ground
  const ground = CreateGround("ground", { width: 20, height: 20 }, scene);
  const groundMat = new StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new Color3(0.2, 0.2, 0.25);
  groundMat.specularColor = new Color3(0.1, 0.1, 0.1);
  ground.material = groundMat;
  new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);

  // Walls
  const wallMat = new StandardMaterial("wallNMat", scene);
  wallMat.diffuseColor = new Color3(0.5, 0.5, 0.35);
  wallMat.specularColor = new Color3(0.1, 0.1, 0.1);
  const wallN = CreateBox("wallN", { width: 20, height: 2, depth: 0.5 }, scene);
  wallN.position.set(0, 1, 10);
  new PhysicsAggregate(wallN, PhysicsShapeType.BOX, { mass: 0 }, scene);
  wallN.material = wallMat;
  const wallS = CreateBox("wallS", { width: 20, height: 2, depth: 0.5 }, scene);
  wallS.position.set(0, 1, -10);
  new PhysicsAggregate(wallS, PhysicsShapeType.BOX, { mass: 0 }, scene);
  wallS.material = wallMat;
  const wallE = CreateBox("wallE", { width: 0.5, height: 2, depth: 20 }, scene);
  wallE.position.set(10, 1, 0);
  new PhysicsAggregate(wallE, PhysicsShapeType.BOX, { mass: 0 }, scene);
  wallE.material = wallMat;
  const wallW = CreateBox("wallW", { width: 0.5, height: 2, depth: 20 }, scene);
  wallW.position.set(-10, 1, 0);
  new PhysicsAggregate(wallW, PhysicsShapeType.BOX, { mass: 0 }, scene);
  wallW.material = wallMat;

  if (!isServer) {
    setupInspector(scene);
  }
}
