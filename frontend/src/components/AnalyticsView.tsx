import React, { useEffect, useState } from 'react'
import { fetchAnalytics, fetchTransparency } from '../api'
import type { AnalyticsStats, TransparencyStats } from '../types'

/**
 * "Backtest & Learning Analytics" — single merged analytics page (Phase 4).
 *
 * All metrics come from event_memory.csv (operator-logged outcomes), NOT from
 * in-sample model evaluation. This is a key credibility distinction: a "recall
 * %" computed on the same data the model was trained on is not a held-out
 * claim, so we deliberately omit such numbers here.
 *
 * Deliberately omitted:
 *   - Average duration error: no field links a logged outcome back to the
 *     specific predicted_duration shown, so predicted-vs-actual cannot be
 *     computed honestly.
 *   - Any "X% would have been caught" recall claim: the readiness score was
 *     derived from events_cleaned.csv, so backtesting it against the same
 *     rows is in-sample. Per the project rules, this is omitted unless
 *     computed on a genuinely held-out split.
 */

/** Empty fallback analytics when the backend is unreachable. */
const EMPTY: AnalyticsStats = {
  available: false,
  events_logged: 0,
  staffing_breakdown: { understaffed: 0, sufficient: 0, overstaffed: 0, understaffed_pct: 0, sufficient_pct: 0, overstaffed_pct: 0 },
  top_problem_corridors: [],
  deployment_adjustment_frequency: 0,
  deployment_adjustment_count: 0,
}

export default function AnalyticsView() {
  const [stats, setStats] = useState<AnalyticsStats>(EMPTY)
  const [transparency, setTransparency] = useState<TransparencyStats>({})
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAnalytics().then((s) => {
      if (!cancelled) setStats(s)
    })
    fetchTransparency().then((t) => {
      if (!cancelled) setTransparency(t)
    })
    return () => { cancelled = true }
  }, [])

  const sb = stats.staffing_breakdown
  const total = stats.events_logged

  return (
    <div className="animate-fade-in w-full">
      <div className="mb-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
          Backtest &amp; Learning Analytics
        </h2>
        <p className="text-xs text-slate-500">
          Metrics from operator-logged outcomes in event_memory.csv — not in-sample model evaluation.
        </p>
      </div>

      {/* Summary cards row */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-2">
        <MetricCard icon="👮" label="Events Logged" value={total.toLocaleString()} sub="operator outcomes" />
        <MetricCard icon="⚡" label="Deployment Adj. Frequency" value={`${stats.deployment_adjustment_frequency}%`} sub={`${stats.deployment_adjustment_count} of ${total} assessments modified`} />
      </div>

      {/* Staffing breakdown caveat */}
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm text-amber-800">
        <h3 className="mb-2 text-sm font-semibold flex items-center gap-2">
          <span className="text-amber-600">⚠</span> Live Field Feedback Caveat
        </h3>
        <p className="text-xs leading-relaxed">
          {total} outcomes logged during development testing, concentrated across {stats.distinct_junctions ?? '?'} of 294 dataset junctions
          ({stats.top_locations?.slice(0, 6).map((l) => l.corridor).join(', ') || '—'} = {stats.top_k_pct ?? '?'}% of logs)
          — reflects repeated testing of high-priority/resource-constrained scenarios,
          not a representative measurement of real-world deployment accuracy.
          Outcomes: {sb.understaffed} understaffed, {sb.sufficient} sufficient, {sb.overstaffed} overstaffed.
        </p>
      </div>

      {/* Learning Ledger — vertical timeline */}
      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-700 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
          Learning Ledger
        </h3>
        <div className="relative ml-3 border-l-2 border-brand-200 pl-6 space-y-5">
          {/* Entry 1 */}
          <div className="relative">
            <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[8px] font-bold text-white ring-2 ring-white">1</span>
            <p className="text-xs text-slate-700 leading-relaxed">
              Model trained on <strong>8,057</strong> historical incidents. Initial closure-detection recall: <strong>16.8%</strong> — missed roughly 5 out of every 6 real road closures.
            </p>
          </div>
          {/* Entry 2 */}
          <div className="relative">
            <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[8px] font-bold text-white ring-2 ring-white">2</span>
            <p className="text-xs text-slate-700 leading-relaxed">
              Root cause: road closures are only <strong>7.4%</strong> of all incidents (596 of 8,057) — model defaulted toward predicting "no closure" to maximize raw accuracy on the majority class.
            </p>
          </div>
          {/* Entry 3 */}
          <div className="relative">
            <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[8px] font-bold text-white ring-2 ring-white">3</span>
            <p className="text-xs text-slate-700 leading-relaxed">
              Fix: class-weighted training. Result: recall improved to <strong>53.8%</strong>. Tradeoff: precision dropped from 52.6% to 19.3% — accepted because a missed closure is operationally costlier than a false alarm. ROC-AUC: <strong>0.734</strong>.
            </p>
          </div>
          {/* Entry 4 */}
          <div className="relative">
            <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[8px] font-bold text-white ring-2 ring-white">4</span>
            <p className="text-xs text-slate-700 leading-relaxed">
              Duration regressor: MAE <strong>0.757 hours</strong> (~45 min), R² <strong>0.182</strong> — an honest, modest result; duration is inherently hard to predict from category/location/time alone.
            </p>
          </div>
          {/* Entry 5 — LIVE */}
          <div className="relative">
            <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-white ring-2 ring-white animate-pulse">5</span>
            <p className="text-xs text-slate-700 leading-relaxed">
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600 ring-1 ring-inset ring-emerald-200 mr-1">LIVE</span>
              <strong>{total}</strong> field outcomes logged (<strong>{sb.understaffed}</strong> understaffed, <strong>{sb.sufficient}</strong> sufficient, <strong>{sb.overstaffed}</strong> overstaffed), concentrated across <strong>{stats.distinct_junctions ?? '?'}</strong> of 294 junctions
              {stats.top_locations && stats.top_locations.length > 0 && (
                <> ({stats.top_locations.map((l) => l.corridor).join(', ')} = {stats.top_k_pct}% of logs)</>
              )} — reflects development testing, not broad field validation.
            </p>
          </div>
        </div>
      </div>

      {/* Top problematic corridors */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Top Problematic Corridors</h3>
        {stats.top_problem_corridors.length === 0 ? (
          <p className="text-xs text-slate-500">
            No understaffed logs yet. Log outcomes from the Single Event view to populate this chart.
          </p>
        ) : (
          <div className="space-y-2">
            {stats.top_problem_corridors.map((c, i) => {
              const maxCount = stats.top_problem_corridors[0]?.understaffed_count ?? 1
              const pct = Math.max(5, (c.understaffed_count / maxCount) * 100)
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 text-right text-[10px] font-bold text-slate-500">{i + 1}</span>
                  <span className="w-32 truncate text-xs font-semibold text-slate-700">{c.corridor}</span>
                  <div className="flex-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-red-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-xs font-bold text-red-600">{c.understaffed_count}</span>
                </div>
              )
            })}
          </div>
        )}
        <p className="mt-3 text-[9px] text-slate-500 leading-relaxed">
          Ranked by count of "Understaffed" outcome logs per corridor. Source: event_memory.csv.
        </p>
      </div>

      {/* Feature 3: Feature Importances */}
      {transparency.feature_importances && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Model Feature Importances</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs font-semibold text-slate-600 mb-2">Closure Probability Model</h4>
              <div className="space-y-2">
                {Object.entries(transparency.feature_importances.closure_model || {})
                  .sort((a, b) => Number(b[1]) - Number(a[1]))
                  .map(([feat, imp]) => {
                    const pct = Number(imp) * 100
                    return (
                      <div key={feat} className="flex items-center gap-3">
                        <span className="w-24 truncate text-xs font-medium text-slate-700">{feat}</span>
                        <div className="flex-1 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-10 text-right text-xs font-semibold text-brand-600">{pct.toFixed(1)}%</span>
                      </div>
                    )
                  })}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-600 mb-2">Predicted Duration Model</h4>
              <div className="space-y-2">
                {Object.entries(transparency.feature_importances.duration_model || {})
                  .sort((a, b) => Number(b[1]) - Number(a[1]))
                  .map(([feat, imp]) => {
                    const pct = Number(imp) * 100
                    return (
                      <div key={feat} className="flex items-center gap-3">
                        <span className="w-24 truncate text-xs font-medium text-slate-700">{feat}</span>
                        <div className="flex-1 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-10 text-right text-xs font-semibold text-brand-600">{pct.toFixed(1)}%</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature 4: Hotspot Junctions */}
      {transparency.hotspot_stats && transparency.hotspot_stats.length > 0 && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Hotspot Junctions Profile</h3>
            <span className="text-[10px] text-slate-500">Fixed list of 8 critical nodes</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2">Junction</th>
                  <th className="px-3 py-2 text-right">Incidents</th>
                  <th className="px-3 py-2 text-right">High Priority %</th>
                  <th className="px-3 py-2 text-right">Closure Req %</th>
                  <th className="px-3 py-2">Dominant Cause</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {transparency.hotspot_stats.map((h: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-semibold text-slate-700">{h.junction}</td>
                    <td className="px-3 py-2 text-right">{h.count}</td>
                    <td className="px-3 py-2 text-right">{(h.high_priority_pct * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right">{(h.closure_pct * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 capitalize">{h.dominant_cause.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Feature 5: Checklist Evidence & Event Cause Closures */}
      <div className="mt-5 grid md:grid-cols-2 gap-5">
        {transparency.checklist_stats && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Checklist Rule Evidence</h3>
            <p className="text-xs text-slate-500 mb-3">
              Total hotspot-touching event groups: <strong>{transparency.checklist_stats.hotspot_groups}</strong>.
              Below are the exact rule fire counts from the similarity index training run:
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-2">
              {Object.entries(transparency.checklist_stats.rule_counts || {}).map(([rule, count]) => (
                <div key={rule} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 truncate mr-2" title={rule}>{rule}</span>
                  <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded tabular-nums">{String(count)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {transparency.eda_report?.closure_rate_by_event_cause && transparency.eda_report?.event_cause_distribution && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Closure Rates by Cause</h3>
            <p className="text-xs text-slate-500 mb-3">
              Historical probability of requiring a road closure, based on <strong>{transparency.eda_report.row_count.toLocaleString()}</strong> events.
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
              {Object.entries(transparency.eda_report.closure_rate_by_event_cause)
                .sort((a, b) => Number(b[1]) - Number(a[1]))
                .map(([cause, rate]) => {
                  const count = transparency.eda_report.event_cause_distribution[cause]
                  const pct = Number(rate) * 100
                  return (
                    <div key={cause} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 capitalize mr-2 truncate">
                        {cause.replace('_', ' ')}
                        <span className={`ml-1 text-[10px] ${count < 50 ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>
                          (n={count})
                        </span>
                      </span>
                      <span className="font-semibold text-slate-700 tabular-nums">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>

      {/* Prediction Ledger & Recommendation Health */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Prediction Ledger &amp; Recommendation Health</h3>
          {(() => {
            const recentUnderstaffed = (stats.recent_logs?.slice(0, 5) || []).filter(
              (r: any) => r.outcome?.toLowerCase() === 'understaffed'
            ).length
            const isAttention = recentUnderstaffed >= 2
            return isAttention ? (
              <span className="rounded bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-300">
                Attention — understaffed outcomes increasing
              </span>
            ) : (
              <span className="rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-300">
                Stable
              </span>
            )
          })()}
        </div>
        
        {stats.recent_logs && stats.recent_logs.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Cause</th>
                  <th className="px-3 py-2">Corridor / Junction</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {stats.recent_logs.map((log, i) => (
                  <React.Fragment key={i}>
                    <tr 
                      className={`cursor-pointer transition hover:bg-slate-50 ${expandedRow === i ? 'bg-slate-50' : ''}`}
                      onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[10px] text-slate-500">
                        {/* Guard: only parse when a real, non-empty timestamp is
                            present. The backend writes ISO timestamps for every
                            new row, but legacy/synthetic rows in event_memory
                            may carry a null or malformed timestamp — rendering
                            "Invalid Date" would mislead a reviewer. */}
                        {(() => {
                          const ts = log.timestamp
                          if (!ts) return <span className="italic text-slate-400">Awaiting Data</span>
                          const parsed = new Date(ts)
                          if (isNaN(parsed.getTime())) {
                            return <span className="italic text-slate-400">Awaiting Data</span>
                          }
                          return parsed.toLocaleString()
                        })()}
                      </td>
                      <td className="px-3 py-2 capitalize">{log.event_cause || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-700">{log.corridor || '—'}</div>
                        {log.junction && <div className="text-[10px] text-slate-500">{log.junction}</div>}
                      </td>
                      <td className="px-3 py-2 tabular-nums font-medium text-brand-600">
                        {log.readiness_score != null && log.readiness_score !== '' ? log.readiness_score : 'N/A · pre-score'}
                      </td>
                      <td className="px-3 py-2 flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          log.outcome?.toLowerCase() === 'understaffed' ? 'bg-red-50 text-red-600' :
                          log.outcome?.toLowerCase() === 'overstaffed' ? 'bg-slate-100 text-slate-500' :
                          'bg-teal-50 text-teal-600'
                        }`}>
                          {log.outcome || '—'}
                        </span>
                        <span className="text-slate-700 text-[10px]">{expandedRow === i ? '▴' : '▾'}</span>
                      </td>
                    </tr>
                    {expandedRow === i && (
                      <tr className="bg-slate-50">
                        <td colSpan={5} className="px-3 py-3">
                          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                            <h4 className="mb-1 text-[11px] font-bold text-slate-700 uppercase tracking-wider">Post-Event Debrief</h4>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              Review: The deployment for this <span className="font-semibold">{log.event_cause.replace('_', ' ')}</span> was reported as <span className="font-semibold">{log.outcome}</span>. 
                              {log.outcome?.toLowerCase() === 'understaffed' ? (
                                <> The field team experienced a resource shortfall. The EventReady learning loop has ingested this discrepancy and added a <strong>priority penalty</strong>. Future baseline readiness scores for {log.event_cause.replace('_', ' ')} incidents on {log.corridor} will be inherently lower, prompting higher initial resource allocations.</>
                              ) : log.outcome?.toLowerCase() === 'overstaffed' ? (
                                <> The field team reported excess resources. The model baseline was conservative. Future incidents may require slightly fewer officers to preserve reserves.</>
                              ) : (
                                <> The recommended deployment accurately matched the ground reality. The confidence interval for {log.event_cause.replace('_', ' ')} on {log.corridor} has been reinforced.</>
                              )}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500">No logs available in event_memory.csv yet.</p>
        )}
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, sub, accent }: {
  icon: string; label: string; value: string; sub: string; accent?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-1 text-sm">{icon}</div>
      <div className={`text-xl font-extrabold ${accent ?? 'text-slate-800'}`}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-[9px] text-slate-500">{sub}</div>
    </div>
  )
}
