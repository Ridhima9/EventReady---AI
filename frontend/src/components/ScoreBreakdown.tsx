import { useState } from 'react'
import type { ScoreBreakdown } from '../types'

interface Props {
  breakdown: ScoreBreakdown
}

const ROWS: { key: keyof ScoreBreakdown; label: string; tooltip: string; weight: number }[] = [
  { key: 'closure_probability', label: 'Closure Probability', tooltip: 'Model-predicted probability that this event forces a road closure.', weight: 30 },
  { key: 'junction_criticality', label: 'Junction Criticality', tooltip: 'Data-driven: incident frequency at this junction, normalised 0–100% against the busiest junction in the dataset (plus a hotspot boost).', weight: 25 },
  { key: 'peak_hour_factor', label: 'Peak Hour Factor', tooltip: '1.0 for night_peak / evening buckets, else 0.5.', weight: 25 },
  { key: 'priority_factor', label: 'Priority Factor', tooltip: "1.0 if priority is 'High', else 0.5.", weight: 20 },
]

export default function ScoreBreakdown({ breakdown }: Props) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-3.5 text-left">
        <span className="text-sm font-semibold text-slate-700">Score Breakdown</span>
        <svg className={`h-4 w-4 text-slate-500 transition ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 px-5 py-4">
          {ROWS.map((row) => {
            const value = breakdown[row.key]
            const pct = Math.round(value * 100)
            return (
              <div key={row.key} className="group relative">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 font-medium text-slate-600">
                    {row.label}
                    <span className="cursor-help text-slate-700 group-hover:text-brand-500">ⓘ</span>
                  </span>
                  <span className="font-semibold text-slate-700">{pct}% · ×{row.weight}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="pointer-events-none absolute left-0 top-5 z-10 hidden max-w-xs rounded-md bg-white px-2.5 py-1.5 text-[11px] text-slate-900 shadow-lg group-hover:block">
                  {row.tooltip}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
