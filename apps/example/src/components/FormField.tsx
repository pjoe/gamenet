const accentClasses = {
  blue: "focus:ring-blue-500",
  green: "focus:ring-green-500",
};

function FormField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  required,
  maxLength,
  min,
  max,
  mono,
  accentColor = "blue",
}: {
  id: string;
  label: string;
  type?: "text" | "number";
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  mono?: boolean;
  accentColor?: "blue" | "green";
}) {
  return (
    <div className="mb-6">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2 transition-colors duration-200"
      >
        {label}
      </label>
      <input
        type={type}
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
        min={min}
        max={max}
        className={`w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:ring-2 ${accentClasses[accentColor]} focus:border-transparent bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-200${mono ? " font-mono text-lg" : ""}`}
      />
    </div>
  );
}

export default FormField;
