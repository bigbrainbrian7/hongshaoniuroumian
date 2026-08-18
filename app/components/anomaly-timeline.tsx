"use client"

import { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
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

function formatCount(value: number) {
  return countFormatter.format(value)
}

// Only show a subset of x labels to mimic the reference (every ~6th bar / 3h)
export function AnomalyTimeline() {
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

  const data = useMemo(() => {
    const intervalMilliseconds = 30 * 60 * 1_000
    const bucketsByTime = new Map(
      intervals.map((interval) => [interval.interval_start.slice(0, 19), interval]),
    )
    const latest = intervals.length
      ? new Date(intervals.at(-1)!.interval_start).getTime()
      : Math.floor(Date.now() / intervalMilliseconds) * intervalMilliseconds
    const start = latest - 95 * intervalMilliseconds

    return Array.from({ length: 96 }, (_, index) => {
      const date = new Date(start + index * intervalMilliseconds)
      const bucket = bucketsByTime.get(date.toISOString().slice(0, 19))
      const hour = date.getHours()
      return {
        time: date.toISOString(),
        label: hour === 0 && date.getMinutes() === 0
          ? `${date.toLocaleDateString([], { weekday: "short" })} ${date.getDate()}`
          : `${String(hour).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
        normal: bucket?.normal_logs ?? 0,
        abnormal: bucket?.abnormal_logs ?? 0,
      }
    })
  }, [intervals])
  const maximum = Math.max(1, ...data.map((interval) => interval.normal + interval.abnormal))
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
            ticks={[0, maximum]}
            domain={[0, maximum]}
            tickFormatter={formatCount}
          />
          <XAxis
            dataKey="label"
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
                  {payload.value}
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
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 capitalize text-muted-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-[2px]"
                        style={{ background: `var(--color-${name})` }}
                      />
                      {name}
                    </span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {formatCount(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="normal" stackId="a" fill="var(--color-normal)" />
          <Bar dataKey="abnormal" stackId="a" fill="var(--color-abnormal)" radius={[1, 1, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
