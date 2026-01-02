import { useState } from "react";

function Host() {
  const [gameCode, setGameCode] = useState<string>("");
  const [isHosting, setIsHosting] = useState(false);

  const handleHostGame = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setGameCode(code);
    setIsHosting(true);
  };

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Host a Game</h1>

        {!isHosting ? (
          <div className="bg-white rounded-lg shadow p-8">
            <p className="text-gray-600 mb-6">
              Create a new game session and share the code with your friends.
            </p>
            <button
              onClick={handleHostGame}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition"
            >
              Start Hosting
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Your Game Code
              </h2>
              <div className="bg-gray-100 rounded-lg p-6 mb-6">
                <p className="text-4xl font-mono font-bold text-blue-600">
                  {gameCode}
                </p>
              </div>
              <p className="text-gray-600 mb-4">
                Share this code with players to let them join your game.
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 text-sm">
                  ✓ Game session is active
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Host;
