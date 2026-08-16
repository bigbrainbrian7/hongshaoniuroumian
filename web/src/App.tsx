import { useEffect, useState } from "react";

import { LogViewer } from "./components/LogViewer";
import { AnomalyList } from "./components/AnomalyList";
import { PlaybackControls } from "./components/PlaybackControls";
import { ProjectNotes } from "./components/ProjectNotes";
import { ThresholdControl } from "./components/ThresholdControl";
import type { LogRecord } from "./types";

const LOG_FILE = "/data/stream-results.jsonl";
// const LOG_FILE = "/data/test.jsonl";
const PLAYBACK_INTERVAL_MS = 350;
const INITIAL_WINDOW_SIZE = 100;
const SCROLL_ADVANCE = 1;

async function loadLogs(): Promise<LogRecord[]> {
  const response = await fetch(LOG_FILE);
  if (!response.ok) throw new Error(`Could not load ${LOG_FILE}`);

  return (await response.text())
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LogRecord);
}

export function App() {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [revealedCount, setRevealedCount] = useState(INITIAL_WINDOW_SIZE);
  const [threshold, setThreshold] = useState(0.95);
  const [isPlaying, setIsPlaying] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    loadLogs().then((loadedLogs) => {
      setLogs(loadedLogs);
      setRevealedCount(Math.min(INITIAL_WINDOW_SIZE, loadedLogs.length));
    }).catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    if (!isPlaying || logs.length === 0) return;
    const timer = window.setInterval(() => {
      setRevealedCount((count) => Math.min(count + 1, logs.length));
    }, PLAYBACK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isPlaying, logs.length]);

  const advance = () => {
    setRevealedCount((count) => Math.min(count + SCROLL_ADVANCE, logs.length));
  };
  const visibleLogs = logs.slice(0, revealedCount);
  const visibleAnomalies = visibleLogs.filter((log) => (
    log.scored &&
    log.template_similarity !== undefined &&
    log.template_similarity < threshold
  ));

  const focusLog = (lineNumber: number) => {
    document.getElementById(`log-${lineNumber}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  return (
    <main>
      <header>
        <div className="shop-title">
          <p className="eyebrow">Log anomaly Detector</p>
          <h1>HongShaoNiuRouMian</h1>
        </div>
        <figure className="noodle-photo">
          <img
            alt="A bowl of braised beef noodle soup"
            src="/noodle.jpg"
          />
        </figure>
        <div className="header-actions">
          <PlaybackControls
            isPlaying={isPlaying}
            onToggle={() => setIsPlaying((playing) => !playing)}
            onReset={() => setRevealedCount(Math.min(INITIAL_WINDOW_SIZE, logs.length))}
          />
          <ThresholdControl threshold={threshold} onChange={setThreshold} />
        </div>
      </header>

      <section className="project-intro">
        <h2>An unsupervised next-event anomaly detector for OpenSSH traces.</h2>
        <ul>
          <li>Parses raw events into Drain-derived log templates.</li>
          <li>Builds a 100-event history from frozen template embeddings and cyclical time-parameter encodings.</li>
          <li>Uses a BiLSTM with temporal attention to predict the next template embedding.</li>
          <li>Surfaces low-cosine-similarity observations as anomalies.</li>
        </ul>
      </section>

      {error && <p className="error">{error}</p>}
      {!error && logs.length === 0 && <p>Loading scored logs…</p>}
      {logs.length > 0 && (
        <>
          <div className="stream-heading">
            <div>
              <p className="menu-kicker">MODEL OUTPUT</p>
              <h2>UnaLive anomaly stream</h2>
            </div>
            <p className="status">Showing {revealedCount} of {logs.length} logs.</p>
          </div>
          <div className="content-grid">
            <LogViewer
              logs={visibleLogs}
              threshold={threshold}
              onScrollForward={advance}
            />
            <AnomalyList anomalies={visibleAnomalies} onSelect={focusLog} />
          </div>
          <ProjectNotes />
        </>
      )}
    </main>
  );
}
