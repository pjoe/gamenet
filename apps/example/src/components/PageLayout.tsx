import type { ReactNode } from "react";

const titleSizeClasses = {
  "2xl": "text-2xl mb-3",
  "3xl": "text-3xl mb-8",
  "4xl": "text-4xl mb-4",
};

function PageLayout({
  title,
  children,
  centered,
  titleSize = "2xl",
  compact,
}: {
  title: string;
  children: ReactNode;
  centered?: boolean;
  titleSize?: "2xl" | "3xl" | "4xl";
  compact?: boolean;
}) {
  return (
    <div
      className={`max-w-7xl mx-auto ${compact ? "py-4" : "py-12"} px-4 sm:px-6 lg:px-8`}
    >
      <div className={centered ? "text-center" : "max-w-2xl mx-auto"}>
        <h1
          className={`font-bold text-[var(--color-text-primary)] transition-colors duration-200 ${titleSizeClasses[titleSize]}`}
        >
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}

export default PageLayout;
