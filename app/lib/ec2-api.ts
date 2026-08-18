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

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "")

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`)
  if (!response.ok) throw new Error(`API request failed (${response.status})`)
  return response.json()
}

export function getLogEvents() {
  return getJson<LogEvent[]>("/api/events?limit=200")
}

export function getLogIntervals() {
  return getJson<LogInterval[]>("/api/metrics/events-per-interval?hours=48")
}
