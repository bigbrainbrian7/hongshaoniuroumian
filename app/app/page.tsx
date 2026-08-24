"use client"

import { useCallback, useState } from "react"
import { AnomalyTimeline } from "@/components/anomaly-timeline"
import { WatchdogInsights } from "@/components/watchdog-insights"
import { LogTable } from "@/components/log-table"
import { LogsFound } from "@/components/logs-found"

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
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        {/* Header */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Logs</h1>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
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
            <span className="text-foreground">
              {timelineRange
                ? `${rangeFormatter.format(timelineRange.start)} – ${rangeFormatter.format(timelineRange.end)}`
                : "No logs in selected range"}
            </span>
          </div>
        </header>

        {/* Timeline chart */}
        <section
          aria-label="Log volume over time"
          className="mb-4 rounded-lg border border-border bg-card"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
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
        <section aria-label="Watchdog Insights" className="mb-4">
          <WatchdogInsights />
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
