import type {
  ClientsPingListEntry,
  ClientsPingListPayload,
} from "@gamenet/core";
import { useGame } from "@gamenet/core/react";
import {
  ActionButton,
  Card,
  ClientList,
  DebugPanel,
  ExtraLatencyInput,
  PageLayout,
  useDebugStats,
} from "@gamenet/example-ui";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

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
  const { stats, recordMessage, reset: resetStats } = useDebugStats();

  useEffect(() => {
    if (!session) return;
    let active = true;

    const { gameClient } = session;

    gameClient.onMessageStats((e) => {
      if (active) recordMessage(e.type, e.bytes);
    });

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
  }, [session, endSession, navigate, recordMessage]);

  const handleExtraLatencyChange = useCallback(
    (value: number) => {
      setExtraLatency(value);
      session?.gameClient.setExtraLatency(value);
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
    <PageLayout title={isHost ? "Hosting Game" : "In Game"} compact>
      <div className="space-y-4">
        <Card padding="sm">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2 transition-colors duration-200">
              Game Code
            </h2>
            <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 mb-3 transition-colors duration-200">
              <div className="flex items-center justify-center gap-2">
                <p className="text-3xl font-mono font-bold text-[var(--color-accent-blue)] transition-colors duration-200">
                  {serverId}
                </p>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(serverId)}
                  className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors duration-200"
                  aria-label="Copy game code"
                  title="Copy game code"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/join?code=${serverId}`;
                    navigator.clipboard.writeText(url);
                  }}
                  className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors duration-200"
                  aria-label="Copy join link"
                  title="Copy join link"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </button>
              </div>
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
        </Card>

        <Card padding="sm">
          <ClientList clients={clientPingList} isHost={isHost} />
        </Card>

        <Card padding="sm">
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
        </Card>

        <Card padding="sm">
          <ExtraLatencyInput
            value={extraLatency}
            onChange={handleExtraLatencyChange}
          />
        </Card>

        <ActionButton color="red" onClick={handleLeaveGame}>
          Leave Game
        </ActionButton>

        <DebugPanel stats={stats} onReset={resetStats} />
      </div>
    </PageLayout>
  );
}

export default Game;
