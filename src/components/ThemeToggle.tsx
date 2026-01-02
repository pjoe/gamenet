import { useTheme } from "../contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const themes = ["light", "dark", "system"] as const;
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const getIcon = () => {
    switch (theme) {
      case "light":
        return "☀️";
      case "dark":
        return "🌙";
      case "system":
        return "⚙️";
    }
  };

  return (
    <button
      onClick={cycleTheme}
      className="inline-flex items-center px-3 py-2 text-lg hover:bg-[var(--color-bg-tertiary)] rounded-md transition-colors duration-200"
      aria-label={`Current theme: ${theme}. Click to cycle themes.`}
      title={`Theme: ${theme}`}
    >
      {getIcon()}
    </button>
  );
}
