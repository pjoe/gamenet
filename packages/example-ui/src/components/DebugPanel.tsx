import { useState } from "react";
import type { DebugStats } from "../hooks/useDebugStats";
import Card from "./Card";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatRate(perSec: number): string {
  if (perSec < 1) return perSec.toFixed(2);
  if (perSec < 10) return perSec.toFixed(1);
  return Math.round(perSec).toString();
}

function DebugPanel({
  stats,
  onReset,
}: {
  stats: DebugStats;
  onReset?: () => void;
}) {
  const [open, setOpen] = useState(false);

  const sortedTypes = [...stats.perType.entries()].sort(
    ([, a], [, b]) => b.count - a.count
  );

  return (
    <>
      {/* Toggle button — fixed bottom-right */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-50 flex items-center justify-center px-2 py-1.5 rounded-lg bg-[var(--color-bg-primary)]/80 backdrop-blur border border-[var(--color-border)] text-[var(--color-text-secondary)] shadow-md text-xs font-mono hover:text-[var(--color-text-primary)] transition-colors duration-200"
        aria-label={open ? "Close debug panel" : "Open debug panel"}
      >
        <svg
          className="w-3.5 h-3.5 mr-1"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20V10" />
          <path d="M18 20V4" />
          <path d="M6 20v-4" />
        </svg>
        {open ? "Hide" : "Debug"}
      </button>

      {/* Panel overlay */}
      {open && (
        <div className="fixed bottom-12 right-4 z-50 w-80 max-h-[70vh] overflow-y-auto rounded-lg bg-[var(--color-bg-primary)]/95 backdrop-blur border border-[var(--color-border)] shadow-xl">
          <div className="p-3 space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Network Debug
              </h3>
              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  className="text-xs px-2 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors duration-200"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Summary stats */}
            <Card padding="xs">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div className="text-[var(--color-text-secondary)]">
                  Messages
                </div>
                <div className="text-right font-mono text-[var(--color-text-primary)]">
                  {stats.totalMessages.toLocaleString()}
                </div>

                <div className="text-[var(--color-text-secondary)]">
                  Total bytes
                </div>
                <div className="text-right font-mono text-[var(--color-text-primary)]">
                  {formatBytes(stats.totalBytes)}
                </div>

                <div className="text-[var(--color-text-secondary)]">
                  Avg size
                </div>
                <div className="text-right font-mono text-[var(--color-accent-blue)]">
                  {formatBytes(stats.avgMessageBytes)}
                </div>

                <div className="text-[var(--color-text-secondary)]">
                  Msgs/sec
                </div>
                <div className="text-right font-mono text-[var(--color-text-primary)]">
                  {formatRate(stats.messagesPerSec)}
                </div>

                <div className="text-[var(--color-text-secondary)]">
                  Bytes/sec
                </div>
                <div className="text-right font-mono text-[var(--color-text-primary)]">
                  {formatBytes(stats.bytesPerSec)}/s
                </div>
              </div>
            </Card>

            {/* Per-type breakdown */}
            {sortedTypes.length > 0 && (
              <Card padding="xs">
                <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1">
                  Per Message Type
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                        <th className="text-left py-0.5 pr-2 font-medium">
                          Type
                        </th>
                        <th className="text-right py-0.5 px-1 font-medium">
                          #
                        </th>
                        <th className="text-right py-0.5 px-1 font-medium">
                          Avg
                        </th>
                        <th className="text-right py-0.5 px-1 font-medium">
                          Total
                        </th>
                        <th className="text-right py-0.5 pl-1 font-medium">
                          /sec
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTypes.map(([type, typeStats]) => (
                        <tr
                          key={type}
                          className="border-b border-[var(--color-border)]/30"
                        >
                          <td className="py-0.5 pr-2 font-mono text-[var(--color-accent-blue)] truncate max-w-[7rem]">
                            {type}
                          </td>
                          <td className="py-0.5 px-1 text-right font-mono text-[var(--color-text-primary)]">
                            {typeStats.count.toLocaleString()}
                          </td>
                          <td className="py-0.5 px-1 text-right font-mono text-[var(--color-text-primary)]">
                            {formatBytes(typeStats.avgBytes)}
                          </td>
                          <td className="py-0.5 px-1 text-right font-mono text-[var(--color-text-primary)]">
                            {formatBytes(typeStats.totalBytes)}
                          </td>
                          <td className="py-0.5 pl-1 text-right font-mono text-[var(--color-text-primary)]">
                            {formatRate(typeStats.msgsPerSec)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default DebugPanel;
