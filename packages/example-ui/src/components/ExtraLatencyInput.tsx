import { useCallback } from "react";

function ExtraLatencyInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseInt(e.target.value) || 0);
    },
    [onChange]
  );

  return (
    <div>
      <label
        htmlFor="extraLatency"
        className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2 transition-colors duration-200"
      >
        Extra Latency:{" "}
        <span className="font-mono text-[var(--color-text-primary)]">
          {value} ms
        </span>
      </label>
      <input
        type="range"
        id="extraLatency"
        value={value}
        onChange={handleChange}
        min={0}
        max={250}
        step={10}
        disabled={disabled}
        className="w-full accent-[var(--color-accent-green)]"
      />
    </div>
  );
}

export default ExtraLatencyInput;
