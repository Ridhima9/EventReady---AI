
import type { AssessResponse, AssessRequest } from '../types'
import { assess } from '../api'
import type { FormState } from './FormCard'
import ReadinessScore from './ReadinessScore'
import ScoreBreakdown from './ScoreBreakdown'
import SimilarEventsList from './SimilarEventsList'
import SpatialMatrix from './SpatialMatrix'
import ScenarioComparison from './ScenarioComparison'
import LogOutcomeButtons from './LogOutcomeButtons'
import EventMap from './EventMap'
import DeploymentCard from './DeploymentCard'
import CongestionBadge from './CongestionBadge'

import type { EventEntry } from '../types'

import GoldenHourCountdown from './GoldenHourCountdown'

interface Props {
  result: AssessResponse
  form: FormState
  onReset: () => void
  onResult: (r: AssessResponse) => void
  commandEvents?: EventEntry[]
}

function buildRequest(form: FormState, hourOverride?: number): AssessRequest {
  return {
    event_cause: form.event_cause,
    corridor: form.corridor,
    junction: form.junction,
    priority: form.priority,
    hour: hourOverride ?? form.hour,
  }
}

export default function ResultCard({ result, form, onReset, onResult, commandEvents = [] }: Props) {
  const extraLines: string[] = []

  return (
    <div className="animate-fade-in w-full rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60">
      {/* --- Top Header (Score & Controls) --- */}
      <div className="flex items-start justify-between">
        <button
          onClick={onReset}
          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-200"
        >
          ← New Assessment
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <GoldenHourCountdown />
          {result.congestion && <CongestionBadge congestion={result.congestion} />}
        </div>
      </div>

      {/* Police station + priority badges */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${form.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
          {form.priority} Priority
        </span>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">
          {result.hour_bucket}
        </span>
        {form.corridor && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
            🛣 {form.corridor}
          </span>
        )}
        {form.junction && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
            ⤴ {form.junction}
          </span>
        )}
        {result.nearest_police_station && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
            🏛 {result.nearest_police_station}
          </span>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-[260px_1fr]">
        <div className="space-y-4">
          <ReadinessScore score={result.readiness_score} />
          {/* Feedback-loop proof: when prior "Understaffed" logs have raised
              this corridor's urgency, show it inline so the loop is visible
              without the (transient) toast. */}
          {result.memory_score_boost ? (
            <div className="animate-fade-in rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              ⚡ +{result.memory_score_boost} from {result.memory_modifier ?? 0} prior
              Understaffed log{result.memory_modifier === 1 ? '' : 's'} for this corridor
              <span className="block text-[10px] text-amber-600">feedback loop active — logged outcomes raise future urgency</span>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-300 to-brand-500"></div>
            <div className="text-3xl font-bold text-slate-800 flex items-baseline justify-center gap-1">
              {result.predicted_duration_hours.toFixed(1)}h
              <span className="text-sm font-medium text-slate-500">
                ± {result.confidence === 'high' ? '0.2' : result.confidence === 'medium' ? '0.5' : '1.0'}h
              </span>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">Predicted Duration</div>
            <div className="text-[9px] text-slate-500 mt-0.5">90th Percentile Confidence Band</div>
          </div>
          {result.deployment && <DeploymentCard deployment={result.deployment} />}
        </div>
        <div className="space-y-4">
          <ScoreBreakdown breakdown={result.score_breakdown} />
          {/* Phase 1 — Learning Insight card.
              Shown ONLY when memory_score_boost > 0, i.e. when a prior
              "Understaffed" log for this (corridor, event_cause) actually
              changed the readiness score and/or deployment count. When the
              modifier is zero (no feedback yet), nothing renders here. */}
          {result.memory_score_boost && result.memory_score_boost > 0 && (
            <div className="animate-fade-in rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm">💡</span>
                <h3 className="text-sm font-semibold text-amber-800">Learning Insight</h3>
              </div>
              <p className="text-xs leading-relaxed text-amber-700">
                Previous events on this corridor were frequently understaffed.<br/>
                Deployment recommendation adjusted upward using post-event feedback.
              </p>
            </div>
          )}
          <SimilarEventsList
            events={result.similar_events}
            historicalMatchCount={result.historical_match_count}
            confidence={result.confidence}
            confidenceNote={result.confidence_note}
          />
        </div>
      </div>

      {/* Mappls Map Integration (Priority 2) */}
      <div className="mt-5">
        <EventMap
          lat={result.corridor_geo?.lat ?? 12.9716}
          lng={result.corridor_geo?.lng ?? 77.5946}
          diversion={result.corridor_geo?.diversion ?? []}
          approximate_location={result.corridor_geo?.approximate_location}
          diversionRoutes={result.diversion_routes?.map((r) => ({
            name: r.name,
            path: r.path ?? [],
          }))}
        />
      </div>

      <div className="mt-5 space-y-5">
        <SpatialMatrix checklist={result.checklist} extraLines={extraLines} diversionRoutes={result.diversion_routes} commandEvents={commandEvents} />
        <ScenarioComparison baseState={form} currentScore={result.readiness_score} />
        <LogOutcomeButtons
          event_cause={form.event_cause}
          corridor={form.corridor}
          junction={form.junction}
          hour_bucket={result.hour_bucket}
          currentScore={result.readiness_score}
          onReassess={async () => {
            // Re-assess with the same hour the current view uses, so the
            // feedback boost is visible in the exact score on screen.
            const hour = form.hour
            const r = await assess(buildRequest(form, hour))
            onResult(r)
            return r
          }}
        />
      </div>

      <p className="mt-6 border-t border-slate-100 pt-3 text-center text-[11px] text-slate-500">
        Recommendations based on historical patterns. Final decisions rest with the commanding officer.
      </p>
    </div>
  )
}
