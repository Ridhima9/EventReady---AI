import type { AnalyticsStats, AssessRequest, AssessResponse, FormOptions, ImpactStats, LogRequest, TransparencyStats } from './types'

const BASE_URL = 'https://eventready-ai.onrender.com'

export async function fetchOptions(): Promise<FormOptions> {
  const res = await fetch(`${BASE_URL}/api/options`)
  if (!res.ok) {
    throw new Error(`Options failed (${res.status}): ${res.statusText}`)
  }
  return (await res.json()) as FormOptions
}

export async function fetchAnalytics(): Promise<AnalyticsStats> {
  const empty: AnalyticsStats = {
    available: false,
    events_logged: 0,
    staffing_breakdown: { understaffed: 0, sufficient: 0, overstaffed: 0, understaffed_pct: 0, sufficient_pct: 0, overstaffed_pct: 0 },
    top_problem_corridors: [],
    deployment_adjustment_frequency: 0,
    deployment_adjustment_count: 0,
    recent_logs: [],
  }
  try {
    const res = await fetch(`${BASE_URL}/api/analytics`)
    if (!res.ok) return empty
    return (await res.json()) as AnalyticsStats
  } catch {
    return empty
  }
}

export async function fetchTransparency(): Promise<TransparencyStats> {
  try {
    const res = await fetch(`${BASE_URL}/api/transparency`)
    if (!res.ok) return {}
    return (await res.json()) as TransparencyStats
  } catch {
    return {}
  }
}

export async function fetchImpact(): Promise<ImpactStats> {
  try {
    const res = await fetch(`${BASE_URL}/api/impact`)
    if (!res.ok) return { available: false }
    return (await res.json()) as ImpactStats
  } catch {
    return { available: false }
  }
}

export async function assess(req: AssessRequest): Promise<AssessResponse> {
  const res = await fetch(`${BASE_URL}/api/assess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Assess failed (${res.status}): ${text}`)
  }
  return (await res.json()) as AssessResponse
}

export async function logOutcome(req: LogRequest): Promise<{ status: string }> {
  const res = await fetch(`${BASE_URL}/api/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Log failed (${res.status}): ${text}`)
  }
  return (await res.json()) as { status: string }
}
