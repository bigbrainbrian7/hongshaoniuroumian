"use client"

import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { X } from "lucide-react"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { getLogIntervals, type LogInterval } from "@/lib/ec2-api"

const chartConfig = {
  density: { label: "Error density", color: "var(--abnormal)" },
} satisfies ChartConfig

const countFormatter = new Intl.NumberFormat("en", { notation: "compact" })

type DensityPoint = { time: number; label: string; density: number }

function useDensityData() {
  const [intervals, setIntervals] = useState<LogInterval[]>([])

  useEffect(() => {
    async function loadIntervals() {
      try {
        setIntervals(await getLogIntervals(24))
      } catch {
        setIntervals([])
      }
    }

    void loadIntervals()
    const timer = window.setInterval(loadIntervals, 10_000)
    return () => window.clearInterval(timer)
  }, [])

  return useMemo<DensityPoint[]>(() => {
    const duration = 24 * 60 * 60 * 1_000
    const bandwidth = 30 * 60 * 1_000
    const pointCount = 97
    const end = Date.now()
    const start = end - duration
    const observations = intervals
      .map((interval) => ({ time: new Date(interval.interval_start).getTime(), weight: interval.abnormal_logs }))
      .filter((interval) => interval.time >= start && interval.weight > 0)

    return Array.from({ length: pointCount }, (_, index) => {
      const time = start + (duration * index) / (pointCount - 1)
      const density = observations.reduce((sum, observation) => {
        const distance = (time - observation.time) / bandwidth
        return sum + observation.weight * Math.exp(-0.5 * distance * distance)
      }, 0)
      return {
        time,
        label: new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        density,
      }
    })
  }, [intervals])
}

export function ErrorDensity({ data: suppliedData }: { data?: DensityPoint[] }) {
  const fetchedData = useDensityData()
  const data = suppliedData ?? fetchedData
  const maximum = Math.max(1, ...data.map((point) => point.density))

  return (
    <div className="w-full px-4 pt-4 pb-2">
      <ChartContainer config={chartConfig} className="h-[180px] w-full">
        <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="error-density" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="var(--color-density)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--color-density)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <YAxis
            axisLine={false}
            domain={[0, maximum]}
            tickFormatter={(value) => countFormatter.format(Math.round(Number(value)))}
            tickLine={false}
            width={38}
          />
          <XAxis
            dataKey="label"
            interval={11}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            tickMargin={8}
          />
          <ChartTooltip
            cursor={{ stroke: "var(--border)" }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const time = payload?.[0]?.payload?.time
                  return time ? new Date(time).toLocaleString() : ""
                }}
                formatter={(value) => countFormatter.format(Math.round(Number(value)))}
              />
            }
          />
          <Area
            dataKey="density"
            fill="url(#error-density)"
            fillOpacity={1}
            stroke="var(--color-density)"
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}

export function ErrorDensityInsight() {
  const data = useDensityData()
  const [open, setOpen] = useState(false)
  const maximum = Math.max(1, ...data.map((point) => point.density))

  return (
    <>
      <button
        className="flex min-w-[280px] flex-1 cursor-pointer flex-col rounded-md border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50"
        onClick={() => setOpen(true)}
        type="button"
      >
        <div className="text-[11px] font-semibold tracking-wide text-muted-foreground">ERROR OUTLIER</div>
        <div className="mt-2 flex items-center gap-1 text-sm">
          <span className="text-muted-foreground">service:</span>
          <span className="rounded bg-normal/20 px-1.5 py-0.5 font-medium text-foreground">openssh</span>
        </div>
        <div className="mt-1 h-[100px] flex-1">
          <ChartContainer config={chartConfig} className="h-full w-full">
            <AreaChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
              <Area dataKey="density" fill="var(--color-density)" fillOpacity={0.14} stroke="var(--color-density)" strokeWidth={1.5} type="monotone" />
            </AreaChart>
          </ChartContainer>
        </div>
        <div className="mt-3 text-[11px] font-medium tracking-wide text-muted-foreground">
          {Math.round(maximum)} peak density
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-label="Error density">
          <div className="w-full max-w-4xl rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Error density</p>
                <p className="text-xs text-muted-foreground">Smoothed anomalous-log volume over the last 24 hours</p>
              </div>
              <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setOpen(false)} type="button" aria-label="Close error density">
                <X className="size-4" />
              </button>
            </div>
            <ErrorDensity data={data} />
          </div>
        </div>
      )}
    </>
  )
}
