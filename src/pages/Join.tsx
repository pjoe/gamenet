import { GameClient, joinGame } from "@gamenet";
import { useEffect, useState } from "react";

interface JoinProps {
  serverId: string;
  onStateChanged?: (newState: JoinState) => void;
}

type JoinState = "idle" | "joining" | "joined" | "error";

function Join() {
  const [serverId, setServerId] = useState("");
  const [joinState, setJoinState] = useState<JoinState>("idle");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [gameClient, setGameClient] = useState<GameClient>();

  useEffect(() => {
    return () => {
      gameClient?.dispose();
    };
  }, [gameClient]);

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (serverId.trim()) {
      (async () => {
        const client = await joinGame({ serverId: serverId });
        client.onConnected(() => {
          client.onDisconnected(() => setJoinState("idle"));
          setJoinState("joined");
          client.on("*", (type, data) =>
            setMessages((msgs) => [...msgs, `${type}: ${JSON.stringify(data)}`])
          );
        });
        setGameClient(client);
      })();
      setJoinState("joining");
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Join a Game</h1>

        {["idle", "joining"].includes(joinState) && (
          <div className="bg-white rounded-lg shadow p-8">
            <p className="text-gray-600 mb-6">
              Enter the game code provided by the host to join the session.
            </p>
            <form onSubmit={handleJoinGame}>
              <div className="mb-6">
                <label
                  htmlFor="gameCode"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Game Code
                </label>
                <input
                  type="text"
                  id="gameCode"
                  disabled={joinState !== "idle"}
                  value={serverId}
                  onChange={(e) =>
                    setServerId(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-lg"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={joinState !== "idle" || serverId.length < 1}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:hover:bg-green-400 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 disabled:focus:ring-0"
              >
                Join Game
              </button>
            </form>
          </div>
        )}
        {["joined"].includes(joinState) && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Successfully Joined!
                </h2>
                <p className="text-gray-600">
                  Connected to game:{gameClient?.serverId} as{" "}
                  {gameClient?.clientId}
                  <span className="font-mono font-semibold">{serverId}</span>
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  Waiting for host to start the game...
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Join;
