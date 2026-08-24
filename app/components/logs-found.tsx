"use client"

import { useEffect, useState } from "react"
import { getLogSummary } from "@/lib/ec2-api"

const countFormatter = new Intl.NumberFormat("en-US")

export function LogsFound() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    async function loadCount() {
      try {
        setCount((await getLogSummary()).total_events)
      } catch {
        setCount(null)
      }
    }

    void loadCount()
    const timer = window.setInterval(loadCount, 10_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-semibold tabular-nums text-foreground">
        {count === null ? "—" : countFormatter.format(count)}
      </span>{" "}
      logs found
    </p>
  )
}
