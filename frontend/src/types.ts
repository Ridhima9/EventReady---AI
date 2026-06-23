// ---- Request DTOs -------------------------------------------------------

export interface AssessRequest {
  event_cause: string
  corridor: string
  junction: string
  priority: 'High' | 'Low'
  hour_bucket?: string
  hour?: number
}

export interface EventEntry {
  id: number
  event_cause: string
  corridor: string
  junction: string
  priority: 'High' | 'Low'
  hour: number
  result: AssessResponse | null
  loading: boolean
  error: string | null
}

export interface LogRequest {
  event_cause: string
  corridor: string
  junction: string
  hour_bucket: string
  outcome: 'understaffed' | 'sufficient' | 'overstaffed'
  readiness_score?: number
}

// ---- Response DTOs ------------------------------------------------------

export interface NameCount {
  name: string
  count: number
}

export interface SimilarEvent {
  event_cause: string
  corridor: string
  priority: string
  hour_bucket: string
  count: number
  median_duration_hours: number | null
  closure_probability: number | null
  closure_required: boolean
  top_junctions: NameCount[]
  typical_police_stations: NameCount[]
  checklist: string[]
}

export interface ScoreBreakdown {
  closure_probability: number
  junction_criticality: number
  peak_hour_factor: number
  priority_factor: number
}

export interface DeploymentStep {
  label: string
  delta: number
  running: number
  /** True for the final "Final officers" step. */
  final?: boolean
}

export interface Deployment {
  officers: number
  marshals: number
  barricades: number
  formula_notes: string
  /** Structured step-by-step breakdown of the officer-count formula (Phase 5).
   *  Each step carries a running total so the UI can render a clean ladder
   *  without re-deriving hotspot/crowd detection client-side. */
  deployment_steps?: DeploymentStep[]
  total_memory_logs?: number
}

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface Congestion {
  level: 'low' | 'moderate' | 'high'
  percentage: number
  label: string
}

export interface CorridorGeo {
  lat: number
  lng: number
  /** Recorded route_path from the dataset (the affected corridor). Misnamed
   *  `diversion` historically; no routing/alternate-route layer exists. */
  diversion: number[][]
  approximate_location?: boolean
}

export interface PlanningParadox {
  planned_closure_rate: number
  unplanned_closure_rate: number
  ratio: number
  planned_count: number
  unplanned_count: number
  /** Which file the stat was computed from, so the "verified" badge is auditable. */
  source?: string
}

export interface ImpactStats {
  available: boolean
  incidents_backtested?: number
  high_cost_incidents?: number
  recall?: number
  precision?: number
  avg_readiness_score?: number
  summary?: string
  error?: string
}

/** Learning-loop analytics from event_memory.csv (Phase 4). All values are
 *  derived from operator-logged outcomes, NOT from in-sample model evaluation. */
export interface AnalyticsStats {
  available: boolean
  events_logged: number
  staffing_breakdown: {
    understaffed: number
    sufficient: number
    overstaffed: number
    understaffed_pct: number
    sufficient_pct: number
    overstaffed_pct: number
  }
  top_problem_corridors: { corridor: string; understaffed_count: number }[]
  /** % of logged assessments whose (corridor, event_cause) carried a memory
   *  modifier (an understaffed feedback signal) at the time they were logged. */
  deployment_adjustment_frequency: number
  deployment_adjustment_count: number
  recent_logs?: any[]
  /** Distinct (corridor, junction) locations touched by the feedback log --
   *  denominator for the Learning Ledger concentration caveat (e.g. "X of 294"). */
  distinct_junctions?: number
  /** Top 6 (corridor, junction) feedback locations, by log count. */
  top_locations?: { corridor: string; junction: string; count: number }[]
  /** Share of all feedback logs attributable to the top-6 locations, in %. */
  top_k_pct?: number
}

export interface TransparencyStats {
  eda_report?: any
  model_metrics?: any
  feature_importances?: any
  checklist_stats?: any
  hotspot_stats?: any
}

export interface AssessResponse {
  readiness_score: number
  score_breakdown: ScoreBreakdown
  /** # of prior "Understaffed" logs for this (corridor, cause). */
  memory_modifier?: number
  /** Points added to readiness_score by the feedback loop (0 when none). */
  memory_score_boost?: number
  predicted_duration_hours: number
  hour_bucket: string
  similar_events: SimilarEvent[]
  checklist: string[]
  deployment: Deployment
  congestion: Congestion
  corridor_geo: CorridorGeo | null
  diversion_routes?: { name: string; count: number; note: string; path?: number[][] }[]
  nearest_police_station: string
  /** Police zone for the corridor (from the raw dataset). Snapshot field. */
  zone?: string
  /** One-line recommended action, derived from closure/priority. Snapshot field. */
  recommended_action?: string
  /** Phase 2 -- TRUE count of events_cleaned.csv rows for (event_cause, corridor). */
  historical_match_count?: number
  /** Phase 2 -- 'high' (>50 matches), 'medium' (10-50), 'low' (<10). */
  confidence?: ConfidenceLevel
  /** Phase 2 -- present only when confidence='low'. */
  confidence_note?: string | null
}

// ---- Form options (fetched from /api/options, with static fallback) ------

export interface FormOptions {
  event_causes: string[]
  corridors: string[]
  junctions: string[]
  priorities: string[]
  hour_buckets: string[]
  planning_paradox?: PlanningParadox
  /** corridor -> sorted list of junction names that co-occur with it in
   *  events_cleaned.csv. Drives Junction dropdown filtering (BUG 1 fix).
   *  Absent on older backends; the forms fall back to the full list. */
  corridor_junction_map?: Record<string, string[]>
}

// Static fallback only -- used if the backend is unreachable when the form
// first renders. The real values come from GET /api/options, which reads them
// straight out of events_cleaned.csv at backend startup.
export const FALLBACK_OPTIONS: FormOptions = {
  event_causes: ['vehicle_breakdown'],
  corridors: ['Mysore Road'],
  junctions: ['Silk Board Junction'],
  priorities: ['High', 'Low'],
  hour_buckets: ['morning', 'afternoon', 'evening', 'night_peak', 'late_night'],
}

export const HOUR_BUCKETS = [
  'morning',
  'afternoon',
  'evening',
  'night_peak',
  'late_night',
] as const

export type HourBucket = (typeof HOUR_BUCKETS)[number]

// 6-11 morning, 12-16 afternoon, 17-18 evening, 19-22 night_peak, else late_night
export function deriveHourBucket(hour: number): HourBucket {
  const h = ((Math.round(hour) % 24) + 24) % 24
  if (h >= 6 && h <= 11) return 'morning'
  if (h >= 12 && h <= 16) return 'afternoon'
  if (h >= 17 && h <= 18) return 'evening'
  if (h >= 19 && h <= 22) return 'night_peak'
  return 'late_night'
}
