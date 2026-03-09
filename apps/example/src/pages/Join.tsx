import { joinGame } from "@gamenet/core";
import { useGame } from "@gamenet/core/react";
import {
  ActionButton,
  Card,
  ExtraLatencyInput,
  FormField,
  PageLayout,
} from "@gamenet/example-ui";
import { useCallback, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

type JoinState = "idle" | "joining";

function Join() {
  const [searchParams] = useSearchParams();
  const [serverId, setServerId] = useState(
    () => searchParams.get("code")?.replace(/[^0-9]/g, "")?.slice(0, 7) ?? ""
  );
  const [nickname, setNickname] = useState("");
  const [extraLatency, setExtraLatency] = useState(0);
  const [joinState, setJoinState] = useState<JoinState>("idle");
  const { session, startSession } = useGame();
  const navigate = useNavigate();

  const handleJoinGame = useCallback(
    (e: React.SubmitEvent) => {
      e.preventDefault();
      const normalizedNickname = nickname.trim();
      if (serverId.trim() && normalizedNickname) {
        (async () => {
          const client = await joinGame({
            serverId: serverId,
            nickname: normalizedNickname,
            extraLatency: extraLatency,
          });
          client.onConnected(() => {
            startSession({
              gameClient: client,
              serverId: client.serverId,
              isHost: false,
              dispose() {
                client.dispose();
              },
            });
            navigate("/game");
          });
        })();
        setJoinState("joining");
      }
    },
    [extraLatency, navigate, nickname, serverId, startSession]
  );

  // If already in a session, redirect to game page
  if (session) {
    return <Navigate to="/game" replace />;
  }
  return (
    <PageLayout title="Join a Game" titleSize="3xl">
      <Card>
        <p className="text-[var(--color-text-secondary)] mb-6 transition-colors duration-200">
          Enter the game code provided by the host to join the session.
        </p>
        <form onSubmit={handleJoinGame}>
          <FormField
            id="gameCode"
            label="Game Code"
            value={serverId}
            onChange={(e) => setServerId(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Enter 7-digit code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={7}
            disabled={joinState !== "idle"}
            required
            mono
            accentColor="green"
          />
          <FormField
            id="nickname"
            label="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter your nickname"
            maxLength={32}
            disabled={joinState !== "idle"}
            required
            accentColor="green"
          />
          <ExtraLatencyInput value={extraLatency} onChange={setExtraLatency} />
          <ActionButton
            color="green"
            type="submit"
            disabled={
              joinState !== "idle" || serverId.length < 1 || !nickname.trim()
            }
          >
            {joinState === "joining" ? "Joining..." : "Join Game"}
          </ActionButton>
        </form>
      </Card>
    </PageLayout>
  );
}

export default Join;
