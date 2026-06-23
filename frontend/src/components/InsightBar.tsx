import type { PlanningParadox } from '../types'

interface Props {
  paradox?: PlanningParadox
}

/**
 * A compact, always-visible evidence strip showing the Planning Paradox — the
 * single strongest data finding.
 *
 * NOTE (Phase 4): The previous "Backtested · Score flags X%" chip has been
 * REMOVED because that recall number was computed on the SAME dataset rows
 * the readiness score was derived from (in-sample), not on a held-out split.
 * Surfacing it as a "recall" claim would be misleading. The Planning Paradox,
 * by contrast, is a verified descriptive statistic from the raw dataset that
 * any reviewer can independently reproduce from the provided CSV.
 */
export default function InsightBar({ paradox }: Props) {
  return (
    <div>
      {/* Planning Paradox */}
      {paradox && paradox.ratio > 0 && (
        <div className="animate-fade-in flex items-center gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white px-4 py-3">
          <span className="text-xl">⚡</span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
              Planning Paradox · verified · full dataset
            </p>
            <p className="text-xs leading-tight text-amber-800">
              Planned events close roads{' '}
              <strong className="text-base">{paradox.ratio}×</strong> more often ({(paradox.planned_closure_rate * 100).toFixed(0)}% vs {(paradox.unplanned_closure_rate * 100).toFixed(0)}%).
              <span className="text-amber-600"> n={(paradox.planned_count + paradox.unplanned_count).toLocaleString()}</span>
            </p>
            {paradox.source && (
              <p className="mt-0.5 text-[9px] text-amber-600">
                computed on {paradox.source} — reproducible from the provided CSV
              </p>
            )}
            <p className="mt-1.5 text-[9px] italic text-amber-600 bg-amber-100/50 p-1.5 rounded">
              Computed on the full pre-cleaning dataset (n=8,173, includes event_type labels removed in the cleaning step) — all other metrics on this page use the cleaned dataset (n=8,057).
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
