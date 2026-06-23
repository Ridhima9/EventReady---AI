import type { ConfidenceLevel, SimilarEvent } from '../types'

interface Props {
  events: SimilarEvent[]
  /** Phase 2 -- TRUE count of events_cleaned.csv rows for (event_cause, corridor).
   *  Distinct from `events.length` (the rendered top-5 grouped cards). */
  historicalMatchCount?: number
  confidence?: ConfidenceLevel
  /** Phase 2 -- only present when confidence='low'. */
  confidenceNote?: string | null
}

const CONFIDENCE_STYLE: Record<ConfidenceLevel, { label: string; cls: string; icon: string }> = {
  high: { label: 'HIGH confidence', cls: 'text-accent-700 bg-accent-50 border-accent-200', icon: '🟢' },
  medium: { label: 'MEDIUM confidence', cls: 'text-amber-700 bg-amber-50 border-amber-200', icon: '🟡' },
  low: { label: 'LOW confidence', cls: 'text-red-700 bg-red-50 border-red-200', icon: '🔴' },
}

export default function SimilarEventsList({ events, historicalMatchCount, confidence }: Props) {
  const list = events
  const matchCount = historicalMatchCount ?? events.length
  const conf = confidence ? CONFIDENCE_STYLE[confidence] : null
  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Similar Past Events</h3>
        {/* Phase 2: Updated badge formatting per user request */}
        <div className="shrink-0 text-right">
          <div className="text-xs font-medium text-slate-500">
            Historical matches: {matchCount.toLocaleString()}
          </div>
          {conf && (
            <div className={`mt-1 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${conf.cls}`}>
              <span>{conf.icon}</span> {conf.label}
            </div>
          )}
        </div>
      </div>
      {/* Low-confidence operator-discretion note */}
      {confidence === 'low' && (
        <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
          ⚠ Low confidence due to limited historical examples. Use operator discretion.
        </div>
      )}
      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500">
          No historical matches in the index for this combination.
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((ev, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {ev.event_cause} <span className="font-normal text-slate-500">·</span> {ev.corridor}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {ev.priority} · {ev.hour_bucket} · {ev.count} prior incident{ev.count === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-right">
                  <div>
                    <div className="text-sm font-bold text-slate-700">
                      {ev.median_duration_hours != null ? `${ev.median_duration_hours.toFixed(1)}h` : '—'}
                    </div>
                    <div className="text-[10px] text-slate-500">median</div>
                  </div>
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${ev.closure_required ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`} title={ev.closure_required ? 'Closure typically required' : 'Closure not typical'}>
                    {ev.closure_required ? '⛔' : '✓'}
                  </div>
                </div>
              </div>
              {ev.checklist.length > 0 && (
                <p className="mt-2 truncate border-t border-slate-50 pt-2 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-500">Notes:</span> {ev.checklist.join(' · ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
