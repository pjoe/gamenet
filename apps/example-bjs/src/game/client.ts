import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { createSnapshotVault, GameClient } from "@gamenet/core";
import { queryXforms, removeEntity, xform } from "@skyboxgg/bjs-ecs";
import { readCreateEntities, readEntity, ServerEntityIdMap } from "./netsync";
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
  let lastServerUpdateTime = 0;
  gameClient.on(
    "update-entities",
    async (data: { time: number; entities: unknown[] }) => {
      if (data.time < lastServerUpdateTime) {
        // ignore out-of-order update
        return;
      }
      lastServerUpdateTime = data.time;
      // readUpdateEntities(data.entities, serverIdMap);

      // store entitiy diffs
      const entities = data.entities as Array<{
        id: number;
        name: string;
        comps: Array<{ k: string; v?: unknown }>;
      }>;
      entities.forEach((e) => {
        const existingEntity = serverIdMap.get(e.id);
        if (existingEntity) {
          const xformComp = e.comps.find((c) => c.k === "xform")?.v as
            | {
                pos: Vector3;
                quat: Quaternion;
              }
            | undefined;
          if (xformComp) {
            const existingXform = existingEntity.comps.xform;
            const xformVal = (existingXform as ReturnType<typeof xform>).value;
            // lookup in snapshot vault
            const vaultXform = vault.query(
              existingEntity.id,
              "xform",
              data.time - gameClient.timeDiff
            ) as { pos: Vector3; quat: Quaternion } | null;
            if (xformVal && vaultXform) {
              const pos = new Vector3().copyFrom(xformComp.pos);
              const quat = new Quaternion().copyFrom(xformComp.quat);
              const netDiff = {
                pos: pos.subtract(vaultXform.pos),
                quat: quat.multiply(vaultXform.quat.conjugate()),
              };
              xformVal.metadata = xformVal.metadata ?? {};
              xformVal.metadata.netDiff = netDiff;
              xformVal.metadata.serverXform = {
                pos,
                quat,
              };
            }
          }
        }
      });
    }
  );

  // reconcile
  scene.onBeforeRenderObservable.add(() => {
    const xformEntities = queryXforms(["netsync"]);
    const dt = scene.getEngine().getDeltaTime() / 1000;
    for (const e of xformEntities) {
      const xform = e.xform;
      if (xform.metadata?.netDiff) {
        const netDiff: { pos: Vector3; quat: Quaternion } =
          xform.metadata.netDiff;
        const serverXform = xform.metadata.serverXform;

        const posChange = netDiff.pos.scale(10 * dt);
        xform.position.addInPlace(posChange);
        netDiff.pos.subtractInPlace(posChange);

        //xform.position.copyFrom(serverXform.pos);
        xform.rotationQuaternion!.copyFrom(serverXform.quat);
      }
    }
  });

  // client snapshots (capped at 64 Hz)
  const snapshotIntervalMs = 1000 / 64;
  let lastSnapshotTime = 0;
  scene.onAfterRenderObservable.add(() => {
    const now = Date.now();
    const delta = now - lastSnapshotTime;
    if (delta < snapshotIntervalMs) return;
    if (lastSnapshotTime === 0) {
      lastSnapshotTime = now;
    } else {
      if (delta > snapshotIntervalMs * 1.2) {
        lastSnapshotTime = now;
      } else {
        lastSnapshotTime += snapshotIntervalMs;
      }
    }
    const snapshotXforms = queryXforms(["netsync"]).map((e) => ({
      id: e.id,
      pos: e.xform.position,
      quat:
        e.xform.rotationQuaternion ??
        Quaternion.FromEulerVector(e.xform.rotation),
    }));
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
