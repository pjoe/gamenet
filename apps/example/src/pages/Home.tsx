import { Link } from "react-router-dom";
import { version } from "../../package.json" with { type: "json" };

function Home() {
  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-4 transition-colors duration-200">
          Welcome to GameNet
        </h1>
        <p className="text-xl text-[var(--color-text-secondary)] mb-8 transition-colors duration-200">
          Multiplayer gaming made simple
        </p>
        <div className="bg-[var(--color-bg-primary)] rounded-lg shadow p-6 max-w-md mx-auto transition-colors duration-200">
          <p className="text-sm text-[var(--color-text-secondary)] transition-colors duration-200">
            GameNet Library v{version}
          </p>
          <div className="mt-6 space-y-4">
            <Link
              to="/host"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition"
            >
              Host a Game
            </Link>
            <Link
              to="/join"
              className="block w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition"
            >
              Join a Game
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
