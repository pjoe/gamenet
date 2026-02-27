import { Scene } from "@babylonjs/core/scene";
import { GameClient } from "@gamenet/core";
import { setupScene } from "./scene_setup";

export function setupBabylonClient(gameClient: GameClient, scene: Scene) {
  console.debug("Setting up Babylon.js client scene...");
  setupScene(scene, false);
}
