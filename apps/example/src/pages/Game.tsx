import type {
  ClientsPingListEntry,
  ClientsPingListPayload,
} from "@gamenet/core";
import { useGame } from "@gamenet/core/react";
import {
  ActionButton,
  Card,
  ClientList,
  ExtraLatencyInput,
  PageLayout,
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
      </div>
    </PageLayout>
  );
}

export default Game;
