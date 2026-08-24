export type LogEvent = {
  id: number
  recorded_at: string
  raw_line: string
  template: string | null
  template_similarity: number | null
  scored: number | boolean
  score_error: string | null
}

export type LogInterval = {
  interval_start: string
  normal_logs: number
  abnormal_logs: number
}

export type LogSummary = {
  total_events: number
  scored_events: number
  anomalies: number
}

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "/dashboard-api").replace(/\/$/, "")

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`)
  if (!response.ok) throw new Error(`API request failed (${response.status})`)
  return response.json()
}

export function getLogEvents() {
  return getJson<LogEvent[]>("/api/events?limit=200")
}

export function getAnomalousEvents(start: number, end: number) {
  const parameters = new URLSearchParams({
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  })
  return getJson<LogEvent[]>(`/api/events/anomalies?${parameters}`)
}

export function getLogIntervals(hours = 96) {
  return getJson<LogInterval[]>(`/api/metrics/events-per-interval?hours=${hours}`)
}

export function getLogSummary() {
  return getJson<LogSummary>("/api/metrics/summary")
}
