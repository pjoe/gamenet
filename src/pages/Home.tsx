import { version } from "../../package.json";

function Home() {
  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to GameNet
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Multiplayer gaming made simple
        </p>
        <div className="bg-white rounded-lg shadow p-6 max-w-md mx-auto">
          <p className="text-sm text-gray-500">GameNet Library v{version}</p>
          <div className="mt-6 space-y-4">
            <a
              href="/host"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition"
            >
              Host a Game
            </a>
            <a
              href="/join"
              className="block w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition"
            >
              Join a Game
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
