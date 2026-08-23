import { Download, Settings, Upload } from "lucide-react"
import { AnomalyTimeline } from "@/components/anomaly-timeline"
import { WatchdogInsights } from "@/components/watchdog-insights"
import { LogTable } from "@/components/log-table"

export default function Page() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        {/* Header */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Logs</h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Service:openssh</span>
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              2d
            </span>
            <span className="text-foreground">Apr 3, 10:13 am – Apr 5, 10:28 am</span>
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
          <AnomalyTimeline />
        </section>

        {/* Controls row */}
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">9,162,518</span> logs found
          </p>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted">
              <Upload className="size-4" /> Export
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted">
              <Settings className="size-4" /> Options
            </button>
          </div>
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
