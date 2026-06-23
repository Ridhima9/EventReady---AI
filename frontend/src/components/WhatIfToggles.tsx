interface Props {
 delayActive: boolean
 diversionActive: boolean
 loading?: boolean
 onToggleDelay: () => void
 onToggleDiversion: () => void
}

function Toggle({ on, onClick, label, desc, disabled }: {
 on: boolean; onClick: () => void; label: string; desc: string; disabled?: boolean
}) {
 return (
  <div className="flex flex-1 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
   <div>
    <p className="text-sm font-semibold text-slate-700">{label}</p>
    <p className="text-[11px] text-slate-500">{desc}</p>
   </div>
   <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 ${on ? 'bg-accent-600' : 'bg-slate-300'}`}
    aria-pressed={on}
   >
    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? 'left-[22px]' : 'left-0.5'}`} />
   </button>
  </div>
 )
}

export default function WhatIfToggles({ delayActive, diversionActive, loading, onToggleDelay, onToggleDiversion }: Props) {
 return (
  <div>
   <h3 className="mb-2 text-sm font-semibold text-slate-700">What-If Toggles</h3>
   <div className="flex flex-col gap-2 sm:flex-row">
    <Toggle on={delayActive} onClick={onToggleDelay} disabled={loading} label="Delay event by 2 hours" desc="Re-assess with hour shifted +2" />
    <Toggle on={diversionActive} onClick={onToggleDiversion} label="Trigger diversion 1 km earlier" desc="Add upstream signage to matrix" />
   </div>
  </div>
 )
}
