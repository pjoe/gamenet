import type {
  ClientsPingListEntry,
  ClientsPingListPayload,
} from "@gamenet/clients_ping_list";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useGame } from "../contexts/GameContext";

function Game() {
  const { session, endSession } = useGame();
  const navigate = useNavigate();
  const [clientPingList, setClientPingList] = useState<ClientsPingListEntry[]>(
    []
  );
  const [messages, setMessages] = useState<string[]>(() => {
    // Drain any messages that arrived before this component mounted
    if (session && session.pendingMessages.length > 0) {
      const pending = session.pendingMessages.splice(0);
      return pending.map((m) => `${m.type}: ${JSON.stringify(m.data)}`);
    }
    return [];
  });
  const [extraLatency, setExtraLatency] = useState(
    () => session?.gameClient.extraLatency ?? 0
  );

  useEffect(() => {
    if (!session) return;
    let active = true;

    const { gameClient } = session;

    gameClient.onDisconnected(() => {
      if (!active) return;
      endSession();
      navigate("/");
    });

    gameClient.on("clients_ping_list", (data: ClientsPingListPayload) => {
      if (!active) return;
      setClientPingList(data.clients);
    });

    gameClient.on("*", (type: string, data: unknown) => {
      if (!active) return;
      if (type === "clients_ping_list") return;
      // Stop buffering now that we have a live handler
      session.pendingMessages = [];
      setMessages((msgs) => [...msgs, `${type}: ${JSON.stringify(data)}`]);
    });

    return () => {
      active = false;
    };
  }, [session, endSession, navigate]);

  const handleExtraLatencyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newLatency = Math.min(
        2000,
        Math.max(0, parseInt(e.target.value) || 0)
      );
      setExtraLatency(newLatency);
      session?.gameClient.setExtraLatency(newLatency);
    },
    [session]
  );

  const handleLeaveGame = useCallback(() => {
    endSession();
    navigate("/");
  }, [endSession, navigate]);

  if (!session) {
    return <Navigate to="/" replace />;
  }

  const { gameClient, serverId, isHost } = session;
  const currentClientEntry = clientPingList.find(
    (client) => client.clientId === gameClient.clientId
  );

  return (
    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3 transition-colors duration-200">
          {isHost ? "Hosting Game" : "In Game"}
        </h1>

        <div className="space-y-4">
          <div className="bg-[var(--color-bg-primary)] rounded-lg shadow p-4 transition-colors duration-200">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2 transition-colors duration-200">
                Game Code
              </h2>
              <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 mb-3 transition-colors duration-200">
                <p className="text-3xl font-mono font-bold text-[var(--color-accent-blue)] transition-colors duration-200">
                  {serverId}
                </p>
              </div>
              <p className="text-[var(--color-text-secondary)] text-sm mb-2 transition-colors duration-200">
                {isHost
                  ? "Share this code with players to let them join your game."
                  : "Connected as "}
                {!isHost && (
                  <span className="font-semibold">
                    {currentClientEntry?.nickname ?? gameClient.clientId}
                  </span>
                )}
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
              Connected Clients ({clientPingList.length})
            </h2>
            {clientPingList.length === 0 ? (
              <p className="text-[var(--color-text-secondary)] text-sm text-center py-4 transition-colors duration-200">
                No clients connected yet.
                {isHost && " Share your game code to get started!"}
              </p>
            ) : (
              <div className="space-y-2">
                {clientPingList.map((client) => (
                  <div
                    key={client.clientId}
                    className="bg-[var(--color-bg-tertiary)] rounded-lg p-3 flex items-center justify-between transition-colors duration-200"
                  >
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)] transition-colors duration-200">
                        {client.nickname}
                      </p>
                      <p className="font-mono text-xs text-[var(--color-text-secondary)] transition-colors duration-200">
                        {client.clientId}
                      </p>
                    </div>
                    <div className="text-sm text-[var(--color-text-secondary)] transition-colors duration-200">
                      Ping:{" "}
                      {client.pingMs === null
                        ? "N/A"
                        : `${client.pingMs.toFixed(2)}ms`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[var(--color-bg-primary)] rounded-lg shadow p-4 transition-colors duration-200">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] transition-colors duration-200">
                Received Messages ({messages.length})
              </h2>
              <button
                type="button"
                onClick={() => setMessages([])}
                disabled={messages.length === 0}
                className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm font-medium transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Clear Messages
              </button>
            </div>
            {messages.length === 0 ? (
              <p className="text-[var(--color-text-secondary)] text-sm transition-colors duration-200">
                No messages received yet.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {messages.map((message, index) => (
                  <div
                    key={`${index}-${message}`}
                    className="bg-[var(--color-bg-tertiary)] rounded-lg p-3 transition-colors duration-200"
                  >
                    <p className="font-mono text-sm break-all text-[var(--color-text-primary)] transition-colors duration-200">
                      {message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[var(--color-bg-primary)] rounded-lg shadow p-4 transition-colors duration-200">
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
              onChange={handleExtraLatencyChange}
              placeholder="0"
              min="0"
              max="2000"
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-lg bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-200"
            />
          </div>

          <button
            onClick={handleLeaveGame}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition"
          >
            Leave Game
          </button>
        </div>
      </div>
    </div>
  );
}

export default Game;
