import { GameServer, hostGame } from "./game_server";
import { GameClient, joinGame } from "./game_client";
import { amplifySignalServer } from "./amplify_signal_server";
import { selectSignalServer } from "./signal_server";

// default signal server
const signalServer = amplifySignalServer();
selectSignalServer(signalServer);

let gameServer: GameServer;
let gameClient: GameClient;

afterAll(() => {
  if (gameServer) {
    console.log("Disposing game server");
    gameServer.dispose();
  }
});

describe("gameNet", () => {
  describe("host game", () => {
    it("hosting game returns server", async () => {
      gameServer = await hostGame();
      expect(gameServer).toBeDefined();
    });
  });

  describe("join game", () => {
    it("joining game returns client", async () => {
      expect(gameServer).toBeDefined();
      gameClient = await joinGame({ serverId: gameServer.serverId });
      expect(gameClient).toBeDefined();
    });
  });
});
