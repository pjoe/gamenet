import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";
import type { Scene } from "@babylonjs/core/scene";
import type { GameClient } from "@gamenet/core";

const INPUT_KEYS = new Set(["w", "a", "s", "d"]);
const TICK_INTERVAL_MS = 1000 / 32; // 32 Hz

export function setupPlayerInput(gameClient: GameClient, scene: Scene) {
  const pressed = new Set<string>();

  // Track key state via Babylon's keyboard observable
  scene.onKeyboardObservable.add((info) => {
    const key = info.event.key.toLowerCase();
    if (!INPUT_KEYS.has(key)) return;

    if (info.type === KeyboardEventTypes.KEYDOWN) {
      pressed.add(key);
    } else if (info.type === KeyboardEventTypes.KEYUP) {
      pressed.delete(key);
    }
  });

  // Emit camera-relative direction at a fixed 32 Hz tick
  let accumulator = 0;

  scene.onBeforeRenderObservable.add(() => {
    accumulator += scene.getEngine().getDeltaTime() ?? 0;
    if (accumulator < TICK_INTERVAL_MS) return;
    accumulator -= TICK_INTERVAL_MS;

    // Clamp so we don't spiral if the tab was backgrounded
    if (accumulator > TICK_INTERVAL_MS) accumulator = 0;

    const camera = scene.activeCamera as ArcRotateCamera | null;
    if (!camera) return;

    // Build raw input vector from pressed keys
    let rawX = 0;
    let rawZ = 0;
    if (pressed.has("w")) rawZ += 1;
    if (pressed.has("s")) rawZ -= 1;
    if (pressed.has("a")) rawX -= 1;
    if (pressed.has("d")) rawX += 1;

    if (rawX === 0 && rawZ === 0) {
      gameClient.emit("player-input", { dx: 0, dz: 0 });
      return;
    }

    // Derive camera-relative axes on the X/Z plane from camera vectors
    let forwardX = camera.target.x - camera.position.x;
    let forwardZ = camera.target.z - camera.position.z;
    const fLen = Math.sqrt(forwardX * forwardX + forwardZ * forwardZ);
    if (fLen > 0) {
      forwardX /= fLen;
      forwardZ /= fLen;
    }
    // Right = cross(up, forward) projected on XZ (left-handed)
    const rightX = forwardZ;
    const rightZ = -forwardX;

    // Combine and normalize
    let dx = rawX * rightX + rawZ * forwardX;
    let dz = rawX * rightZ + rawZ * forwardZ;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0) {
      dx /= len;
      dz /= len;
    }

    gameClient.emit("player-input", { dx, dz });
  });
}
