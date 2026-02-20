import type { GameClient } from "@gamenet/game_client";
import { createContext, useContext, useRef, useState } from "react";

export interface GameSession {
  gameClient: GameClient;
  serverId: string;
  isHost: boolean;
  pendingMessages: { type: string; data: unknown }[];
  dispose: () => void;
}

export type StartSessionArgs = Omit<GameSession, "pendingMessages">;

interface GameContextType {
  session: GameSession | null;
  startSession: (session: StartSessionArgs) => void;
  endSession: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<GameSession | null>(null);
  const sessionRef = useRef<GameSession | null>(null);

  const startSession = (args: StartSessionArgs) => {
    // Clean up any existing session first
    sessionRef.current?.dispose();

    const newSession: GameSession = { ...args, pendingMessages: [] };

    // Buffer early messages so they aren't lost before Game.tsx mounts
    newSession.gameClient.on("*", (type: string, data: unknown) => {
      if (type === "clients_ping_list") return;
      newSession.pendingMessages.push({ type, data });
    });

    sessionRef.current = newSession;
    setSession(newSession);
  };

  const endSession = () => {
    sessionRef.current?.dispose();
    sessionRef.current = null;
    setSession(null);
  };

  return (
    <GameContext.Provider value={{ session, startSession, endSession }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}
