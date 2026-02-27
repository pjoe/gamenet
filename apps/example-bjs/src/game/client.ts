import { Scene } from "@babylonjs/core/scene";
import { GameClient } from "@gamenet/core";
import { readCreateEntities } from "./netsync";
import { setupScene } from "./scene_setup";

export async function setupBabylonClient(gameClient: GameClient, scene: Scene) {
  console.debug("Setting up Babylon.js client scene...");
  const setupPromise = setupScene(scene, false);

  // initial handshake
  let serverReadyReceived = 0;
  gameClient.on("ready", (ack) => {
    serverReadyReceived = ack + 1;
  });
  for (let i = 0; i < 10; ++i) {
    gameClient.emit("ready", serverReadyReceived, { reliable: true });
    if (serverReadyReceived > 1) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (serverReadyReceived < 1) {
    console.error("Failed to handshake with server");
    throw new Error("Failed to handshake with server");
  }

  gameClient.on("msg", async (data) => {
    await setupPromise;
    console.debug("Received msg:", data);
  });
  gameClient.on("create-entities", async (data) => {
    await setupPromise;
    readCreateEntities(data, scene);
  });
}
