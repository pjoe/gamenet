import type { ReactNode } from "react";
import { Link } from "react-router-dom";

const colorClasses = {
  blue: "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400",
  green: "bg-green-600 hover:bg-green-700 disabled:bg-green-400",
  red: "bg-red-600 hover:bg-red-700 disabled:bg-red-400",
};

const sizeClasses = {
  sm: "py-1.5 px-3 text-sm",
  md: "py-3 px-4",
};

function ActionButton({
  color,
  children,
  disabled,
  onClick,
  type = "button",
  size = "md",
  to,
}: {
  color: "blue" | "green" | "red";
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  size?: "sm" | "md";
  to?: string;
}) {
  const className = `w-full ${colorClasses[color]} ${sizeClasses[size]} text-white font-medium rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed`;

  if (to) {
    return (
      <Link to={to} className={`block ${className}`}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
}

export default ActionButton;
