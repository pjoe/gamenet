import { useTheme } from "../contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const themes = [
    {
      value: "light" as const,
      label: "Light",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ),
    },
    {
      value: "dark" as const,
      label: "Dark",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
    },
    {
      value: "system" as const,
      label: "System",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="inline-flex rounded-lg bg-[var(--color-bg-secondary)] p-1 gap-1"
      role="group"
      aria-label="Theme selector"
    >
      {themes.map((themeOption) => {
        const isActive = theme === themeOption.value;

        return (
          <button
            key={themeOption.value}
            onClick={() => setTheme(themeOption.value)}
            className={`
              flex items-center justify-center p-3 rounded-md
              transition-all duration-200
              ${isActive ? "border-2 border-[var(--color-border-active)]" : "border-2 border-transparent"}
              ${!isActive ? "hover:text-[var(--color-text-primary)]" : ""}
            `}
            aria-label={`${themeOption.label} theme`}
            aria-pressed={isActive}
          >
            <span
              className={
                isActive
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)]"
              }
            >
              {themeOption.icon}
            </span>
          </button>
        );
      })}
    </div>
  );
}
