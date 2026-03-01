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
        style={{ left: open ? "13rem" : 0 }}
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
        className="fixed top-16 bottom-0 z-40 w-52 bg-[var(--color-bg-primary)]/60 border-r border-[var(--color-border)] shadow-lg overflow-y-auto transition-transform duration-300 ease-in-out"
        style={{ transform: open ? "translateX(0)" : "translateX(-100%)" }}
      >
        <div className="p-2 space-y-1.5">
          {/* Header */}
          <h2 className="text-sm text-[var(--color-text-secondary)] transition-colors duration-200">
            {isHost ? "Hosting" : "Joined"} as{" "}
            <span className="font-bold text-base text-[var(--color-text-primary)]">
              {nickname ?? clientId}
            </span>
          </h2>

          {/* Game Code */}
          <Card padding="xs">
            <p className="text-xs text-[var(--color-text-secondary)] mb-0.5">
              Game Code
            </p>
            <div className="flex items-center gap-1">
              <span className="text-lg font-mono font-bold text-[var(--color-accent-blue)]">
                {serverId}
              </span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(serverId)}
                className="p-0.5 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors duration-200"
                aria-label="Copy game code"
                title="Copy game code"
              >
                <svg
                  className="w-3.5 h-3.5"
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
            </div>
          </Card>

          {/* Connected Clients */}
          <Card padding="xs">
            <ClientList clients={clientPingList} isHost={isHost} />
          </Card>

          {/* Extra Latency */}
          <Card padding="xs">
            <ExtraLatencyInput
              value={extraLatency}
              onChange={onExtraLatencyChange}
            />
          </Card>

          {/* Leave Game */}
          <ActionButton color="red" size="sm" onClick={onLeaveGame}>
            Leave Game
          </ActionButton>
        </div>
      </div>
    </>
  );
}

export default GameSidebar;
