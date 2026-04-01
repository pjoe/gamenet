import type {
  ClientsPingListEntry,
  ClientsPingListPayload,
} from "@gamenet/core";
import { useGame } from "@gamenet/core/react";
import { DebugPanel, useDebugStats } from "@gamenet/example-ui";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import BabylonScene from "../components/BabylonScene";
import GameSidebar from "../components/GameSidebar";
import { setupBabylonClient } from "../game/client";

function Game() {
  const { session, endSession } = useGame();
  const navigate = useNavigate();
  const [clientPingList, setClientPingList] = useState<ClientsPingListEntry[]>(
    []
  );
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
    <div className="relative w-full" style={{ height: "calc(100vh - 4rem)" }}>
      <BabylonScene
        onSceneReady={(scene) => setupBabylonClient(gameClient, scene)}
      />
      <GameSidebar
        serverId={serverId}
        isHost={isHost}
        clientId={gameClient.clientId}
        nickname={currentClientEntry?.nickname}
        clientPingList={clientPingList}
        extraLatency={extraLatency}
        onExtraLatencyChange={handleExtraLatencyChange}
        onLeaveGame={handleLeaveGame}
      />
      <DebugPanel stats={stats} onReset={resetStats} />
    </div>
  );
}

export default Game;
