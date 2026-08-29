"use client"

import { useCallback, useState } from "react"
import { AnomalyTimeline } from "@/components/anomaly-timeline"
import { WatchdogInsights } from "@/components/watchdog-insights"
import { LogTable } from "@/components/log-table"
import { LogsFound } from "@/components/logs-found"

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.89-2.78.62-3.37-1.21-3.37-1.21-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.15-4.56-5.1 0-1.13.39-2.05 1.03-2.77-.1-.26-.45-1.32.1-2.75 0 0 .84-.28 2.75 1.06A9.33 9.33 0 0 1 12 6.78c.85 0 1.7.12 2.5.35 1.91-1.34 2.75-1.06 2.75-1.06.55 1.43.2 2.49.1 2.75.64.72 1.03 1.64 1.03 2.77 0 3.96-2.35 4.84-4.58 5.1.36.32.68.93.68 1.88 0 1.36-.01 2.45-.01 2.79 0 .27.18.59.69.49A10.24 10.24 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
    </svg>
  )
}

export default function Page() {
  const [hours, setHours] = useState(96)
  const [timelineRange, setTimelineRange] = useState<{ start: number; end: number } | null>(null)
  const updateTimelineRange = useCallback((range: { start: number; end: number } | null) => {
    setTimelineRange(range)
  }, [])
  const rangeFormatter = new Intl.DateTimeFormat([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-4 sm:py-6">
        {/* Header */}
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:items-center">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Logs</h1>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <a
              className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              href="https://github.com/bigbrainbrian7/hongshaoniuroumian"
              target="_blank"
              rel="noreferrer"
            >
              <GitHubIcon />
              GitHub repository
            </a>
            <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
              <select
                aria-label="Timeline range"
                className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground outline-none"
                value={hours}
                onChange={(event) => setHours(Number(event.target.value))}
              >
                <option value={24}>24h</option>
                <option value={48}>48h</option>
                <option value={96}>4d</option>
                <option value={168}>7d</option>
              </select>
              <span className="min-w-0 truncate text-xs text-foreground sm:text-sm">
                {timelineRange
                  ? `${rangeFormatter.format(timelineRange.start)} – ${rangeFormatter.format(timelineRange.end)}`
                  : "No logs in selected range"}
              </span>
            </div>
          </div>
        </header>

        {/* Timeline chart */}
        <section
          aria-label="Log volume over time"
          className="mb-4 rounded-lg border border-border bg-card"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2 sm:px-4">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-normal" /> Normal
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-abnormal" /> Abnormal
              </span>
            </div>
          </div>
          <AnomalyTimeline hours={hours} onRangeChange={updateTimelineRange} />
        </section>

        <div className="mb-3 border-b border-border pb-3 pl-1">
          <LogsFound />
        </div>

        {/* Watchdog insights */}
        <section aria-label="Insights" className="mb-4">
          <WatchdogInsights hours={hours} />
        </section>

        {/* Log display */}
        <section
          aria-label="Log entries"
          className="rounded-lg border border-border bg-card"
        >
          <LogTable />
        </section>
      </div>
    </main>
  )
}
