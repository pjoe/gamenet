import { GameClient, joinGame } from "@gamenet";
import { useEffect, useState } from "react";

type JoinState = "idle" | "joining" | "joined" | "error";

interface ClientsPingListEntry {
  clientId: string;
  pingMs: number | null;
}

interface ClientsPingListPayload {
  ts: number;
  clients: ClientsPingListEntry[];
}

function isClientsPingListPayload(
  value: unknown
): value is ClientsPingListPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<ClientsPingListPayload>;
  if (!Array.isArray(payload.clients)) {
    return false;
  }

  return payload.clients.every((client) => {
    if (!client || typeof client !== "object") {
      return false;
    }

    const entry = client as Partial<ClientsPingListEntry>;
    const pingIsValid =
      entry.pingMs === null ||
      (typeof entry.pingMs === "number" && Number.isFinite(entry.pingMs));

    return typeof entry.clientId === "string" && pingIsValid;
  });
}

function Join() {
  const [serverId, setServerId] = useState("");
  const [extraLatency, setExtraLatency] = useState(0);
  const [joinState, setJoinState] = useState<JoinState>("idle");
  const [_message, _setMessage] = useState("");
  const [_messages, setMessages] = useState<string[]>([]);
  const [gameClient, setGameClient] = useState<GameClient>();
  const [clientPingList, setClientPingList] = useState<ClientsPingListEntry[]>(
    []
  );

  useEffect(() => {
    return () => {
      gameClient?.dispose();
    };
  }, [gameClient]);

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (serverId.trim()) {
      (async () => {
        const client = await joinGame({
          serverId: serverId,
          extraLatency: extraLatency,
        });
        client.onConnected(() => {
          client.onDisconnected(() => {
            setJoinState("idle");
            setClientPingList([]);
          });
          setJoinState("joined");
          client.on("*", (type, data) => {
            if (type === "clients_ping_list") {
              if (isClientsPingListPayload(data)) {
                setClientPingList(data.clients);
              }
              return;
            }

            setMessages((msgs) => [
              ...msgs,
              `${type}: ${JSON.stringify(data)}`,
            ]);
          });
        });
        setGameClient(client);
      })();
      setClientPingList([]);
      setJoinState("joining");
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-8 transition-colors duration-200">
          Join a Game
        </h1>

        {["idle", "joining"].includes(joinState) && (
          <div className="bg-[var(--color-bg-primary)] rounded-lg shadow p-8 transition-colors duration-200">
            <p className="text-[var(--color-text-secondary)] mb-6 transition-colors duration-200">
              Enter the game code provided by the host to join the session.
            </p>
            <form onSubmit={handleJoinGame}>
              <div className="mb-6">
                <label
                  htmlFor="gameCode"
                  className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2 transition-colors duration-200"
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
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-lg bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-200"
                  required
                />
              </div>
              <div className="mb-6">
                <label
                  htmlFor="extraLatency"
                  className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2 transition-colors duration-200"
                >
                  Extra Latency (ms)
                </label>
                <input
                  type="number"
                  id="extraLatency"
                  value={extraLatency}
                  onChange={(e) => {
                    const newLatency = Math.min(
                      2000,
                      Math.max(0, parseInt(e.target.value) || 0)
                    );
                    setExtraLatency(newLatency);
                    if (gameClient) {
                      gameClient.extraLatency = newLatency;
                    }
                  }}
                  placeholder="0"
                  min="0"
                  max="2000"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-lg bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-200"
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
          <div className="bg-[var(--color-bg-primary)] rounded-lg shadow p-8 transition-colors duration-200">
            <div className="text-center">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--color-success-bg)] rounded-full mb-4 transition-colors duration-200">
                  <svg
                    className="w-8 h-8 text-[var(--color-success-text)] transition-colors duration-200"
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
                <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2 transition-colors duration-200">
                  Successfully Joined!
                </h2>
                <p className="text-[var(--color-text-secondary)] transition-colors duration-200">
                  Connected to game:{" "}
                  <span className="font-mono font-semibold">
                    {gameClient?.serverId}
                  </span>{" "}
                  as{" "}
                  <span className="font-mono font-semibold">
                    {gameClient?.clientId}
                  </span>
                  <br />
                  Extra latency:{" "}
                  <span className="font-mono font-semibold">
                    {gameClient?.extraLatency}ms
                  </span>
                </p>
              </div>
              <div className="bg-[var(--color-info-bg)] border border-[var(--color-info-border)] rounded-lg p-4 transition-colors duration-200">
                <p className="text-[var(--color-info-text)] text-sm transition-colors duration-200">
                  Waiting for host to start the game...
                </p>
              </div>

              <div className="mt-6 text-left">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 transition-colors duration-200">
                  Connected Clients ({clientPingList.length})
                </h3>
                {clientPingList.length === 0 ? (
                  <p className="text-[var(--color-text-secondary)] text-sm transition-colors duration-200">
                    No clients connected yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {clientPingList.map((client) => (
                      <div
                        key={client.clientId}
                        className="bg-[var(--color-bg-tertiary)] rounded-lg p-3 flex items-center justify-between transition-colors duration-200"
                      >
                        <p className="font-mono text-[var(--color-text-primary)] transition-colors duration-200">
                          {client.clientId}
                        </p>
                        <p className="text-sm text-[var(--color-text-secondary)] transition-colors duration-200">
                          Ping:{" "}
                          {client.pingMs === null
                            ? "N/A"
                            : `${client.pingMs.toFixed(2)}ms`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6">
              <label
                htmlFor="extraLatencyJoined"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2 transition-colors duration-200"
              >
                Extra Latency (ms)
              </label>
              <input
                type="number"
                id="extraLatencyJoined"
                value={extraLatency}
                onChange={(e) => {
                  const newLatency = Math.min(
                    2000,
                    Math.max(0, parseInt(e.target.value) || 0)
                  );
                  setExtraLatency(newLatency);
                  if (gameClient) {
                    gameClient.extraLatency = newLatency;
                  }
                }}
                placeholder="0"
                min="0"
                max="2000"
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-lg bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-200"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Join;
