import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { createSnapshotVault, GameClient } from "@gamenet/core";
import { queryXforms, removeEntity } from "@skyboxgg/bjs-ecs";
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
  const vault = createSnapshotVault(64);
  vault.registerSchema("xform", {
    pos: { lerp: (a, b, t) => Vector3.Lerp(a as Vector3, b as Vector3, t) },
    quat: {
      lerp: (a, b, t) => Quaternion.Slerp(a as Quaternion, b as Quaternion, t),
    },
  });
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
      vault.remove(e.id);
    }
  });
  gameClient.on(
    "update-entities",
    async (data: { time: number; entities: unknown[] }) => {
      readUpdateEntities(data.entities, serverIdMap);
    }
  );

  // client snapshots
  scene.onAfterPhysicsObservable.add(() => {
    const snapshotXforms = queryXforms(["netsync"]).map((e) => ({
      id: e.id,
      pos: e.xform.position,
      quat:
        e.xform.rotationQuaternion ??
        Quaternion.FromEulerVector(e.xform.rotation),
    }));
    const now = Date.now();
    snapshotXforms.forEach((snap) => {
      vault.push(snap.id, "xform", now, {
        pos: snap.pos,
        quat: snap.quat,
      });
    });
  });

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
