import { Scene } from "@babylonjs/core/scene";
import { GameClient } from "@gamenet/core";
import { readCreateEntities } from "./netsync";
import { setupScene } from "./scene_setup";

export async function setupBabylonClient(gameClient: GameClient, scene: Scene) {
  console.debug("Setting up Babylon.js client scene...");
  const setupPromise = setupScene(scene, false);
  gameClient.on("msg", async (data) => {
    await setupPromise;
    console.debug("Received msg:", data);
  });
  gameClient.on("create-entities", async (data) => {
    await setupPromise;
    readCreateEntities(data, scene);
  });
}
