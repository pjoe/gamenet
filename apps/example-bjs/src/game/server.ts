import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import {
  NullEngine,
  type NullEngineOptions,
} from "@babylonjs/core/Engines/nullEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { Scene } from "@babylonjs/core/scene";
import HavokPhysics from "@babylonjs/havok";
import HavokInit from "../../node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";

const DEFAULT_NULL_ENGINE_OPTIONS: NullEngineOptions = {
  renderWidth: 1,
  renderHeight: 1,
  textureSize: 512,
  deterministicLockstep: true,
  lockstepMaxSteps: 4,
  timeStep: 1.0 / 64, // 64 ticks per second
};

export async function setupBabylonServer() {
  console.debug("Setting up Babylon.js server...");
  //engine
  const engine = new NullEngine({
    ...DEFAULT_NULL_ENGINE_OPTIONS,
  });

  //scene
  const scene = new Scene(engine);
  // dummy camera
  new FreeCamera("dummy", new Vector3(0, 0, 0), scene);

  // physics
  console.debug("Loading Havok physics...");
  const wasmBinary = await fetch(HavokInit).then((res) => res.arrayBuffer());
  const havokInstance = await HavokPhysics({ wasmBinary });
  const havokPlugin = new HavokPlugin(true, havokInstance);
  scene.enablePhysics(new Vector3(0, -9.8, 0), havokPlugin);
  scene.getPhysicsEngine()?.setTimeStep(engine.getTimeStep() / 1000);
  console.debug("Havok physics loaded and enabled in the scene.");

  let frame = 0;
  const render = () => {
    setTimeout(render, engine.getTimeStep());
    engine.beginFrame();
    scene.render();
    if (engine._gl) {
      engine.endFrame();
    }
    ++frame;
    if (frame % 64 === 0) {
      // console.debug(`Server time: ${frame / 64}`);
    }
  };

  render();

  console.debug("Babylon.js server setup complete");
}
