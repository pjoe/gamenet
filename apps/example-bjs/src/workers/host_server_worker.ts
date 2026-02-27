import {
  type HostServerWorkerScope,
  setupHostServerWorker,
} from "@gamenet/core/worker-setup";
import { setupBabylonServer } from "../game/server";

console.debug("Host server worker script loaded");

const workerScope = self as unknown as HostServerWorkerScope;

try {
  const server = await setupHostServerWorker(workerScope);
  const bjsServerPromise = setupBabylonServer();
  server.onConnection = async (channel) => {
    const bjsServer = await bjsServerPromise;
    bjsServer.onGameServerReady(server);
    server.onConnection(channel);
  };
} catch (error) {
  console.error("Failed to setup host server worker", error);
}
