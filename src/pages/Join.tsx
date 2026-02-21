import { joinGame } from "@gamenet";
import { useCallback, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useGame } from "../contexts/GameContext";

type JoinState = "idle" | "joining";

function Join() {
  const [serverId, setServerId] = useState("");
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

  const handleExtraLatencyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newLatency = Math.min(
        2000,
        Math.max(0, parseInt(e.target.value) || 0)
      );
      setExtraLatency(newLatency);
    },
    []
  );
  // If already in a session, redirect to game page
  if (session) {
    return <Navigate to="/game" replace />;
  }
  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-8 transition-colors duration-200">
          Join a Game
        </h1>

        <div className="bg-[var(--color-bg-primary)] rounded-lg shadow p-8 transition-colors duration-200">
          <p className="text-[var(--color-text-secondary)] mb-6 transition-colors duration-200">
            Enter the game code provided by the host to join the session.
          </p>
          <form onSubmit={handleJoinGame}>
            <div className="mb-6">
              <label
                htmlFor="gameCode"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2 transition-colors duration-200"
              >
                Game Code
              </label>
              <input
                type="text"
                id="gameCode"
                disabled={joinState !== "idle"}
                value={serverId}
                onChange={(e) =>
                  setServerId(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-lg bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-200"
                required
              />
            </div>
            <div className="mb-6">
              <label
                htmlFor="nickname"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2 transition-colors duration-200"
              >
                Nickname
              </label>
              <input
                type="text"
                id="nickname"
                disabled={joinState !== "idle"}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter your nickname"
                maxLength={32}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-200"
                required
              />
            </div>
            <div className="mb-6">
              <label
                htmlFor="extraLatency"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2 transition-colors duration-200"
              >
                Extra Latency (ms)
              </label>
              <input
                type="number"
                id="extraLatency"
                value={extraLatency}
                onChange={handleExtraLatencyChange}
                placeholder="0"
                min="0"
                max="2000"
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-lg bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-200"
              />
            </div>
            <button
              type="submit"
              disabled={
                joinState !== "idle" || serverId.length < 1 || !nickname.trim()
              }
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:hover:bg-green-400 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 disabled:focus:ring-0"
            >
              {joinState === "joining" ? "Joining..." : "Join Game"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Join;
