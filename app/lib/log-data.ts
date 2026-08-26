// Deterministic pseudo-random generator so data is stable between renders
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type TimelineBar = {
  time: string
  label: string
  normal: number
  abnormal: number
}

// Build ~96 bars spanning "Apr 3, 10:13am - Apr 5, 10:28am"
export function buildTimeline(): TimelineBar[] {
  const rand = mulberry32(42)
  const bars: TimelineBar[] = []
  const start = new Date("2025-04-03T10:00:00")
  const count = 96
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getTime() + i * 30 * 60 * 1000)
    const hour = d.getHours()
    // Daily rhythm: busier during the day
    const dayFactor = 0.7 + 0.3 * Math.sin(((hour - 6) / 24) * Math.PI * 2)
    const normal = Math.round((11 + rand() * 5) * dayFactor * 1_000_000)
    // Abnormal spikes: occasional bursts
    const burst = i > 30 && i < 36 ? 2.4 : i > 70 && i < 74 ? 1.9 : 1
    const abnormal = Math.round((0.8 + rand() * 1.6) * burst * 1_000_000)

    const hh = d.getHours()
    const label =
      hh === 0
        ? d.getDate() === 4
          ? "Mon 4"
          : "Tue 5"
        : `${String(hh).padStart(2, "0")}:00`
    bars.push({
      time: d.toISOString(),
      label,
      normal,
      abnormal,
    })
  }
  return bars
}

export type SparkPoint = { i: number; value: number }

export type Insight = {
  id: string
  type: "LOG ANOMALY" | "ERROR OUTLIER"
  service: string
  status: "ONGOING" | "RESOLVED"
  ago: string
  axisLeft: string
  axisRight: string
  ticks: [string, string]
  spark: SparkPoint[]
  highlightStart?: number
  highlightEnd?: number
  peakTime?: number
  surgeStartTime?: number
  surgeEndTime?: number
  // for error outlier variant
  errorPct?: number
  logPct?: number
}

export type LogRow = {
  date: string
  host: string
  service: string
  content: React.ReactNode
  raw: string
}

const hosts = [
  "i-0390c843df3bf50e1",
  "i-0e80f7bda4381a14a",
  "i-04bc8d8b18f8ad2b3",
  "gke-us-staging-default-pool-4fe9da96-ws5h.c.da...",
  "vm-8b90b44e-a228-472b-540c-1d4bff689b24.c.data...",
  "gke-demo-11287-us-prod-west-pool-2-ac11bc40-6n...",
]

const contents: string[] = [
  "Found session with token=OMWCUP9XWV0XIGX8PELZ7S9K",
  "Customer address location resolved successfully",
  "Finding cart for session_id: RRBOKCZAQL",
  "Email notification sent",
  '"GET /api/v1/fraud-check/ HTTP/1.1" 200 17',
  '"GET /api/v1/fraud-check/ HTTP/1.1" 200 17',
  '"GET /api/v1/fraud-check/ HTTP/1.1" 200 17',
  "User notified using fax",
  "Notification sent using text",
  "Payment authorized for order #48192",
  "Inventory reservation confirmed",
  "Recommendation model scored 24 items",
  "Cache miss for key product:sku:88213",
  '"POST /api/v1/checkout/ HTTP/1.1" 201 42',
  "Shipping estimate calculated for zone US-W",
]

export function buildLogs(count = 40): LogRow[] {
  const rand = mulberry32(99)
  const rows: LogRow[] = []
  let ms = 503
  for (let i = 0; i < count; i++) {
    const host = hosts[Math.floor(rand() * hosts.length)]
    const raw = contents[Math.floor(rand() * contents.length)]
    ms -= Math.floor(rand() * 2)
    if (ms < 0) ms = 999
    const date = `Apr 05 10:28:${String(19 - Math.floor(i / 8)).padStart(2, "0")}.${String(ms).padStart(3, "0")}`
    rows.push({
      date,
      host,
      service: "web-store",
      raw,
      content: raw,
    })
  }
  return rows
}
