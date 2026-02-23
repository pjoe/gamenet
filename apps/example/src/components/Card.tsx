import type { ReactNode } from "react";

const paddingClasses = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

function Card({
  children,
  padding = "lg",
  className = "",
}: {
  children: ReactNode;
  padding?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div
      className={`bg-[var(--color-bg-primary)] rounded-lg shadow transition-colors duration-200 ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  );
}

export default Card;
