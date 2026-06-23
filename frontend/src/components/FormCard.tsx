import { useEffect, useState } from 'react'
import { fetchOptions } from '../api'
import { FALLBACK_OPTIONS, deriveHourBucket, type HourBucket, type FormOptions } from '../types'

export interface FormState {
 event_cause: string
 corridor: string
 junction: string
 priority: 'High' | 'Low'
 hour: number
 requires_road_closure: boolean
}

interface Props {
 initial?: Partial<FormState>
 onSubmit: (state: FormState) => void
 loading?: boolean
}

const HOUR_LABEL: Record<HourBucket, string> = {
 morning: 'Morning',
 afternoon: 'Afternoon',
 evening: 'Evening',
 night_peak: 'Night Peak',
 late_night: 'Late Night',
}

const inputClass =
 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100'
const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5'

export default function FormCard({ initial, onSubmit, loading }: Props) {
 const [options, setOptions] = useState<FormOptions | null>(null)
 const [optionsLoading, setOptionsLoading] = useState(true)

 // Fetch dynamic options from backend on mount
 useEffect(() => {
  let cancelled = false
  setOptionsLoading(true)
  fetchOptions()
   .then((opts) => {
    if (!cancelled) setOptions(opts)
   })
   .catch(() => {
    // Backend unreachable — use static fallback so the form still renders
    if (!cancelled) setOptions(FALLBACK_OPTIONS)
   })
   .finally(() => {
    if (!cancelled) setOptionsLoading(false)
   })
  return () => { cancelled = true }
 }, [])

 // Derive sensible defaults once options are loaded
 const opts = options ?? FALLBACK_OPTIONS
 const defaults: FormState = {
  event_cause: opts.event_causes.find(c => c.toLowerCase().includes('breakdown')) ?? opts.event_causes[0] ?? '',
  corridor: opts.corridors[0] ?? '',
  junction: opts.junctions[0] ?? '',
  priority: (opts.priorities[0] as 'High' | 'Low') ?? 'High',
  hour: 20,
  requires_road_closure: false,
 }

 const [form, setForm] = useState<FormState>({ ...defaults, ...initial })

 // BUG 1 fix: Junction dropdown is filtered to only junctions that actually
 // co-occur with the selected Corridor in events_cleaned.csv. Falls back to
 // the full junction list if the backend didn't supply the map.
 const corridorJunctionMap = opts.corridor_junction_map ?? {}
 const junctionOptions: string[] = (() => {
  const mapped = form.corridor ? corridorJunctionMap[form.corridor] : undefined
  return mapped && mapped.length > 0 ? mapped : opts.junctions
 })()

 // When options arrive for the first time, update any empty/default fields
 // so the selects start on a valid value from the live data.
 useEffect(() => {
  if (!options) return
  setForm((prev) => {
   const corridor = prev.corridor && opts.corridors.includes(prev.corridor) ? prev.corridor : opts.corridors[0] ?? ''
   // Junction must be valid for the resolved corridor.
   const jList = (corridor && corridorJunctionMap[corridor]) || opts.junctions
   const junction = prev.junction && jList.includes(prev.junction) ? prev.junction : jList[0] ?? ''
   return {
    ...prev,
    event_cause: prev.event_cause && opts.event_causes.includes(prev.event_cause) ? prev.event_cause : opts.event_causes[0] ?? '',
    corridor,
    junction,
    priority: prev.priority && opts.priorities.includes(prev.priority) ? prev.priority : (opts.priorities[0] as 'High' | 'Low') ?? 'High',
   }
  })
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [options])

 const bucket = deriveHourBucket(form.hour)

 const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
  setForm((f) => ({ ...f, [key]: value }))

 const submit = (e: React.FormEvent) => {
  e.preventDefault()
  onSubmit(form)
 }

 return (
  <div className="animate-fade-in w-full max-w-[640px] rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
   <div className="mb-6 flex items-center gap-3">
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-200">
     <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
      <path d="M12 2l2.6 7.6H22l-6.2 4.5 2.4 7.6L12 17.2 5.8 21.7l2.4-7.6L2 9.6h7.4z" />
     </svg>
    </div>
    <div>
     <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">EventReady AI</h1>
     <p className="text-sm text-slate-500">Assess any event in seconds — historical evidence, not guesswork.</p>
    </div>
   </div>

   {optionsLoading ? (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
     <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-600" />
     <p className="text-xs font-medium text-slate-500">Loading form options…</p>
    </div>
   ) : (
    <form onSubmit={submit} className="space-y-5">
     {/* Event Cause — dropdown */}
     <div>
      <label className={labelClass} htmlFor="event_cause">Event Cause</label>
      <select id="event_cause" className={inputClass} value={form.event_cause} onChange={(e) => set('event_cause', e.target.value)}>
       {opts.event_causes.map((c) => (<option key={c} value={c}>{c}</option>))}
      </select>
     </div>

     {/* Corridor — dropdown */}
     <div>
      <label className={labelClass} htmlFor="corridor">Corridor</label>
      <select
       id="corridor"
       className={inputClass}
       value={form.corridor}
       onChange={(e) => {
        const newCorridor = e.target.value
        // Reset junction to a valid option for the new corridor so an
        // impossible (corridor, junction) combination can never persist.
        const jList = corridorJunctionMap[newCorridor] ?? opts.junctions
        setForm((f) => ({ ...f, corridor: newCorridor, junction: jList[0] ?? '' }))
       }}
      >
       {opts.corridors.map((c) => (<option key={c} value={c}>{c}</option>))}
      </select>
     </div>

     {/* Junction — dropdown, filtered by selected Corridor (BUG 1 fix) */}
     <div>
      <label className={labelClass} htmlFor="junction">Junction</label>
      <select id="junction" className={inputClass} value={form.junction} onChange={(e) => set('junction', e.target.value)}>
       {junctionOptions.map((j) => (<option key={j} value={j}>{j}</option>))}
      </select>
      {corridorJunctionMap[form.corridor] && (
       <p className="mt-1 text-[10px] text-slate-400">Filtered to junctions recorded on {form.corridor}.</p>
      )}
     </div>

     {/* Priority — dynamic from backend */}
     <div>
      <span className={labelClass}>Priority</span>
      <div className="flex gap-3">
       {opts.priorities.map((p) => (
        <label key={p} className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${form.priority === p ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
         <input type="radio" name="priority" className="hidden" checked={form.priority === p} onChange={() => set('priority', p as 'High' | 'Low')} />
         <span className={`h-2.5 w-2.5 rounded-full ${form.priority === p ? 'bg-brand-600' : 'bg-slate-300'}`} />
         {p}
        </label>
       ))}
      </div>
     </div>

     {/* Hour slider */}
     <div>
      <div className="mb-1.5 flex items-center justify-between">
       <span className={labelClass + ' mb-0'}>Hour of Day</span>
       <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{form.hour.toString().padStart(2, '0')}:00 · {HOUR_LABEL[bucket]}</span>
      </div>
      <input type="range" min={0} max={23} value={form.hour} onChange={(e) => set('hour', Number(e.target.value))} className="w-full" />
      <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-500"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
     </div>

     {/* Road closure toggle */}
     <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div>
       <p className="text-sm font-semibold text-slate-700">Road closure likely</p>
       <p className="text-xs text-slate-500">Manual override (model still predicts independently)</p>
      </div>
      <button type="button" onClick={() => set('requires_road_closure', !form.requires_road_closure)} className={`relative h-6 w-11 rounded-full transition ${form.requires_road_closure ? 'bg-brand-600' : 'bg-slate-300'}`} aria-pressed={form.requires_road_closure}>
       <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${form.requires_road_closure ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
     </div>

     <button type="submit" disabled={loading} className="mt-2 w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-200 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
      {loading ? 'Assessing…' : 'Assess Event'}
     </button>
    </form>
   )}
  </div>
 )
}
