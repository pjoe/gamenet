import { Camera } from "@babylonjs/core/Cameras/camera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import type { Scene } from "@babylonjs/core/scene";
import HavokPhysics from "@babylonjs/havok";
import { setupInspector } from "@gamenet/bjs";
import HavokInit from "../../node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import { setupPlayerCamera } from "./player/player_camera_setup";
// Side-effect imports
import "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import { addNodeEntity } from "@skyboxgg/bjs-ecs";
import { setupLevel } from "./level_setup";
import { sphere } from "./sphere/sphere_comp";
import { setupSphere } from "./sphere/sphere_setup";

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

  // Level
  setupLevel(scene);

  if (isServer) {
    // Create sphere as a netsync ECS entity
    const diffuseColor = new Color3(0.7, 0.8, 0.9);
    const specularColor = new Color3(0.4, 0.4, 0.4);
    const { node: sphereNode } = setupSphere(
      { diameter: 1.5, segments: 32, diffuseColor, specularColor },
      scene
    );
    sphereNode.position.y = 0.75;
    addNodeEntity(sphereNode, [
      sphere({ diameter: 1.5, segments: 32, diffuseColor, specularColor }),
      "netsync",
    ]);
  }

  if (!isServer) {
    setupInspector(scene);
  }
}
