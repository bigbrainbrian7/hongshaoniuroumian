type ThresholdControlProps = {
  threshold: number;
  onChange: (threshold: number) => void;
};

export function ThresholdControl({ threshold, onChange }: ThresholdControlProps) {
  return (
    <label className="threshold-control">
      <span>Anomaly Threshold: {threshold.toFixed(2)}</span>
      <input
        type="range"
        min="0.5"
        max="1"
        step="0.01"
        value={threshold}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
