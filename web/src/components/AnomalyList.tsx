import type { LogRecord } from "../types";

type AnomalyListProps = {
  anomalies: LogRecord[];
  onSelect: (lineNumber: number) => void;
};

export function AnomalyList({ anomalies, onSelect }: AnomalyListProps) {
  return (
    <aside className="anomaly-list">
      <h2>Anomalies</h2>
      <p>{anomalies.length} visible anomalies</p>
      {anomalies.length === 0 && <span>No anomalies yet.</span>}
      {anomalies.map((log) => (
        <button key={log.line_number} onClick={() => onSelect(log.line_number)}>
          <strong>#{log.line_number}</strong>
          <span>{log.template_similarity?.toFixed(3)}</span>
        </button>
      ))}
    </aside>
  );
}
