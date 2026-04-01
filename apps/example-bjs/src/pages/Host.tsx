import { setupHosting } from "@gamenet/bjs";
import { useGame } from "@gamenet/core/react";
import { ActionButton, Card, FormField, PageLayout } from "@gamenet/example-ui";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

function createWorkerServerWorker() {
  return new Worker(
    new URL("../workers/host_server_worker.ts", import.meta.url),
    { type: "module" }
  );
}

function Host() {
  const [isStarting, setIsStarting] = useState(false);
  const [nickname, setNickname] = useState("Host");
  const { session, startSession } = useGame();
  const navigate = useNavigate();

  if (session) {
    return <Navigate to="/game" replace />;
  }

  const handleHostGame = async () => {
    const normalizedNickname = nickname.trim();
    if (!normalizedNickname) {
      return;
    }

    setIsStarting(true);
    const worker = createWorkerServerWorker();
    const { serverId, gameClient, dispose } = await setupHosting({
      nickname: normalizedNickname,
      worker,
    });

    startSession({
      gameClient,
      serverId,
      isHost: true,
      dispose,
    });
    navigate("/game");
  };

  return (
    <PageLayout title="Host a Game" compact>
      <Card>
        <p className="text-[var(--color-text-secondary)] mb-6 transition-colors duration-200">
          Create a new game session and share the code with your friends.
        </p>
        <FormField
          id="hostNickname"
          label="Nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Enter your nickname"
          maxLength={32}
          disabled={isStarting}
          required
          accentColor="blue"
        />
        <ActionButton
          color="blue"
          onClick={handleHostGame}
          disabled={isStarting || !nickname.trim()}
        >
          {isStarting ? "Starting..." : "Start Hosting"}
        </ActionButton>
      </Card>
    </PageLayout>
  );
}

export default Host;
