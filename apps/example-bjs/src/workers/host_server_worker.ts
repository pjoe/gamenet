import {
  type HostServerWorkerScope,
  setupHostServerWorker,
} from "@gamenet/core/worker-setup";
import { setupBabylonServer } from "./gameserver";

console.debug("Host server worker script loaded");

const workerScope = self as unknown as HostServerWorkerScope;

try {
  setupBabylonServer();
  const server = await setupHostServerWorker(workerScope);

  server.onConnection((channel) => {
    channel.emit("msg", "Welcome to the server!");
  });
} catch (error) {
  console.error("Failed to setup host server worker", error);
}
