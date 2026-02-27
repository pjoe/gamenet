import type { ClientsPingListEntry } from "@gamenet/core";
import {
  ActionButton,
  Card,
  ClientList,
  ExtraLatencyInput,
} from "@gamenet/example-ui";
import { useState } from "react";

function GameSidebar({
  serverId,
  isHost,
  clientId,
  nickname,
  clientPingList,
  extraLatency,
  onExtraLatencyChange,
  onLeaveGame,
}: {
  serverId: string;
  isHost: boolean;
  clientId: string;
  nickname: string | undefined;
  clientPingList: ClientsPingListEntry[];
  extraLatency: number;
  onExtraLatencyChange: (value: number) => void;
  onLeaveGame: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <>
      {/* Toggle button — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed top-20 z-50 flex items-center justify-center w-8 h-10 rounded-r-lg bg-[var(--color-bg-primary)]/80 backdrop-blur border border-l-0 border-[var(--color-border)] text-[var(--color-text-primary)] shadow-md transition-all duration-300"
        style={{ left: open ? "20rem" : 0 }}
        aria-label={open ? "Close sidebar" : "Open sidebar"}
      >
        <svg
          className="w-4 h-4 transition-transform duration-300"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Sidebar panel */}
      <div
        className="fixed top-16 bottom-0 z-40 w-80 bg-[var(--color-bg-primary)]/90 backdrop-blur-md border-r border-[var(--color-border)] shadow-lg overflow-y-auto transition-transform duration-300 ease-in-out"
        style={{ transform: open ? "translateX(0)" : "translateX(-100%)" }}
      >
        <div className="p-4 space-y-4">
          {/* Header */}
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] transition-colors duration-200">
            {isHost ? "Hosting Game" : "In Game"}
          </h2>

          {/* Game Code */}
          <Card padding="sm">
            <div className="text-center">
              <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 transition-colors duration-200">
                Game Code
              </p>
              <p className="text-2xl font-mono font-bold text-[var(--color-accent-blue)] transition-colors duration-200">
                {serverId}
              </p>
              <p className="text-[var(--color-text-secondary)] text-xs mt-1 transition-colors duration-200">
                {isHost
                  ? "Share this code with players"
                  : `Connected as ${nickname ?? clientId}`}
              </p>
            </div>
          </Card>

          {/* Connected Clients */}
          <Card padding="sm">
            <ClientList clients={clientPingList} isHost={isHost} />
          </Card>

          {/* Extra Latency */}
          <Card padding="sm">
            <ExtraLatencyInput
              value={extraLatency}
              onChange={onExtraLatencyChange}
            />
          </Card>

          {/* Leave Game */}
          <ActionButton color="red" onClick={onLeaveGame}>
            Leave Game
          </ActionButton>
        </div>
      </div>
    </>
  );
}

export default GameSidebar;
