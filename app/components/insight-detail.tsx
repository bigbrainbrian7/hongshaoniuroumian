"use client"

import { useEffect, useMemo } from "react"
import { Bar, BarChart, ReferenceArea, XAxis, YAxis, CartesianGrid } from "recharts"
import { X } from "lucide-react"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import {
  type Insight,
  type SparkPoint,
} from "@/lib/log-data"
import type { LogEvent } from "@/lib/ec2-api"
import { cn } from "@/lib/utils"

const detailConfig = {
  value: { label: "Error logs", color: "var(--abnormal)" },
} satisfies ChartConfig

function formatElapsedSince(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / (60 * 1_000)))
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

/** Highlight the variable tokens inside a log-pattern message. */
function HighlightedMessage({ message }: { message: string }) {
  const regex =
    /(\[[^\]]*\])|(\/[A-Za-z*][\w\-*/.]*)|(Root=\*)|([\dX]+(?:\.[\dX]+){3})|(\*(?::\*)+)/g

  const nodes: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(message)) !== null) {
    if (match.index > last) {
      nodes.push(message.slice(last, match.index))
    }
    const [full, bracket, path, root, ip, mask] = match
    if (path) {
      nodes.push(
        <span key={key++} className="text-link">
          {full}
        </span>,
      )
    } else {
      // bracket groups, masked IPs, Root=* → yellow highlight
      nodes.push(
        <span
          key={key++}
          className="rounded-[2px] bg-amber-200/70 text-foreground"
        >
          {full}
        </span>,
      )
    }
    last = match.index + full.length
  }
  if (last < message.length) nodes.push(message.slice(last))

  return <span>{nodes}</span>
}

function VolumeSpark({ data }: { data: SparkPoint[] }) {
  return (
    <ChartContainer
      config={detailConfig}
      className="h-[42px] w-[120px]"
    >
      <BarChart data={data} barCategoryGap={0} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
        <Bar dataKey="value" fill="var(--color-value)" radius={[1, 1, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

function commonTemplates(events: LogEvent[]) {
  const grouped = new Map<string, LogEvent[]>()
  for (const event of events) {
    const template = event.template?.trim() || "Unmatched template"
    grouped.set(template, [...(grouped.get(template) ?? []), event])
  }

  const highestCount = Math.max(1, ...[...grouped.values()].map((entries) => entries.length))
  return [...grouped.entries()]
    .map(([message, entries]) => {
      const timestamps = entries.map((entry) => new Date(entry.recorded_at).getTime())
      const earliest = Math.min(...timestamps)
      const latest = Math.max(...timestamps)
      const range = Math.max(1, latest - earliest)
      const volume = Array.from({ length: 12 }, (_, index) => ({ i: index, value: 0 }))
      for (const timestamp of timestamps) {
        const index = Math.min(11, Math.floor(((timestamp - earliest) / range) * 12))
        volume[index].value += 1
      }
      const service = entries[0].raw_line.match(/^\w{3}\s+\d+\s+\S+\s+\S+\s+([\w.-]+)/)?.[1] ?? "openssh"

      return {
        id: message,
        message,
        count: entries.length,
        countPct: (entries.length / highestCount) * 100,
        volume,
        volumeLabel: `${entries.length} log${entries.length === 1 ? "" : "s"}`,
        service,
      }
    })
    .sort((left, right) => right.count - left.count)
}

export function InsightDetail({
  insight,
  events,
  onClose,
}: {
  insight: Insight | null
  events: LogEvent[]
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    if (insight) {
      document.addEventListener("keydown", onKey)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [insight, onClose])

  const open = insight !== null
  const templatePatterns = useMemo(() => commonTemplates(events), [events])
  const detailTimeline = useMemo(() => {
    const intervalMilliseconds = 60 * 60 * 1_000
    const peakTime = insight?.peakTime ?? Date.now()
    const surgeStart = insight?.surgeStartTime ?? peakTime
    const surgeEnd = insight?.surgeEndTime ?? peakTime
    const windowStart = Math.floor((surgeStart - 10 * intervalMilliseconds) / intervalMilliseconds) * intervalMilliseconds
    const windowEnd = Math.ceil((surgeEnd + 10 * intervalMilliseconds) / intervalMilliseconds) * intervalMilliseconds
    const countsByTime = new Map<number, number>()
    for (const event of events) {
      const time = Math.floor(new Date(event.recorded_at).getTime() / intervalMilliseconds) * intervalMilliseconds
      countsByTime.set(time, (countsByTime.get(time) ?? 0) + 1)
    }
    const points = Array.from(
      { length: Math.round((windowEnd - windowStart) / intervalMilliseconds) + 1 },
      (_, index) => {
        const time = windowStart + index * intervalMilliseconds
        const date = new Date(time)
        return {
          i: index,
          time,
          label: `${String(date.getHours()).padStart(2, "0")}:00`,
          value: countsByTime.get(time) ?? 0,
        }
      },
    )
    return {
      points,
      anomalyStart: Math.max(0, Math.floor((surgeStart - windowStart) / intervalMilliseconds)),
      anomalyEnd: Math.min(points.length - 1, Math.ceil((surgeEnd - windowStart) / intervalMilliseconds)),
    }
  }, [events, insight])
  const tickIndexes = detailTimeline.points.filter((point) => point.i % 6 === 0).map((point) => point.i)
  const maximum = Math.max(1, ...detailTimeline.points.map((point) => point.value))

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-foreground/20 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Slide-over panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Anomaly details"
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-[720px] flex-col bg-card shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {insight && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "text-[11px] font-bold tracking-wide",
                    insight.status === "ONGOING" ? "text-abnormal" : "text-success",
                  )}
                >
                  {insight.status}
                </span>
                <span className="text-sm text-muted-foreground">
                  Since {new Date(insight.surgeStartTime ?? insight.peakTime ?? Date.now()).toLocaleString()}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {formatElapsedSince(insight.surgeStartTime ?? insight.peakTime ?? Date.now())}
                </span>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Scroll body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <h2 className="flex flex-wrap items-center gap-1.5 text-base font-semibold text-foreground">
                A spike in anomalous logs was detected on
                <span className="text-muted-foreground">service:</span>
                <span className="rounded bg-normal/20 px-1.5 py-0.5 font-medium text-foreground">
                  {insight.service}
                </span>
              </h2>

              {/* Timeline */}
              <div className="relative mt-6">
                <div className="absolute right-2 top-0 z-10 text-[11px] font-medium text-watchdog">
                  {new Date(insight.surgeStartTime ?? insight.peakTime ?? Date.now()).toLocaleString()} - {insight.status}
                </div>
                <ChartContainer config={detailConfig} className="h-[190px] w-full">
                  <BarChart data={detailTimeline.points} barCategoryGap={0} margin={{ top: 24, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                    <XAxis
                      dataKey="time"
                      ticks={tickIndexes.map((index) => detailTimeline.points[index].time)}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      tickFormatter={(value: number) => {
                        const date = new Date(value)
                        return `${String(date.getHours()).padStart(2, "0")}:00`
                      }}
                    />
                    <YAxis
                      ticks={[0, maximum]}
                      domain={[0, maximum]}
                      tickFormatter={(value: number) => String(value)}
                      tickLine={false}
                      axisLine={false}
                      width={34}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <ReferenceArea
                      x1={detailTimeline.points[detailTimeline.anomalyStart]?.time}
                      x2={detailTimeline.points[detailTimeline.anomalyEnd]?.time}
                      fill="var(--watchdog)"
                      fillOpacity={0.06}
                      stroke="var(--watchdog)"
                      strokeDasharray="4 3"
                    />
                    <Bar dataKey="value" fill="var(--color-value)" radius={[1, 1, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>

              {/* Patterns */}
              <h3 className="mb-2 mt-6 text-sm font-semibold text-foreground">
                {templatePatterns.length} templates found
              </h3>
              <div className="overflow-hidden rounded-md border border-border">
                {/* header row */}
                <div className="grid grid-cols-[110px_140px_90px_1fr] gap-3 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Count</span>
                  <span>~Volume</span>
                  <span>Service</span>
                  <span>Message</span>
                </div>
                {templatePatterns.map((p) => (
                  <div
                    key={p.id}
                    className="grid grid-cols-[110px_140px_90px_1fr] items-center gap-3 border-l-2 border-abnormal px-3 py-3 text-sm [&:not(:last-child)]:border-b [&:not(:last-child)]:border-b-border"
                  >
                    {/* Count */}
                    <div>
                      <div className="mb-1 font-medium tabular-nums text-foreground">
                        {p.count}
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-abnormal"
                          style={{ width: `${p.countPct}%` }}
                        />
                      </div>
                    </div>
                    {/* Volume */}
                    <div className="flex items-center gap-1">
                      <VolumeSpark data={p.volume} />
                      <span className="text-[11px] text-muted-foreground">
                        {p.volumeLabel}
                      </span>
                    </div>
                    {/* Service */}
                    <span className="text-muted-foreground">{p.service}</span>
                    {/* Message */}
                    <code className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-foreground">
                      <HighlightedMessage message={p.message} />
                    </code>
                  </div>
                ))}
                {!templatePatterns.length && (
                  <div className="px-3 py-4 text-sm text-muted-foreground">
                    No anomalous templates were found in this surge.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
