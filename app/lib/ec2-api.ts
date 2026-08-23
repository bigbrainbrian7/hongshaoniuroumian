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

// const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "")
const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://13.220.218.111:6767").replace(/\/$/, "")

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
