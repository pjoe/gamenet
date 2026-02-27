import { GameClient, joinGame } from "./game_client";
import { Channel, GameServer, hostGame } from "./game_server";
import { selectSignalServer } from "./signal_server";
import {
  createMockSignalServer,
  MockSignalServer,
} from "./test/mock_signal_server";

const TEST_TIMEOUT = 15000;
const STEP_TIMEOUT = 4000;

let gameServer: GameServer;
let gameClient: GameClient;
let signalServer: MockSignalServer;
let activeServer: GameServer | undefined;
let activeClient: GameClient | undefined;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = STEP_TIMEOUT
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function waitForServerEvent(
  channel: Channel,
  eventName: string
): Promise<unknown> {
  return withTimeout(
    new Promise((resolve) => {
      channel.on(eventName, (_, data) => {
        resolve(data);
      });
    })
  );
}

function waitForClientEvent(
  client: GameClient,
  eventName: string
): Promise<unknown> {
  return withTimeout(
    new Promise((resolve) => {
      client.on(eventName, (data) => {
        resolve(data);
      });
    })
  );
}

function waitForConnectedAdapter(client: GameClient): Promise<void> {
  return withTimeout(
    new Promise((resolve) => {
      const checkConnected = () => {
        if (client.adapter) {
          resolve();
          return;
        }
        setTimeout(checkConnected, 20);
      };
      checkConnected();
    })
  );
}

beforeEach(() => {
  signalServer = createMockSignalServer();
  selectSignalServer(signalServer);
});

afterEach(async () => {
  if (activeClient) {
    activeClient.dispose();
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (activeServer) {
    activeServer.dispose();
  }
  signalServer.reset();
  activeClient = undefined;
  activeServer = undefined;
});

describe("gameNet", () => {
  it(
    "hosts and joins game with bidirectional messaging",
    async () => {
      gameServer = await hostGame();
      activeServer = gameServer;
      expect(gameServer).toBeDefined();

      const onConnectionPromise = withTimeout(
        new Promise<Channel>((resolve) => {
          gameServer.onConnection = (channel) => resolve(channel);
        })
      );

      gameClient = await joinGame({
        serverId: gameServer.serverId,
        nickname: "Player One",
      });
      activeClient = gameClient;
      expect(gameClient).toBeDefined();

      const serverChannel = await onConnectionPromise;
      expect(serverChannel.clientId).toBe(gameClient.clientId);
      expect(serverChannel.nickname).toBe("Player One");
      await waitForConnectedAdapter(gameClient);

      const clientsPingList = waitForClientEvent(
        gameClient,
        "clients_ping_list"
      );
      await expect(clientsPingList).resolves.toMatchObject({
        clients: expect.arrayContaining([
          expect.objectContaining({
            clientId: gameClient.clientId,
            nickname: "Player One",
          }),
        ]),
      });

      const fromClientReliable = waitForServerEvent(
        serverChannel,
        "from_client_reliable"
      );
      gameClient.emit(
        "from_client_reliable",
        { source: "client", reliable: true },
        { reliable: true }
      );
      await expect(fromClientReliable).resolves.toEqual({
        source: "client",
        reliable: true,
      });

      const fromClientUnreliable = waitForServerEvent(
        serverChannel,
        "from_client_unreliable"
      );
      gameClient.emit(
        "from_client_unreliable",
        { source: "client", reliable: false },
        { reliable: false }
      );
      await expect(fromClientUnreliable).resolves.toEqual({
        source: "client",
        reliable: false,
      });

      const fromServerReliable = waitForClientEvent(
        gameClient,
        "from_server_reliable"
      );
      serverChannel.emit(
        "from_server_reliable",
        { source: "server", reliable: true },
        { reliable: true }
      );
      await expect(fromServerReliable).resolves.toEqual({
        source: "server",
        reliable: true,
      });

      const fromServerUnreliable = waitForClientEvent(
        gameClient,
        "from_server_unreliable"
      );
      serverChannel.emit(
        "from_server_unreliable",
        { source: "server", reliable: false },
        { reliable: false }
      );
      await expect(fromServerUnreliable).resolves.toEqual({
        source: "server",
        reliable: false,
      });
    },
    TEST_TIMEOUT
  );
});
