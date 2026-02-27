import {
  HostServerWorkerScope,
  setupHostServerWorker,
} from "./host_server_worker_setup";

console.debug("Host server worker script loaded");

const workerScope = self as unknown as HostServerWorkerScope;

try {
  const server = await setupHostServerWorker(workerScope);

  server.onConnection = (channel) => {
    channel.emit("msg", "Welcome to the server!");
  };
} catch (error) {
  console.error("Failed to setup host server worker", error);
}
