"use client"

import { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { getLogIntervals, type LogInterval } from "@/lib/ec2-api"

const chartConfig = {
  normal: {
    label: "Normal",
    color: "var(--normal)",
  },
  abnormal: {
    label: "Abnormal",
    color: "var(--abnormal)",
  },
} satisfies ChartConfig

const countFormatter = new Intl.NumberFormat("en", { notation: "compact" })
const outlierCutoff = 40

function formatCount(value: number) {
  return countFormatter.format(value)
}

function formatTimelineLabel(date: Date) {
  const hour = date.getHours()
  return hour === 0 && date.getMinutes() === 0
    ? `${date.toLocaleDateString([], { weekday: "short" })} ${date.getDate()}`
    : `${String(hour).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

function OutlierLabel({
  x,
  width,
  payload,
}: {
  x?: number | string
  width?: number | string
  payload?: { totalLogs?: number; isOutlier?: boolean; [key: string]: unknown }
}) {
  if (x === undefined || width === undefined || !payload?.isOutlier) return null

  return (
    <text x={Number(x) + Number(width) / 2} y={14} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
      {payload.totalLogs}
    </text>
  )
}

// Only show a subset of x labels to mimic the reference (every ~6th bar / 3h)
export function AnomalyTimeline({
  hours,
  onRangeChange,
}: {
  hours: number
  onRangeChange: (range: { start: number; end: number } | null) => void
}) {
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

  const data = useMemo(() => {
    const intervalMilliseconds = 60 * 60 * 1_000
    const bucketsByTime = new Map(
      intervals.map((interval) => [interval.interval_start.slice(0, 19), interval]),
    )
    const latest = intervals.length
      ? new Date(intervals.at(-1)!.interval_start).getTime()
      : Math.floor(Date.now() / intervalMilliseconds) * intervalMilliseconds
    const start = latest - (hours - 1) * intervalMilliseconds

    return Array.from({ length: hours }, (_, index) => {
      const date = new Date(start + index * intervalMilliseconds)
      const bucket = bucketsByTime.get(date.toISOString().slice(0, 19))
      const normalLogs = bucket?.normal_logs ?? 0
      const abnormalLogs = bucket?.abnormal_logs ?? 0
      const totalLogs = normalLogs + abnormalLogs
      const displayScale = totalLogs >= outlierCutoff
        ? outlierCutoff / totalLogs
        : 1
      return {
        time: date.toISOString(),
        label: formatTimelineLabel(date),
        normal: normalLogs * displayScale,
        abnormal: abnormalLogs * displayScale,
        normalLogs,
        abnormalLogs,
        totalLogs,
        isOutlier: totalLogs >= outlierCutoff,
      }
    })
  }, [hours, intervals])
  useEffect(() => {
    if (!intervals.length) {
      onRangeChange(null)
      return
    }

    const end = new Date(intervals.at(-1)!.interval_start).getTime()
    onRangeChange({ start: end - (hours - 1) * 60 * 60 * 1_000, end })
  }, [hours, intervals, onRangeChange])
  const shownLabels = new Set(data.map((_, index) => index).filter((index) => index % 6 === 0))

  return (
    <div className="w-full px-4 pt-4 pb-2">
      <ChartContainer config={chartConfig} className="h-[150px] w-full">
        <BarChart data={data} barCategoryGap={1} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <YAxis
            dataKey="normal"
            orientation="left"
            axisLine={false}
            tickLine={false}
            width={38}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            ticks={[0, outlierCutoff]}
            domain={[0, outlierCutoff]}
            allowDataOverflow
            tickFormatter={formatCount}
          />
          <XAxis
            dataKey="time"
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            interval={0}
            tickMargin={8}
            tick={(props) => {
              const { x, y, payload, index } = props
              if (!shownLabels.has(index)) return <g />
              return (
                <text
                  x={x}
                  y={Number(y) + 12}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--muted-foreground)"
                >
                  {formatTimelineLabel(new Date(payload.value))}
                </text>
              )
            }}
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)" }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, p) => {
                  const iso = p?.[0]?.payload?.time
                  return iso ? new Date(iso).toLocaleString() : ""
                }}
                formatter={(value, name, item) => {
                  const source = item.payload as { normalLogs?: number; abnormalLogs?: number }
                  const actualValue = name === "normal" ? source.normalLogs : source.abnormalLogs
                  return (
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 capitalize text-muted-foreground">
                        <span
                          className="h-2.5 w-2.5 rounded-[2px]"
                          style={{ background: `var(--color-${name})` }}
                        />
                        {name}
                      </span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {formatCount(Number(actualValue ?? value))}
                      </span>
                    </div>
                  )
                }}
              />
            }
          />
          <Bar dataKey="normal" stackId="a" fill="var(--color-normal)" />
          <Bar dataKey="abnormal" stackId="a" fill="var(--color-abnormal)" radius={[1, 1, 0, 0]}>
            <LabelList dataKey="totalLogs" content={OutlierLabel} />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}
