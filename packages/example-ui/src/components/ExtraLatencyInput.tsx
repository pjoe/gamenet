import { useCallback } from "react";
import FormField from "./FormField";

function ExtraLatencyInput({
  value,
  onChange,
  disabled,
  accentColor = "green",
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  accentColor?: "blue" | "green";
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const clamped = Math.min(
        2000,
        Math.max(0, parseInt(e.target.value) || 0)
      );
      onChange(clamped);
    },
    [onChange]
  );

  return (
    <FormField
      id="extraLatency"
      label="Extra Latency (ms)"
      type="number"
      value={value}
      onChange={handleChange}
      placeholder="0"
      min={0}
      max={2000}
      mono
      disabled={disabled}
      accentColor={accentColor}
    />
  );
}

export default ExtraLatencyInput;
