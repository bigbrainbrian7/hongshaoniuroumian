"use client"

import { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, ReferenceArea, XAxis, YAxis } from "recharts"
import { X } from "lucide-react"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { type Insight } from "@/lib/log-data"
import { getAnomalousEvents, getLogIntervals, type LogEvent, type LogInterval } from "@/lib/ec2-api"
import { ErrorDensityInsight } from "@/components/error-density"
import { InsightDetail } from "@/components/insight-detail"
import { cn } from "@/lib/utils"

const sparkConfig = {
  value: { label: "Anomalies", color: "var(--abnormal)" },
} satisfies ChartConfig

function formatTimelineLabel(date: Date) {
  const hour = date.getHours()
  return hour === 0 && date.getMinutes() === 0
    ? `${date.toLocaleDateString([], { weekday: "short" })} ${date.getDate()}`
    : `${String(hour).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

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
        <ChartContainer config={sparkConfig} className="h-full w-full pl-3">
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
        "flex w-[280px] shrink-0 flex-col rounded-md border border-border bg-card p-4",
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
  const sourceIntervalMilliseconds = 60 * 60 * 1_000
  const displayIntervalMilliseconds = sourceIntervalMilliseconds
  const surgeStart = insight.surgeStartTime ?? peakTime
  const surgeEnd = insight.surgeEndTime ?? peakTime
  const surroundingMilliseconds = 10 * sourceIntervalMilliseconds
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
      abnormal: counts.reduce((sum, count) => sum + (count?.abnormal_logs ?? 0), 0),
    }
  })
  const shownTickIndexes = new Set(
    columns.map((_, index) => index).filter((index) => index % 6 === 0),
  )
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
            <p className="text-xs text-muted-foreground">Abnormal logs in one-hour bins around the detected surge</p>
          </div>
          <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close log anomaly surge">
            <X className="size-4" />
          </button>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[3fr_2fr]">
          <div className="min-w-0">
            <ChartContainer config={{ abnormal: { label: "Abnormal", color: "var(--abnormal)" } }} className="h-[300px] w-full">
              <BarChart data={columns} barCategoryGap="4%" barGap={0} margin={{ top: 8, right: 8, left: 2, bottom: 16 }}>
                <XAxis
                  dataKey="time"
                  interval={0}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                  tickMargin={8}
                  tick={(props) => {
                    const { x, y, payload, index } = props
                    if (!shownTickIndexes.has(index)) return <g />
                    return (
                      <text x={x} y={Number(y) + 12} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
                        {formatTimelineLabel(new Date(payload.value))}
                      </text>
                    )
                  }}
                />
                <YAxis hide />
                <ReferenceArea x1={columns[highlightedStart]?.time} x2={columns[highlightedEnd]?.time} fill="var(--watchdog)" fillOpacity={0.06} stroke="var(--watchdog)" strokeDasharray="4 3" />
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
  const [nearbyAnomalies, setNearbyAnomalies] = useState<LogEvent[]>([])
  const peakTime = insight.peakTime ?? Date.now()
  const surgeStart = insight.surgeStartTime ?? peakTime
  const surgeEnd = insight.surgeEndTime ?? peakTime

  useEffect(() => {
    if (!open) return

    setNearbyAnomalies([])
    void getAnomalousEvents(
      surgeStart,
      surgeEnd,
    ).then(setNearbyAnomalies).catch(() => setNearbyAnomalies([]))
  }, [open, surgeStart, surgeEnd])

  return (
    <>
      <InsightCard insight={insight} onClick={() => setOpen(true)} />
      <InsightDetail insight={open ? insight : null} events={nearbyAnomalies} onClose={() => setOpen(false)} />
    </>
  )
}

function formatAgo(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1_000))
  if (seconds < 60) return `${seconds}s AGO`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m AGO`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h AGO`
  return `${Math.floor(hours / 24)}d ${hours % 24}h AGO`
}

function findAnomalySurges(intervals: LogInterval[], hours: number): Insight[] {
  if (!intervals.length) return []

  const intervalMilliseconds = 60 * 60 * 1_000
  const bucketsByTime = new Map(
    intervals.map((interval) => [interval.interval_start.slice(0, 19), interval]),
  )
  const latest = Math.floor(Date.now() / intervalMilliseconds) * intervalMilliseconds
  const sampleCount = hours
  const start = latest - (sampleCount - 1) * intervalMilliseconds
  const samples = Array.from({ length: sampleCount }, (_, index) => {
    const time = start + index * intervalMilliseconds
    return {
      time,
      value: bucketsByTime.get(new Date(time).toISOString().slice(0, 19))?.abnormal_logs ?? 0,
    }
  })
  const rolling = samples.map((_, index) =>
    samples.slice(Math.max(0, index - 9), index + 1).reduce((sum, sample) => sum + sample.value, 0),
  )
  // A mean/stddev threshold lets one extreme burst hide every smaller surge.
  // Median-based thresholding keeps each distinct elevated cluster eligible.
  const sortedRolling = [...rolling].sort((left, right) => left - right)
  const median = sortedRolling[Math.floor(sortedRolling.length / 2)]
  const deviations = rolling
    .map((value) => Math.abs(value - median))
    .sort((left, right) => left - right)
  const medianAbsoluteDeviation = deviations[Math.floor(deviations.length / 2)]
  const threshold = Math.max(2, median + 3 * medianAbsoluteDeviation)
  const peaks = rolling
    .map((value, index) => ({ value, index }))
    .filter(({ value, index }) =>
      value >= threshold &&
      value >= (rolling[index - 1] ?? Number.NEGATIVE_INFINITY) &&
      value > (rolling[index + 1] ?? Number.NEGATIVE_INFINITY),
    )
    .sort((left, right) => right.index - left.index)
    .reduce<number[]>((selected, { index }) => {
      if (selected.length < 3 && selected.every((peak) => Math.abs(peak - index) > 3)) {
        selected.push(index)
      }
      return selected
    }, [])

  if (!peaks.length) return []

  const smoothed = rolling.map((_, index) => {
    const values = rolling.slice(Math.max(0, index - 1), Math.min(rolling.length, index + 2))
    return values.reduce((sum, value) => sum + value, 0) / values.length
  })
  const decayThreshold = Math.max(1, median + medianAbsoluteDeviation * 1.5)
  const quietSeconds = 7
  return peaks.map((peak) => {
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
    const tickStart = new Date(samples[sparkStart].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const tickEnd = new Date(samples[Math.min(samples.length - 1, sparkStart + 39)].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

    return {
      id: `live-surge-${peakTime}`,
      type: "LOG ANOMALY",
      service: "openssh",
      status: latest - peakTime <= intervalMilliseconds ? "ONGOING" : "RESOLVED",
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
  })
}

export function WatchdogInsights({ hours }: { hours: number }) {
  const [intervals, setIntervals] = useState<LogInterval[]>([])

  useEffect(() => {
    async function loadIntervals() {
      try {
        setIntervals(await getLogIntervals(hours))
      } catch {
        setIntervals([])
      }
    }

    void loadIntervals()
    const timer = window.setInterval(loadIntervals, 10_000)
    return () => window.clearInterval(timer)
  }, [hours])

  const liveSurges = useMemo(() => findAnomalySurges(intervals, hours), [intervals, hours])

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">Insights</span>
        <span className="text-sm text-muted-foreground">Log anomalies and error outliers</span>
      </div>

      <div className="mt-4 flex touch-pan-x gap-3 overflow-x-auto pb-1">
        <ErrorDensityInsight hours={hours} />
        {liveSurges.slice(0, 2).map((insight) => (
          <LiveSurgeInsight key={insight.id} insight={insight} intervals={intervals} />
        ))}
        {liveSurges.slice(2).map((insight) => (
          <LiveSurgeInsight key={insight.id} insight={insight} intervals={intervals} />
        ))}
      </div>
    </div>
  )
}
