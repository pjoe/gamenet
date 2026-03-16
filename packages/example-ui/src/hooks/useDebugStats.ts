import { useCallback, useEffect, useRef, useState } from "react";

export interface PerTypeStats {
  count: number;
  totalBytes: number;
  avgBytes: number;
  msgsPerSec: number;
}

export interface DebugStats {
  totalMessages: number;
  totalBytes: number;
  messagesPerSec: number;
  bytesPerSec: number;
  avgMessageBytes: number;
  perType: Map<string, PerTypeStats>;
}

interface TypeAccum {
  count: number;
  totalBytes: number;
  /** Timestamps of recent messages for rate calculation */
  recentTimestamps: number[];
}

const RATE_WINDOW_MS = 3000;

function emptyStats(): DebugStats {
  return {
    totalMessages: 0,
    totalBytes: 0,
    messagesPerSec: 0,
    bytesPerSec: 0,
    avgMessageBytes: 0,
    perType: new Map(),
  };
}

export function useDebugStats() {
  const accumRef = useRef<{
    totalMessages: number;
    totalBytes: number;
    recentTimestamps: number[];
    recentBytes: number[];
    perType: Map<string, TypeAccum>;
  }>({
    totalMessages: 0,
    totalBytes: 0,
    recentTimestamps: [],
    recentBytes: [],
    perType: new Map(),
  });

  const [stats, setStats] = useState<DebugStats>(emptyStats);

  const recordMessage = useCallback((type: string, bytes: number) => {
    const acc = accumRef.current;
    const now = Date.now();
    acc.totalMessages++;
    acc.totalBytes += bytes;
    acc.recentTimestamps.push(now);
    acc.recentBytes.push(bytes);

    let typeAcc = acc.perType.get(type);
    if (!typeAcc) {
      typeAcc = { count: 0, totalBytes: 0, recentTimestamps: [] };
      acc.perType.set(type, typeAcc);
    }
    typeAcc.count++;
    typeAcc.totalBytes += bytes;
    typeAcc.recentTimestamps.push(now);
  }, []);

  const reset = useCallback(() => {
    accumRef.current = {
      totalMessages: 0,
      totalBytes: 0,
      recentTimestamps: [],
      recentBytes: [],
      perType: new Map(),
    };
    setStats(emptyStats());
  }, []);

  // Periodically compute stats snapshot for rendering
  useEffect(() => {
    const interval = setInterval(() => {
      const acc = accumRef.current;
      const now = Date.now();
      const cutoff = now - RATE_WINDOW_MS;

      // Prune global sliding window
      while (
        acc.recentTimestamps.length > 0 &&
        acc.recentTimestamps[0] < cutoff
      ) {
        acc.recentTimestamps.shift();
        acc.recentBytes.shift();
      }

      const windowSec = RATE_WINDOW_MS / 1000;
      const recentBytesSum = acc.recentBytes.reduce((s, b) => s + b, 0);

      const perType = new Map<string, PerTypeStats>();
      for (const [type, typeAcc] of acc.perType) {
        // Prune per-type sliding window
        while (
          typeAcc.recentTimestamps.length > 0 &&
          typeAcc.recentTimestamps[0] < cutoff
        ) {
          typeAcc.recentTimestamps.shift();
        }
        perType.set(type, {
          count: typeAcc.count,
          totalBytes: typeAcc.totalBytes,
          avgBytes: typeAcc.count > 0 ? typeAcc.totalBytes / typeAcc.count : 0,
          msgsPerSec: typeAcc.recentTimestamps.length / windowSec,
        });
      }

      setStats({
        totalMessages: acc.totalMessages,
        totalBytes: acc.totalBytes,
        messagesPerSec: acc.recentTimestamps.length / windowSec,
        bytesPerSec: recentBytesSum / windowSec,
        avgMessageBytes:
          acc.totalMessages > 0 ? acc.totalBytes / acc.totalMessages : 0,
        perType,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return { stats, recordMessage, reset };
}
