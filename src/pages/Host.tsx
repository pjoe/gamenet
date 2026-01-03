import { Channel, GameServer, hostGame } from "@gamenet";
import { useEffect, useState } from "react";

function Host() {
  const [isHosting, setIsHosting] = useState(false);
  const [_messages, setMessages] = useState<string[]>([]);
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
      const _interval = setInterval(() => {
        setClients((clients) => [...clients]);
      }, 1000);
    });
    setGameServer(server);
    setIsHosting(true);
  };

  return (
    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3 transition-colors duration-200">
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
          <div className="space-y-4">
            <div className="bg-[var(--color-bg-primary)] rounded-lg shadow p-4 transition-colors duration-200">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2 transition-colors duration-200">
                  Your Game Code
                </h2>
                <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 mb-3 transition-colors duration-200">
                  <p className="text-3xl font-mono font-bold text-[var(--color-accent-blue)] transition-colors duration-200">
                    {gameServer?.serverId}
                  </p>
                </div>
                <p className="text-[var(--color-text-secondary)] text-sm mb-2 transition-colors duration-200">
                  Share this code with players to let them join your game.
                </p>
                <div className="bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-lg p-2 transition-colors duration-200">
                  <p className="text-[var(--color-success-text)] text-sm transition-colors duration-200">
                    ✓ Game session is active
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[var(--color-bg-primary)] rounded-lg shadow p-4 transition-colors duration-200">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 transition-colors duration-200">
                Connected Clients ({clients.length})
              </h2>
              {clients.length === 0 ? (
                <p className="text-[var(--color-text-secondary)] text-sm text-center py-4 transition-colors duration-200">
                  No clients connected yet. Share your game code to get started!
                </p>
              ) : (
                <div className="space-y-2">
                  {clients.map((client) => (
                    <div
                      key={client.clientId}
                      className="bg-[var(--color-bg-tertiary)] rounded-lg p-3 flex items-center justify-between transition-colors duration-200"
                    >
                      <div>
                        <p className="font-mono text-[var(--color-text-primary)] transition-colors duration-200">
                          {client.clientId}
                        </p>
                      </div>
                      <div className="text-sm text-[var(--color-text-secondary)] transition-colors duration-200">
                        Ping: {client.latency.toFixed(2)}ms
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Host;
