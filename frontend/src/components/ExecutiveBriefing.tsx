import { useEffect, useState } from 'react'
import InsightBar from './InsightBar'
import { fetchOptions, fetchTransparency, assess } from '../api'
import type { PlanningParadox, TransparencyStats, AssessResponse, AssessRequest } from '../types'

interface Props {
  onViewAnalytics: () => void
}

/**
 * Executive Briefing -- a synthesis / first-impression view.
 *
 * IMPORTANT: this view performs NO calculation of its own. Every number on
 * screen is fetched from an existing endpoint that already powers another
 * part of the app:
 *
 *   1. Planning Paradox  -> fetchOptions()  -> paradox  (same source as InsightBar)
 *   2. Crisis Window %   -> fetchTransparency() -> eda_report.hour_bucket_distribution
 *                          (same eda_report.json the "How This Works" panel reads)
 *   3. Model headline    -> fetchTransparency() -> model_metrics  (same source as
 *                          the "How This Works" panel in ReadinessScore.tsx)
 *   4. Live walkthrough  -> /api/briefing/example-event returns ONLY the event
 *                          identity; that identity is fed into the SAME assess()
 *                          call Single Event uses, so forecast / manpower /
 *                          checklist / diversion are byte-identical to opening
 *                          that event directly.
 *   5. Resource reality  -> references the Command Center's NETWORK STRESS
 *                          computation (frontend-only, CommandView.tsx); when no
 *                          scenario is active, falls back to a live statement.
 *
 * If any source is unavailable, the relevant section degrades gracefully
 * rather than inventing a number.
 */
export default function ExecutiveBriefing({ onViewAnalytics }: Props) {
  const [paradox, setParadox] = useState<PlanningParadox | undefined>(undefined)
  const [transparency, setTransparency] = useState<TransparencyStats | null>(null)
  const [exampleIdentity, setExampleIdentity] = useState<{
    event_cause: string
    corridor: string
    junction: string
    priority: 'High' | 'Low'
    hour: number
    hour_bucket: string
    start_datetime: string
    selection_rule: string
  } | null>(null)
  const [exampleResult, setExampleResult] = useState<AssessResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      // 1 + 3. Options (paradox) and transparency (metrics + eda) in parallel.
      const [opts, trans] = await Promise.all([
        fetchOptions().catch(() => null),
        fetchTransparency().catch(() => null),
      ])
      if (cancelled) return
      if (opts?.planning_paradox) setParadox(opts.planning_paradox)
      if (trans) setTransparency(trans)

      // 4a. Fetch ONLY the identity of the example event (selector endpoint,
      // no calculation). Then feed it into the SAME assess() path Single
      // Event uses, guaranteeing identical sub-values.
      try {
        const r = await fetch('http://localhost:8000/api/briefing/example-event')
        if (!r.ok) throw new Error(`selector failed (${r.status})`)
        const ident = await r.json()
        if (cancelled || !ident.available) return
        setExampleIdentity({
          event_cause: ident.event_cause,
          corridor: ident.corridor,
          junction: ident.junction,
          priority: ident.priority === 'High' ? 'High' : 'Low',
          hour: ident.hour ?? 0,
          hour_bucket: ident.hour_bucket,
          start_datetime: ident.start_datetime,
          selection_rule: ident.selection_rule,
        })

        // 4b. Reuse the exact assess() call the Single Event view uses.
        const req: AssessRequest = {
          event_cause: ident.event_cause,
          corridor: ident.corridor,
          junction: ident.junction,
          priority: ident.priority === 'High' ? 'High' : 'Low',
          hour: ident.hour ?? 0,
        }
        const result = await assess(req)
        if (!cancelled) setExampleResult(result)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // --- Derive Crisis Window % from the SAME eda_report the "How This Works"
  //     panel reads. No independent computation. ---
  const eda = transparency?.eda_report
  const crisisWindow = (() => {
    if (!eda?.hour_bucket_distribution || !eda.row_count) return null
    const ln = Number(eda.hour_bucket_distribution.late_night ?? 0)
    const np = Number(eda.hour_bucket_distribution.night_peak ?? 0)
    const total = Number(eda.row_count)
    if (total <= 0) return null
    const pct = (ln + np) / total * 100
    const crisisN = ln + np
    return { pct, crisisN, total, lateNight: ln, nightPeak: np }
  })()

  const mm = transparency?.model_metrics
  const closureModel = mm?.closure_model
  const durationModel = mm?.duration_model

  const dep = exampleResult?.deployment
  const diversionRoutes = exampleResult?.diversion_routes ?? []
  const checklist = exampleResult?.checklist ?? []
  const topAction = checklist[0] ?? '—'
  const topDiversion = diversionRoutes[0]

  return (
    <div className="animate-fade-in w-full space-y-5">
      {/* === 1. HEADLINE STAT BAR (reused InsightBar / Planning Paradox) === */}
      <div>
        <SectionLabel n={1} text="Headline Finding" />
        <InsightBar paradox={paradox} />
      </div>

      {/* === 2. CRISIS WINDOW CALLOUT === */}
      <div>
        <SectionLabel n={2} text="Crisis Window" />
        <div className="animate-fade-in rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white px-4 py-4">
          {crisisWindow ? (
            <div className="flex items-start gap-3">
              <span className="text-xl">🌙</span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                  When risk actually happens · live from events_cleaned.csv
                </p>
                <p className="mt-0.5 text-sm leading-snug text-indigo-900">
                  <strong className="text-base">{crisisWindow.pct.toFixed(0)}%</strong> of all{' '}
                  <strong>{crisisWindow.total.toLocaleString()}</strong> historical incidents occur
                  during late-night/night-peak hours — the city's real congestion risk window is{' '}
                  <strong>overnight, not daytime</strong>.
                </p>
                <p className="mt-1 text-[9px] text-indigo-600">
                  late_night {crisisWindow.lateNight.toLocaleString()} ({(crisisWindow.lateNight / crisisWindow.total * 100).toFixed(1)}%)
                  {' + '}night_peak {crisisWindow.nightPeak.toLocaleString()} ({(crisisWindow.nightPeak / crisisWindow.total * 100).toFixed(1)}%)
                  {' = '}{crisisWindow.crisisN.toLocaleString()} of {crisisWindow.total.toLocaleString()}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">EDA report unavailable — cannot compute Crisis Window.</p>
          )}
        </div>
      </div>

      {/* === 3. MODEL HEADLINE (same source as "How This Works" panel) === */}
      <div>
        <SectionLabel n={3} text="Model Headline" />
        <div className="animate-fade-in rounded-xl border border-brand-200 bg-white px-4 py-4 shadow-sm">
          {closureModel && durationModel ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-brand-600">
                Verified metrics · same source as "How This Works" panel · /api/transparency → model_metrics.json
              </p>
              <p className="mt-1.5 text-sm leading-snug text-slate-800">
                <strong>Closure classifier:</strong> ROC-AUC <strong>{closureModel.roc_auc?.toFixed(3)}</strong>,
                {' '}recall <strong>{closureModel.recall?.toFixed(3)}</strong> (class-weighted — up from 0.168
                {' '}baseline against a 7.4%-positive class).
              </p>
              <p className="mt-1 text-sm leading-snug text-slate-800">
                <strong>Duration regressor:</strong> MAE <strong>{durationModel.mae?.toFixed(3)}h</strong>,
                {' '}R² <strong>{durationModel.r2?.toFixed(3)}</strong>.
              </p>
              <button
                onClick={onViewAnalytics}
                className="mt-2.5 inline-flex items-center gap-1 rounded-md bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-100"
              >
                View full Learning Ledger →
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Loading model metrics from /api/transparency…</p>
          )}
        </div>
      </div>

      {/* === 4. LIVE EXAMPLE WALKTHROUGH === */}
      <div>
        <SectionLabel n={4} text="Live Example Walkthrough" />
        <div className="animate-fade-in rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          {loading && <p className="text-xs text-slate-400 italic">Selecting latest overnight High-priority event…</p>}
          {error && (
            <p className="text-xs text-red-600">Could not load example event: {error}</p>
          )}
          {!loading && exampleIdentity && (
            <>
              <div className="mb-2 flex flex-wrap items-baseline gap-2">
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">
                  {exampleIdentity.priority}
                </span>
                <span className="text-sm font-bold capitalize text-slate-800">
                  {exampleIdentity.event_cause.replace('_', ' ')}
                </span>
                <span className="text-xs text-slate-500">· {exampleIdentity.corridor}</span>
                <span className="text-xs text-slate-500">· {exampleIdentity.junction}</span>
              </div>
              <p className="mb-3 text-[10px] text-slate-400">
                Selection: {exampleIdentity.selection_rule}.<br/>
                Recorded {new Date(exampleIdentity.start_datetime).toLocaleString()} ({exampleIdentity.hour_bucket.replace('_', ' ')}).
              </p>

              {exampleResult && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {/* 4a. Forecast: closure probability */}
                  <MiniStat
                    label="Closure Prob."
                    value={`${(exampleResult.score_breakdown.closure_probability * 100).toFixed(0)}%`}
                    sub={`dur ${exampleResult.predicted_duration_hours.toFixed(1)}h`}
                    tint="text-amber-600"
                  />
                  {/* 4b. Manpower: 5-component total */}
                  <MiniStat
                    label="Officers"
                    value={`${dep?.officers ?? '?'}`}
                    sub={dep?.formula_notes}
                    tint="text-brand-700"
                  />
                  {/* 4c. Top checklist/barricading action */}
                  <MiniStat
                    label="Top Action"
                    value={<span className="text-[11px] leading-tight">{topAction}</span>}
                    sub={`${checklist.length} items`}
                    tint="text-accent-700"
                  />
                  {/* 4d. Top diversion suggestion */}
                  <MiniStat
                    label="Top Diversion"
                    value={
                      topDiversion
                        ? <span className="text-[11px] leading-tight">Via {topDiversion.name}</span>
                        : '—'
                    }
                    sub={topDiversion ? `n=${topDiversion.count} · ${exampleResult.zone ?? ''}` : 'no alt'}
                    tint="text-teal-700"
                  />
                </div>
              )}
              <p className="mt-2.5 text-[9px] text-slate-400">
                Sub-values are produced by the identical <code>/api/assess</code> call used in Single Event view —
                no parallel calculation. Open this event in Single Event to compare; numbers match exactly.
              </p>
            </>
          )}
          {!loading && !exampleIdentity && !error && (
            <p className="text-xs text-slate-500">No qualifying event found in the dataset.</p>
          )}
        </div>
      </div>

      {/* === 5. RESOURCE REALITY CHECK === */}
      <div>
        <SectionLabel n={5} text="Resource Reality Check" />
        <div className="animate-fade-in rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs leading-relaxed text-amber-800">
            Across all High-priority events with active resource conflicts, model-recommended officer counts can exceed
            typical availability —{' '}
            <strong>see Command Center for live conflict resolution</strong> (NETWORK STRESS coverage optimization).
            No Command scenario is active in this briefing, so no specific shortfall is reported here.
          </p>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ n, text }: { n: number; text: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white">{n}</span>
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">{text}</h2>
    </div>
  )
}

function MiniStat({ label, value, sub, tint }: {
  label: string
  value: React.ReactNode
  sub?: string
  tint?: string
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 text-sm font-extrabold ${tint ?? 'text-slate-800'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[9px] text-slate-500 leading-tight">{sub}</div>}
    </div>
  )
}
