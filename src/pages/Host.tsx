import { useEffect, useState } from "react";
import { Channel, GameServer, hostGame } from "@gamenet";

function Host() {
  const [isHosting, setIsHosting] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [clients, setClients] = useState<Channel[]>([]);
  const [gameServer, setGameServer] = useState<GameServer>();

  useEffect(() => {
    return () => {
      gameServer?.dispose();
    };
  }, [gameServer]);

  const handleHostGame = async () => {
    const server = await hostGame();
    server.onConnection((channel) => {
      setClients((clients) => [channel, ...clients]);
      channel.emit("msg", "Welcome to the server!");
      channel.onDisconnect((clientId) => {
        setClients((clients) => clients.filter((c) => c.clientId !== clientId));
      });
      channel.on("*", (from, type, data) =>
        setMessages((msgs) => [
          ...msgs,
          `${from}: ${type}: ${JSON.stringify(data)}`,
        ])
      );
      // update pings
      const interval = setInterval(() => {
        setClients((clients) => [...clients]);
      }, 1000);
    });
    setGameServer(server);
    setIsHosting(true);
  };

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-8 transition-colors duration-200">
          Host a Game
        </h1>

        {!isHosting ? (
          <div className="bg-[var(--color-bg-primary)] rounded-lg shadow p-8 transition-colors duration-200">
            <p className="text-[var(--color-text-secondary)] mb-6 transition-colors duration-200">
              Create a new game session and share the code with your friends.
            </p>
            <button
              onClick={handleHostGame}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition"
            >
              Start Hosting
            </button>
          </div>
        ) : (
          <div className="bg-[var(--color-bg-primary)] rounded-lg shadow p-8 transition-colors duration-200">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4 transition-colors duration-200">
                Your Game Code
              </h2>
              <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-6 mb-6 transition-colors duration-200">
                <p className="text-4xl font-mono font-bold text-[var(--color-accent-blue)] transition-colors duration-200">
                  {gameServer?.serverId}
                </p>
              </div>
              <p className="text-[var(--color-text-secondary)] mb-4 transition-colors duration-200">
                Share this code with players to let them join your game.
              </p>
              <div className="bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-lg p-4 transition-colors duration-200">
                <p className="text-[var(--color-success-text)] text-sm transition-colors duration-200">
                  ✓ Game session is active
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Host;
