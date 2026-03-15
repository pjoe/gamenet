import { Scene } from "@babylonjs/core/scene";
import { GameClient } from "@gamenet/core";
import { removeEntity } from "@skyboxgg/bjs-ecs";
import {
  readCreateEntities,
  readEntity,
  readUpdateEntities,
  ServerEntityIdMap,
} from "./netsync";
import { setupPlayerInput } from "./player_input_system";
import { setupScene } from "./scene_setup";

export async function setupBabylonClient(gameClient: GameClient, scene: Scene) {
  console.debug("Setting up Babylon.js client scene...");
  await setupScene(scene, false);

  // set up message handlers
  const serverIdMap: ServerEntityIdMap = new Map();
  gameClient.on("msg", async (data) => {
    console.debug("Received msg:", data);
  });
  gameClient.on("create-entities", async (data) => {
    readCreateEntities(gameClient, data, serverIdMap, scene);
  });
  gameClient.on("add-entity", async (data) => {
    readEntity(gameClient, data, serverIdMap, scene);
  });
  gameClient.on("remove-entity", async (data) => {
    const e = data as { id: number };
    const clientEntity = serverIdMap.get(e.id);
    if (clientEntity) {
      removeEntity(clientEntity);
      serverIdMap.delete(e.id);
    }
  });
  gameClient.on(
    "update-entities",
    async (data: { time: number; entities: unknown[] }) => {
      readUpdateEntities(data.entities, serverIdMap);
    }
  );

  // initial handshake
  let serverReadyReceived = 0;
  gameClient.on("ready", (ack) => {
    serverReadyReceived = ack + 1;
  });
  for (let i = 0; i < 10; ++i) {
    gameClient.emit("ready", serverReadyReceived, { reliable: true });
    if (serverReadyReceived > 1) {
      console.debug("Handshake with server complete");
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (serverReadyReceived < 1) {
    console.error("Failed to handshake with server");
    throw new Error("Failed to handshake with server");
  }

  setupPlayerInput(gameClient, scene);
}
