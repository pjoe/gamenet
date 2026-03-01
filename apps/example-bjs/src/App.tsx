import { useGame } from "@gamenet/core/react";
import { ThemeToggle } from "@gamenet/example-ui";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import Game from "./pages/Game";
import Home from "./pages/Home";
import Host from "./pages/Host";
import Join from "./pages/Join";

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center px-1 pt-1 text-sm font-medium text-[var(--color-text-primary)] border-b-4 transition-colors duration-200 ${
    isActive
      ? "border-[var(--color-border-active)]"
      : "border-transparent hover:border-[var(--color-border-active)]"
  }`;

function App() {
  const { session } = useGame();

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <div className="min-h-screen bg-[var(--color-bg-secondary)] transition-colors duration-200">
        <nav className="bg-[var(--color-bg-primary)] shadow-sm transition-colors duration-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex space-x-8">
                <NavLink to="/" end className={navLinkClassName}>
                  Home
                </NavLink>
                <NavLink to="/host" end className={navLinkClassName}>
                  Host
                </NavLink>
                <NavLink to="/join" end className={navLinkClassName}>
                  Join
                </NavLink>
                {session && (
                  <NavLink to="/game" end className={navLinkClassName}>
                    Game
                  </NavLink>
                )}
              </div>
              <div className="flex items-center">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </nav>

        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/host" element={<Host />} />
            <Route path="/join" element={<Join />} />
            <Route path="/game" element={<Game />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
