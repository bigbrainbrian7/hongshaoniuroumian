import { useEffect, useRef, useState, type WheelEvent } from "react";

import type { LogRecord } from "../types";

type LogViewerProps = {
  logs: LogRecord[];
  threshold: number;
  onScrollForward: () => void;
};

export function LogViewer({ logs, threshold, onScrollForward }: LogViewerProps) {
  const viewer = useRef<HTMLElement>(null);
  const lastScrollAdvance = useRef(0);
  const [isFollowingLatest, setIsFollowingLatest] = useState(true);

  useEffect(() => {
    if (isFollowingLatest && viewer.current) {
      viewer.current.scrollTop = viewer.current.scrollHeight;
    }
  }, [isFollowingLatest, logs.length]);

  const handleWheel = (event: WheelEvent<HTMLElement>) => {
    const now = Date.now();
    if (event.deltaY > 0 && now - lastScrollAdvance.current > 150) {
      lastScrollAdvance.current = now;
      onScrollForward();
    }
  };

  const handleScroll = () => {
    if (!viewer.current) return;
    const { clientHeight, scrollHeight, scrollTop } = viewer.current;
    setIsFollowingLatest(scrollHeight - scrollTop - clientHeight < 8);
  };

  const jumpToBottom = () => {
    if (viewer.current) viewer.current.scrollTop = viewer.current.scrollHeight;
    setIsFollowingLatest(true);
  };

  return (
    <div className="log-viewer-container">
      <section
        className="log-viewer"
        onScroll={handleScroll}
        onWheel={handleWheel}
        ref={viewer}
      >
        {logs.map((log) => {
        const isAnomaly = Boolean(
          log.scored &&
          log.template_similarity !== undefined &&
          log.template_similarity < threshold,
        );
        return (
          <article
            className={`log-row ${isAnomaly ? "anomaly" : ""}`}
            id={`log-${log.line_number}`}
            key={log.line_number}
          >
            <div className="log-meta">
              <span>#{log.line_number}</span>
              {log.template_similarity !== undefined && (
                <span>similarity {log.template_similarity.toFixed(3)}</span>
              )}
              {isAnomaly && <strong>🌶 Anomaly</strong>}
            </div>
            <code>{log.line}</code>
            {log.template && <p>Template: {log.template}</p>}
            {log.error && <p className="error">{log.error}</p>}
          </article>
        );
        })}
      </section>
      {!isFollowingLatest && (
        <button className="jump-to-bottom" onClick={jumpToBottom}>
          Jump to latest
        </button>
      )}
    </div>
  );
}
