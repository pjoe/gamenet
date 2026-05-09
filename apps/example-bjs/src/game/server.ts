import {
  NullEngine,
  type NullEngineOptions,
} from "@babylonjs/core/Engines/nullEngine";
import { Color3 } from "@babylonjs/core/Maths/math";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { writeCreateEntities, writeEntity } from "@gamenet/bjs";
import { channelReady, GameServer } from "@gamenet/core";
import { addNodeEntity, entityEvents } from "@skyboxgg/bjs-ecs";
import { player } from "./player/player_comp";
import { processPlayerInput } from "./player/player_input_system";
import { setupPlayer } from "./player/player_setup";
import { setupScene } from "./scene_setup";
import { componentSerdes } from "./serdes_config";

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

  // setup scene
  if (scene.isReady()) {
    console.debug("Scene is already ready. Setting up...");
    await setupScene(scene, true);
  } else {
    console.debug("Waiting for scene to be ready...");
    scene.onReadyObservable.addOnce(async () => {
      console.debug("Scene is now ready. Setting up...");
      await setupScene(scene, true);
    });
  }

  // Player input state and movement
  const playerInputs = new Map<string, { dx: number; dz: number }>();
  const playerNodes = new Map<string, TransformNode>();

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

  return {
    onGameServerReady: (gameServer: GameServer) => {
      // handle adding/removing of entities
      entityEvents.on("add", ["netsync"], (entity) => {
        gameServer.broadcast(
          "add-entity",
          writeEntity(entity, componentSerdes),
          {
            reliable: true,
          }
        );
      });
      entityEvents.on("remove", ["netsync"], (entity) => {
        gameServer.broadcast(
          "remove-entity",
          { id: entity.id },
          { reliable: true }
        );
      });

      // each tick, update player positions based on input and broadcast entity states
      let logTime = 0;
      scene.onBeforeRenderObservable.add(() => {
        const dt = engine.getTimeStep() / 1000; // seconds
        logTime += dt;
        for (const [clientId, input] of playerInputs) {
          // if (input.dx === 0 && input.dz === 0) continue;
          const node = playerNodes.get(clientId);
          processPlayerInput(node, input);
        }
        const entities = writeCreateEntities(componentSerdes, true);
        if (logTime >= 20) {
          // console.debug(
          //   `Broadcasting ${entities.length} entities to clients...`,
          //   JSON.stringify(entities)
          // );
          logTime = 0;
        }
        gameServer.broadcast("update-entities", {
          time: Date.now(),
          entities,
        });
      });

      gameServer.onConnection = async (channel) => {
        // initial handshake
        await channelReady(channel);
        await new Promise((resolve) => setTimeout(resolve, 60));

        channel.emit("msg", "Welcome to the babylon server!");

        channel.emit(
          "create-entities",
          writeCreateEntities(componentSerdes, false),
          {
            reliable: true,
          }
        );

        // create player
        const nickname = channel.nickname;
        const color = Color3.Random();
        const { node: playerNode } = setupPlayer(
          {
            id: channel.clientId,
            nickname,
            color: color,
            isServer: true,
          },
          scene
        );
        playerNode.position.x = Math.random() * 4 - 2;
        playerNode.position.z = Math.random() * 4 - 2;
        addNodeEntity(playerNode, [
          player({ id: channel.clientId, nickname, color, isServer: true }),
          "netsync",
        ]);

        // Track player node and listen for input
        playerNodes.set(channel.clientId, playerNode);
        channel.on("player-input", (_, data: { dx: number; dz: number }) => {
          playerInputs.set(channel.clientId, data);
        });

        channel.onDisconnect(() => {
          console.debug(`Client ${channel.clientId} disconnected`);
          playerNodes.delete(channel.clientId);
          playerInputs.delete(channel.clientId);
          playerNode.dispose();
        });
      };
    },
  };
}
