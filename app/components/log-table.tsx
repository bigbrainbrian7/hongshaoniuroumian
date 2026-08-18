"use client"

import { useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"
import { getLogEvents, type LogEvent } from "@/lib/ec2-api"

// Highlight tokens, ids, HTTP paths and status codes to mimic the reference
function renderContent(raw: string) {
  const parts: React.ReactNode[] = []
  let key = 0

  // token=... / session_id: ...
  const kvMatch = raw.match(/(token=|session_id: )(\S+)/)
  if (kvMatch) {
    const [full, label, val] = kvMatch
    const idx = raw.indexOf(full)
    parts.push(<span key={key++}>{raw.slice(0, idx + label.length)}</span>)
    parts.push(
      <span key={key++} className="text-link">
        {val}
      </span>,
    )
    return parts
  }

  // "GET /api/... HTTP/1.1" 200 17
  const httpMatch = raw.match(/^("[A-Z]+ )(\/\S+)( HTTP\/1\.1" )(\d{3})( \d+)$/)
  if (httpMatch) {
    const [, method, path, mid, status, rest] = httpMatch
    parts.push(<span key={key++}>{method}</span>)
    parts.push(
      <span key={key++} className="text-link">
        {path}
      </span>,
    )
    parts.push(<span key={key++}>{mid}</span>)
    parts.push(
      <span key={key++} className="text-success">
        {status}
      </span>,
    )
    parts.push(<span key={key++}>{rest}</span>)
    return parts
  }

  return raw
}

function hostFromLog(raw: string) {
  return raw.match(/^\w{3}\s+\d+\s+\S+\s+(\S+)/)?.[1] ?? "—"
}

function serviceFromLog(raw: string) {
  return raw.match(/^\w{3}\s+\d+\s+\S+\s+\S+\s+([\w.-]+)(?:\[\d+\])?:/)?.[1] ?? "—"
}

export function LogTable() {
  const [logs, setLogs] = useState<LogEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadLogs() {
      try {
        setLogs((await getLogEvents()).reverse())
        setError(null)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load logs")
      }
    }

    void loadLogs()
    const timer = window.setInterval(loadLogs, 10_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-semibold tracking-wide text-muted-foreground">
            <th className="py-2 pl-2 pr-4 font-semibold">
              <span className="inline-flex items-center gap-1">
                <span aria-hidden>↓</span> DATE
              </span>
            </th>
            <th className="py-2 pr-4 font-semibold">HOST</th>
            <th className="py-2 pr-4 font-semibold">SERVICE</th>
            <th className="py-2 pr-4 font-semibold">CONTENT</th>
          </tr>
        </thead>
        <tbody className="font-mono text-[13px]">
          {logs.map((row) => {
            const anomalous = Boolean(row.scored) && row.template_similarity !== null && row.template_similarity < 0.95
            return (
              <tr
                key={row.id}
                className="border-b border-border/60 hover:bg-muted/50"
              >
                <td className="whitespace-nowrap py-1.5 pl-2 pr-4 align-top text-foreground">
                  <span className={`mr-2 inline-block h-3 w-0.5 translate-y-0.5 rounded ${anomalous ? "bg-abnormal" : "bg-normal"}`} />
                {new Date(row.recorded_at).toLocaleString()}
                </td>
                <td className="max-w-[280px] truncate py-1.5 pr-4 align-top text-muted-foreground">{hostFromLog(row.raw_line)}</td>
                <td className="whitespace-nowrap py-1.5 pr-4 align-top text-foreground">
                  {serviceFromLog(row.raw_line)}
                </td>
                <td className="py-1.5 pr-4 align-top text-foreground">
                  <span className="flex items-start gap-1">
                    <ChevronRight className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    <span className="whitespace-pre-wrap break-all">
                      {renderContent(row.score_error ?? row.raw_line)}
                    </span>
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {error && <p className="p-3 text-sm text-destructive">{error}</p>}
      {!logs.length && !error && <p className="p-3 text-sm text-muted-foreground">No log events yet.</p>}
    </div>
  )
}
