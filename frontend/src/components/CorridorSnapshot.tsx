/* ─── Corridor Snapshot ──────────────────────────────────────────────────
 *
 * First-class fallback card that replaces the map when Mappls tiles cannot
 * load (missing key, tile error, network failure, Leaflet init crash).
 *
 * Displays the same operational facts the map would have contextualised,
 * drawn from the dataset and the readiness model, so the commanding
 * officer still gets a decision-grade view without map imagery.
 *
 * Deliberately NOT a "broken map" placeholder — it is a premium,
 * self-contained information card.
 * ────────────────────────────────────────────────────────────────────── */

interface Props {
 corridor: string
 junction: string
 zone: string
 policeStation: string
 routePointCount: number
 closureProbability: number
 recommendedAction: string
}

/* ── Row sub-component ──────────────────────────────────────────────── */

function Row({
 icon,
 label,
 value,
 mono = false,
}: {
 icon: string
 label: string
 value: string
 mono?: boolean
}) {
 return (
  <div className="group flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-100">
   <div className="flex items-center gap-2">
    <span className="text-xs text-slate-500">{icon}</span>
    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
     {label}
    </span>
   </div>
   <span
    className={`text-right text-[12px] text-slate-100 ${
     mono ? 'font-mono tabular-nums' : 'font-medium'
    }`}
   >
    {value || '—'}
   </span>
  </div>
 )
}

/* ── Main component ─────────────────────────────────────────────────── */

export default function CorridorSnapshot({
 corridor,
 junction,
 zone,
 policeStation,
 routePointCount,
 closureProbability,
 recommendedAction,
}: Props) {
 const closurePct = Math.round(closureProbability * 100)
 const isHigh = closureProbability >= 0.6
 const isMed = closureProbability >= 0.3
 const closureTone = isHigh ? 'text-red-300' : isMed ? 'text-amber-300' : 'text-emerald-300'
 const barColor = isHigh ? 'bg-red-400' : isMed ? 'bg-amber-400' : 'bg-emerald-400'
 const barGlow = isHigh
  ? 'shadow-red-500/30'
  : isMed
   ? 'shadow-amber-500/30'
   : 'shadow-emerald-500/30'

 return (
  <div className="animate-fade-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
   {/* ── Header ─────────────────────────────────────────────────── */}
   <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 px-4 py-2.5">
    <div className="flex items-center gap-2.5">
     <span className="text-sm">🧭</span>
     <span className="text-xs font-semibold tracking-wide text-slate-900">
      Corridor Snapshot
     </span>
    </div>
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-500 ring-1 ring-slate-300">
     <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500" />
     SCHEMATIC VIEW · DATASET-ONLY
    </span>
   </div>

   {/* ── Body ──────────────────────────────────────────────────── */}
   <div className="px-4 py-4">
    {/* Headline corridor */}
    <div className="mb-3 rounded-lg bg-slate-50 px-3 py-3">
     <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
      Corridor
     </p>
     <p className="mt-0.5 text-base font-bold tracking-wide text-slate-900">
      {corridor || '—'}
     </p>
    </div>

    {/* Info rows */}
    <div className="space-y-0.5">
     <Row icon="⤴" label="Junction" value={junction} />
     <Row icon="🗺" label="Zone" value={zone} />
     <Row icon="🏛" label="Police Station" value={policeStation} />
     <Row icon="📍" label="Route Points" value={routePointCount.toLocaleString()} mono />
    </div>

    {/* ── Closure probability — emphasised since it drives action ── */}
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
     <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
       Historical Closure Probability
      </span>
      <span className={`text-xl font-extrabold tabular-nums ${closureTone}`}>
       {closurePct}%
      </span>
     </div>
     <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div
       className={`h-full rounded-full ${barColor} shadow-md ${barGlow} transition-all duration-700 ease-out`}
       style={{ width: `${Math.max(3, closurePct)}%` }}
      />
     </div>
    </div>

    {/* ── Recommended action ──────────────────────────────────── */}
    <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
     <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
      Recommended Action
     </p>
     <p className="mt-1 text-[12px] font-medium leading-relaxed text-indigo-100">
      {recommendedAction || '—'}
     </p>
    </div>
   </div>
  </div>
 )
}
