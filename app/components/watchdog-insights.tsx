"use client"

import { Bar, BarChart, ReferenceArea } from "recharts"
import { ChevronDown, ScanSearch } from "lucide-react"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { insights, type Insight } from "@/lib/log-data"
import { cn } from "@/lib/utils"

const sparkConfig = {
  value: { label: "Anomalies", color: "var(--abnormal)" },
} satisfies ChartConfig

function StatusPill({ status }: { status: Insight["status"] }) {
  return (
    <span
      className={cn(
        "text-[11px] font-bold tracking-wide",
        status === "ONGOING" ? "text-abnormal" : "text-success",
      )}
    >
      {status}
    </span>
  )
}

function AnomalySpark({ insight }: { insight: Insight }) {
  // Highlight the clustered/anomalous region with a dashed box
  const start = insight.spark.findIndex((p) => p.value > 15)
  const end =
    insight.spark.length -
    1 -
    [...insight.spark].reverse().findIndex((p) => p.value > 15)

  return (
    <div className="mt-1">
      <div className="flex items-end justify-between text-[11px] text-muted-foreground">
        <span>{insight.axisLeft}</span>
      </div>
      <div className="relative h-[70px]">
        <ChartContainer config={sparkConfig} className="h-full w-full">
          <BarChart data={insight.spark} barCategoryGap={0} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
            {start >= 0 && (
              <ReferenceArea
                x1={insight.spark[start]?.i}
                x2={insight.spark[end]?.i}
                fill="var(--watchdog)"
                fillOpacity={0.06}
                stroke="var(--watchdog)"
                strokeDasharray="4 3"
                strokeOpacity={0.9}
              />
            )}
            <Bar dataKey="value" fill="var(--color-value)" radius={[1, 1, 0, 0]} />
          </BarChart>
        </ChartContainer>
        <span className="absolute bottom-3 left-0 text-[11px] text-muted-foreground">
          {insight.axisRight}
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{insight.ticks[0]}</span>
        <span>{insight.ticks[1]}</span>
      </div>
    </div>
  )
}

function ErrorOutlier({ insight }: { insight: Insight }) {
  return (
    <div className="mt-6 flex flex-col justify-center">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-abnormal"
          style={{ width: `${insight.errorPct ?? 0}%` }}
        />
        <div className="h-full w-px bg-card" />
        <div
          className="h-full bg-normal"
          style={{ width: `${insight.logPct ?? 0}%` }}
        />
      </div>
      <div className="mt-4 flex items-start justify-between">
        <div>
          <div className="text-lg font-bold tabular-nums text-foreground">
            {insight.errorPct}%
          </div>
          <div className="text-[11px] text-muted-foreground">of total errors</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold tabular-nums text-foreground">
            {insight.logPct}%
          </div>
          <div className="text-[11px] text-muted-foreground">of total logs</div>
        </div>
      </div>
    </div>
  )
}

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="flex min-w-[280px] flex-1 flex-col rounded-md border border-border bg-card p-4">
      <div className="text-[11px] font-semibold tracking-wide text-muted-foreground">
        {insight.type}
      </div>
      <div className="mt-2 flex items-center gap-1 text-sm">
        <span className="text-muted-foreground">service:</span>
        <span className="rounded bg-normal/20 px-1.5 py-0.5 font-medium text-foreground">
          {insight.service}
        </span>
      </div>

      <div className="flex-1">
        {insight.type === "ERROR OUTLIER" ? (
          <ErrorOutlier insight={insight} />
        ) : (
          <AnomalySpark insight={insight} />
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <StatusPill status={insight.status} />
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
          {insight.ago}
        </span>
      </div>
    </div>
  )
}

export function WatchdogInsights() {
  return (
    <div className="rounded-lg border border-dashed border-watchdog/60 p-4">
      <div className="flex items-center gap-2">
        <ChevronDown className="size-4 text-muted-foreground" />
        <span className="flex size-6 items-center justify-center rounded bg-watchdog text-[11px] font-bold text-white">
          {insights.length}
        </span>
        <ScanSearch className="size-4 text-watchdog" />
        <span className="text-sm font-semibold text-foreground">Watchdog Insights</span>
        <span className="text-sm text-muted-foreground">Log anomalies and error outliers</span>
        <button className="ml-1 text-sm font-medium text-link hover:underline">View all</button>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  )
}
