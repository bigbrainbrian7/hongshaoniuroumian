"use client"

import { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, ReferenceArea, XAxis, YAxis } from "recharts"
import { ChevronDown, ScanSearch, X } from "lucide-react"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { insights, type Insight } from "@/lib/log-data"
import { getAnomalousEvents, getLogIntervals, type LogEvent, type LogInterval } from "@/lib/ec2-api"
import { ErrorDensityInsight } from "@/components/error-density"
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
  const start = insight.highlightStart ?? insight.spark.findIndex((p) => p.value > 15)
  const end = insight.highlightEnd ?? (
    insight.spark.length -
    1 -
    [...insight.spark].reverse().findIndex((p) => p.value > 15)
  )

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

function InsightCard({ insight, onClick }: { insight: Insight; onClick?: () => void }) {
  return (
    <div
      className={cn(
        "flex min-w-[280px] flex-1 flex-col rounded-md border border-border bg-card p-4",
        onClick && "cursor-pointer transition-colors hover:bg-muted/50",
      )}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) onClick()
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
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

function SurgeDetail({ insight, intervals, onClose }: {
  insight: Insight
  intervals: LogInterval[]
  onClose: () => void
}) {
  const peakTime = insight.peakTime ?? Date.now()
  const sourceIntervalMilliseconds = 1_000
  const displayIntervalMilliseconds = 2_000
  const surgeStart = insight.surgeStartTime ?? peakTime
  const surgeEnd = insight.surgeEndTime ?? peakTime
  const surroundingMilliseconds = 20_000
  const windowStart = surgeStart - surroundingMilliseconds
  const windowEnd = surgeEnd + surroundingMilliseconds
  const columnCount = Math.ceil((windowEnd - windowStart + 1) / displayIntervalMilliseconds)
  const [nearbyAnomalies, setNearbyAnomalies] = useState<LogEvent[]>([])
  const bucketsByTime = new Map(
    intervals.map((interval) => [interval.interval_start.slice(0, 19), interval]),
  )
  const columns = Array.from({ length: columnCount }, (_, index) => {
    const time = windowStart + index * displayIntervalMilliseconds
    const counts = Array.from({ length: displayIntervalMilliseconds / sourceIntervalMilliseconds }, (_, second) =>
      bucketsByTime.get(new Date(time + second * sourceIntervalMilliseconds).toISOString().slice(0, 19)),
    )
    return {
      time,
      label: new Date(time).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
      abnormal: counts.reduce((sum, count) => sum + (count?.abnormal_logs ?? 0), 0),
    }
  })
  const highlightedStart = Math.max(
    0,
    Math.floor((surgeStart - windowStart) / displayIntervalMilliseconds),
  )
  const highlightedEnd = Math.min(
    columns.length - 1,
    Math.ceil((surgeEnd - windowStart) / displayIntervalMilliseconds),
  )

  useEffect(() => {
    void getAnomalousEvents(
      windowStart,
      windowEnd,
    ).then(setNearbyAnomalies).catch(() => setNearbyAnomalies([]))
  }, [windowStart, windowEnd])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-label="Log anomaly surge">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Log anomaly surge</p>
            <p className="text-xs text-muted-foreground">Abnormal logs in two-second bins around the detected surge</p>
          </div>
          <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close log anomaly surge">
            <X className="size-4" />
          </button>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[3fr_2fr]">
          <div className="min-w-0">
            <ChartContainer config={{ abnormal: { label: "Abnormal", color: "var(--abnormal)" } }} className="h-[300px] w-full">
              <BarChart data={columns} barCategoryGap="4%" barGap={0} margin={{ top: 8, right: 8, left: 2, bottom: 16 }}>
                <XAxis dataKey="label" interval="preserveStartEnd" tickLine={false} tickMargin={8} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <YAxis hide />
                <ReferenceArea x1={columns[highlightedStart]?.label} x2={columns[highlightedEnd]?.label} fill="var(--watchdog)" fillOpacity={0.06} stroke="var(--watchdog)" strokeDasharray="4 3" />
                <Bar dataKey="abnormal" fill="var(--color-abnormal)" />
              </BarChart>
            </ChartContainer>
          </div>
          <div className="min-h-0 rounded-md border border-border">
            <div className="border-b border-border px-3 py-2 text-xs font-semibold text-foreground">Abnormal logs ({nearbyAnomalies.length})</div>
            <div className="max-h-[300px] overflow-y-auto font-mono text-xs">
              {nearbyAnomalies.map((event) => (
                <div className="border-b border-border/60 p-3 last:border-0" key={event.id}>
                  <div className="mb-1 text-muted-foreground">{new Date(event.recorded_at).toLocaleTimeString()} · {event.template_similarity?.toFixed(3)}</div>
                  <div className="break-all text-foreground">{event.score_error ?? event.raw_line}</div>
                </div>
              ))}
              {!nearbyAnomalies.length && <p className="p-3 text-muted-foreground">No matching abnormal logs are available in the current event window.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LiveSurgeInsight({ insight, intervals }: { insight: Insight; intervals: LogInterval[] }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <InsightCard insight={insight} onClick={() => setOpen(true)} />
      {open && <SurgeDetail insight={insight} intervals={intervals} onClose={() => setOpen(false)} />}
    </>
  )
}

function formatAgo(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1_000))
  if (seconds < 60) return `${seconds}s AGO`
  return `${Math.floor(seconds / 60)}m AGO`
}

function findAnomalySurge(intervals: LogInterval[]): Insight | null {
  if (!intervals.length) return null

  const intervalMilliseconds = 1_000
  const bucketsByTime = new Map(
    intervals.map((interval) => [interval.interval_start.slice(0, 19), interval]),
  )
  const latest = new Date(intervals.at(-1)!.interval_start).getTime()
  const start = latest - 299 * intervalMilliseconds
  const samples = Array.from({ length: 300 }, (_, index) => {
    const time = start + index * intervalMilliseconds
    return {
      time,
      value: bucketsByTime.get(new Date(time).toISOString().slice(0, 19))?.abnormal_logs ?? 0,
    }
  })
  const rolling = samples.map((_, index) =>
    samples.slice(Math.max(0, index - 9), index + 1).reduce((sum, sample) => sum + sample.value, 0),
  )
  const average = rolling.reduce((sum, value) => sum + value, 0) / rolling.length
  const deviation = Math.sqrt(
    rolling.reduce((sum, value) => sum + (value - average) ** 2, 0) / rolling.length,
  )
  const peak = rolling.reduce(
    (best, value, index) => value > rolling[best] ? index : best,
    0,
  )
  const threshold = Math.max(2, average + 2 * deviation)
  if (rolling[peak] < threshold) return null

  const smoothed = rolling.map((_, index) => {
    const values = rolling.slice(Math.max(0, index - 1), Math.min(rolling.length, index + 2))
    return values.reduce((sum, value) => sum + value, 0) / values.length
  })
  const decayThreshold = Math.max(1, average + deviation * 0.75)
  const quietSeconds = 7
  let surgeStart = peak
  let surgeEnd = peak

  // Short gaps and single noisy values should not split the same burst.
  for (let index = peak - 1, quiet = 0; index >= 0; index -= 1) {
    quiet = smoothed[index] < decayThreshold ? quiet + 1 : 0
    if (quiet === quietSeconds) {
      surgeStart = index + quietSeconds
      break
    }
    surgeStart = index
  }
  for (let index = peak + 1, quiet = 0; index < smoothed.length; index += 1) {
    quiet = smoothed[index] < decayThreshold ? quiet + 1 : 0
    if (quiet === quietSeconds) {
      surgeEnd = index - quietSeconds
      break
    }
    surgeEnd = index
  }

  let highlightedSampleStart = Math.max(0, surgeStart - 9)
  let highlightedSampleEnd = surgeEnd
  while (highlightedSampleStart < highlightedSampleEnd && samples[highlightedSampleStart].value === 0) {
    highlightedSampleStart += 1
  }
  while (highlightedSampleEnd > highlightedSampleStart && samples[highlightedSampleEnd].value === 0) {
    highlightedSampleEnd -= 1
  }

  const sparkStart = Math.max(0, peak - 20)
  const spark = samples.slice(sparkStart, sparkStart + 40).map((sample, index) => ({
    i: index,
    value: sample.value,
  }))
  const highlightedStart = Math.max(0, highlightedSampleStart - sparkStart)
  const highlightedEnd = Math.min(spark.length - 1, highlightedSampleEnd - sparkStart)
  const peakTime = samples[peak].time
  const tickStart = new Date(samples[sparkStart].time).toLocaleTimeString()
  const tickEnd = new Date(samples[Math.min(samples.length - 1, sparkStart + 39)].time).toLocaleTimeString()

  return {
    id: "live-surge",
    type: "LOG ANOMALY",
    service: "openssh",
    status: latest - peakTime <= 10_000 ? "ONGOING" : "RESOLVED",
    ago: formatAgo(peakTime),
    axisLeft: String(Math.max(...spark.map((point) => point.value))),
    axisRight: "0",
    ticks: [tickStart, tickEnd],
    spark,
    highlightStart: highlightedStart,
    highlightEnd: highlightedEnd,
    peakTime,
    surgeStartTime: samples[highlightedSampleStart].time,
    surgeEndTime: samples[highlightedSampleEnd].time,
  }
}

export function WatchdogInsights() {
  const [intervals, setIntervals] = useState<LogInterval[]>([])

  useEffect(() => {
    async function loadIntervals() {
      try {
        setIntervals(await getLogIntervals())
      } catch {
        setIntervals([])
      }
    }

    void loadIntervals()
    const timer = window.setInterval(loadIntervals, 10_000)
    return () => window.clearInterval(timer)
  }, [])

  const liveSurge = useMemo(() => findAnomalySurge(intervals), [intervals])
  const displayedInsights = liveSurge
    ? [liveSurge, ...insights.slice(1)]
    : insights.slice(1)

  return (
    <div className="rounded-lg border border-dashed border-watchdog/60 p-4">
      <div className="flex items-center gap-2">
        <ChevronDown className="size-4 text-muted-foreground" />
        <span className="flex size-6 items-center justify-center rounded bg-watchdog text-[11px] font-bold text-white">
          {displayedInsights.length}
        </span>
        <ScanSearch className="size-4 text-watchdog" />
        <span className="text-sm font-semibold text-foreground">Watchdog Insights</span>
        <span className="text-sm text-muted-foreground">Log anomalies and error outliers</span>
        <button className="ml-1 text-sm font-medium text-link hover:underline">View all</button>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {displayedInsights.map((insight) => {
          if (insight.id === "live-surge") return <LiveSurgeInsight key={insight.id} insight={insight} intervals={intervals} />
          if (insight.type === "ERROR OUTLIER") return <ErrorDensityInsight key={insight.id} />
          return <InsightCard key={insight.id} insight={insight} />
        })}
      </div>
    </div>
  )
}
