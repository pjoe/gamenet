import type {
  ClientsPingListEntry,
  ClientsPingListPayload,
} from "@gamenet/core";
import { useGame } from "@gamenet/core/react";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import BabylonScene from "../components/BabylonScene";
import GameSidebar from "../components/GameSidebar";

function Game() {
  const { session, endSession } = useGame();
  const navigate = useNavigate();
  const [clientPingList, setClientPingList] = useState<ClientsPingListEntry[]>(
    []
  );
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
    <div className="relative w-full" style={{ height: "calc(100vh - 4rem)" }}>
      <BabylonScene />
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
    </div>
  );
}

export default Game;
