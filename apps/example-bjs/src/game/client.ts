import { Scene } from "@babylonjs/core/scene";
import { GameClient } from "@gamenet/core";
import { readCreateEntities } from "./netsync";
import { setupScene } from "./scene_setup";

export async function setupBabylonClient(gameClient: GameClient, scene: Scene) {
  console.debug("Setting up Babylon.js client scene...");
  const setupPromise = setupScene(scene, false);

  //TODO: improve this
  await new Promise((resolve) => setTimeout(resolve, 300));
  console.debug("Emitting ready event to server...");
  gameClient.emit("ready", undefined, { reliable: true });
  gameClient.on("msg", async (data) => {
    await setupPromise;
    console.debug("Received msg:", data);
  });
  gameClient.on("create-entities", async (data) => {
    await setupPromise;
    readCreateEntities(data, scene);
  });
}
