import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import {
  NullEngine,
  type NullEngineOptions,
} from "@babylonjs/core/Engines/nullEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";

const DEFAULT_NULL_ENGINE_OPTIONS: NullEngineOptions = {
  renderWidth: 1,
  renderHeight: 1,
  textureSize: 512,
  deterministicLockstep: true,
  lockstepMaxSteps: 4,
  timeStep: 1.0 / 64, // 64 ticks per second
};

export function setupBabylonServer() {
  console.debug("Setting up Babylon.js server...");
  const engine = new NullEngine({
    ...DEFAULT_NULL_ENGINE_OPTIONS,
  });
  const scene = new Scene(engine);
  // dummy camera
  new FreeCamera("dummy", new Vector3(0, 0, 0), scene);

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
      console.debug(`Server time: ${frame / 64}`);
    }
  };

  render();

  console.debug("Babylon.js server setup complete");
}
