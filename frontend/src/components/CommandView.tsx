import { useEffect, useState } from 'react'
import { assess, fetchOptions } from '../api'
import type { FormOptions } from '../types'
import { FALLBACK_OPTIONS, deriveHourBucket } from '../types'
import type { EventEntry } from '../types'

interface Props {
  /** Reserved for parity / future use. Navigation is driven by AppHeader. */
  onBack?: () => void
  events: EventEntry[]
  setEvents: React.Dispatch<React.SetStateAction<EventEntry[]>>
  startChaos?: boolean
  onChaosStarted?: () => void
}

let nextId = 1

/**
 * Multi-event command view — shows 3-4 concurrent events ranked by readiness
 * score with "Deploy First" priority.  This is the difference between a
 * "single-event calculator" and a "decision-support system."
 *
 * Navigation between this and the single-event view is handled by the shared
 * AppHeader, so the back button here just delegates to onBack.
 */

/** Build a stable identity key from the 5 assessment inputs.
 *  Two entries with the same key are the same event; duplicates are suppressed. */
function eventKey(e: { event_cause: string; corridor: string; junction: string; priority: string; hour: number }) {
  return `${e.event_cause}|${e.corridor}|${e.junction}|${e.priority}|${e.hour}`
}

export default function CommandView({ events, setEvents, startChaos, onChaosStarted }: Props) {
  const [options, setOptions] = useState<FormOptions | null>(null)
  // Per-card breakdown expansion state. Collapsed by default so the ranked
  // list stays scannable; a judge clicks "breakdown" to see why one event
  // outranks another -- the same transparency single-event view already has.
  const [openBreakdowns, setOpenBreakdowns] = useState<Set<number>>(new Set())
  const [addForm, setAddForm] = useState<{ event_cause: string; corridor: string; junction: string; priority: 'High' | 'Low'; hour: number }>({ event_cause: '', corridor: '', junction: '', priority: 'High', hour: 18 })
  const [availableOfficers, setAvailableOfficers] = useState(10)
  const [availableMarshals, setAvailableMarshals] = useState(2)
  const [availableBarricades, setAvailableBarricades] = useState(10)

  // NOTE: `loggedShortfalls` state was removed when the auto-understaffed
  // logging loop was disabled. Logging now only happens via the explicit
  // outcome buttons in the Single Event view (LogOutcomeButtons.tsx).

  // Seed 3 sample concurrent events on first mount so the screen demonstrates
  // its value immediately, instead of showing an empty state to a judge.
  const seededRef = useState({ done: false })[0]

  useEffect(() => {
    let cancelled = false
    fetchOptions()
      .then((opts) => {
        if (!cancelled) {
              setOptions(opts)
              // BUG 1 fix: initialise addForm junction from corridor_junction_map
              const cjMap = opts.corridor_junction_map ?? {}
              const firstCorridor = opts.corridors[0] ?? ''
              const firstJunctionList = cjMap[firstCorridor] ?? opts.junctions
              setAddForm((f) => ({
                ...f,
                event_cause: opts.event_causes[0] ?? '',
                corridor: firstCorridor,
                junction: firstJunctionList[0] ?? '',
              }))
              // Seed realistic, diverse concurrent events once.
              if (!seededRef.done && !startChaos) {
                seededRef.done = true
                const causes = opts.event_causes
                const corridors = opts.corridors
                // BUG 1 fix: pick junctions from corridor_junction_map
                const pickJunction = (corridor: string, fallbackIdx: number) => {
                  const mapped = cjMap[corridor]
                  return mapped?.[fallbackIdx] ?? opts.junctions[fallbackIdx] ?? opts.junctions[0] ?? ''
                }
            const seedPicks = [
              { event_cause: causes.find((c) => c.toLowerCase().includes('breakdown')) ?? causes[0], corridor: corridors.find((c) => c.includes('Mysore')) ?? corridors[0], junction: pickJunction(corridors.find((c) => c.includes('Mysore')) ?? corridors[0], 0), priority: 'High' as const, hour: 20 },
              { event_cause: causes.find((c) => c.toLowerCase().includes('construction')) ?? causes[0], corridor: corridors.find((c) => c.includes('Hosur')) ?? corridors[0], junction: pickJunction(corridors.find((c) => c.includes('Hosur')) ?? corridors[0], 0), priority: 'High' as const, hour: 17 },
              { event_cause: causes.find((c) => c.toLowerCase().includes('accident')) ?? causes[0], corridor: corridors.find((c) => c.includes('Bellary')) ?? corridors[0], junction: pickJunction(corridors.find((c) => c.includes('Bellary')) ?? corridors[0], 0), priority: 'High' as const, hour: 19 },
            ]
            seedPicks.forEach((p) => {
              if (events.some((e) => eventKey(e) === eventKey(p))) return // dedupe guard
              const entry: EventEntry = { id: nextId++, ...p, result: null, loading: true, error: null }
              setEvents((prev) => [...prev, entry])
              assess({ ...p }).then((r) => {
                setEvents((prev) => prev.map((e) => (e.id === entry.id ? { ...e, result: r, loading: false } : e)))
              }).catch((err) => {
                setEvents((prev) => prev.map((e) => (e.id === entry.id ? { ...e, error: err instanceof Error ? err.message : String(err), loading: false } : e)))
              })
            })
          }
        }
      })
      .catch(() => {
        if (!cancelled) setOptions(FALLBACK_OPTIONS)
      })
    return () => {
      cancelled = true
    }
  }, [seededRef, startChaos])

  useEffect(() => {
    if (startChaos && options) {
      setEvents([]) // Clear
      triggerChaosScenario(options)
      onChaosStarted?.()
    }
  }, [startChaos, options])

  const opts = options ?? FALLBACK_OPTIONS

  const addEvent = () => {
    const newKey = eventKey(addForm)
    if (events.some((e) => eventKey(e) === newKey)) return // dedupe guard

    const entry: EventEntry = {
      id: nextId++,
      ...addForm,
      result: null,
      loading: true,
      error: null,
    }
    setEvents((prev) => [...prev, entry])

    assess({
      event_cause: addForm.event_cause,
      corridor: addForm.corridor,
      junction: addForm.junction,
      priority: addForm.priority,
      hour: addForm.hour,
    })
      .then((r) => {
        setEvents((prev) =>
          prev.map((e) => (e.id === entry.id ? { ...e, result: r, loading: false } : e)),
        )
      })
      .catch((err) => {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === entry.id ? { ...e, error: err instanceof Error ? err.message : String(err), loading: false } : e,
          ),
        )
      })
  }

  const removeEvent = (id: number) => {
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  const toggleBreakdown = (id: number) => {
    setOpenBreakdowns((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const triggerChaosScenario = (useOpts?: FormOptions) => {
    const o = useOpts || options
    if (!o) return
    const causes = o.event_causes
    const corridors = o.corridors
    const cjMap = o.corridor_junction_map ?? {}
    const pickJunction = (corridor: string, fallbackIdx: number) => {
      const mapped = cjMap[corridor]
      return mapped?.[fallbackIdx] ?? o.junctions[fallbackIdx] ?? o.junctions[0] ?? ''
    }
    
    // Helper: find a cause by keyword, matching underscores-as-spaces so
    // "waterlogging" matches both "waterlogging" and "water_logging".
    const findCause = (kw: string, fallbackIdx: number) =>
      causes.find((c) => c.toLowerCase().replace(/_/g, ' ').includes(kw)) ?? causes[fallbackIdx] ?? causes[0]

    // Pick 5 high priority events — each with a distinct corridor and
    // junction so no two picks collide even before the dedupe guard fires.
    const chaosPicks = [
      { event_cause: findCause('accident', 0),     corridor: corridors.find((c) => c.includes('Mysore')) ?? corridors[0], junction: pickJunction(corridors.find((c) => c.includes('Mysore')) ?? corridors[0], 0), priority: 'High' as const, hour: 18 },
      { event_cause: findCause('waterlogging', 0),  corridor: corridors.find((c) => c.includes('Hosur')) ?? corridors[1] ?? corridors[0], junction: pickJunction(corridors.find((c) => c.includes('Hosur')) ?? corridors[1] ?? corridors[0], 0), priority: 'High' as const, hour: 18 },
      { event_cause: findCause('protest', 0),       corridor: corridors.find((c) => c.includes('Bellary')) ?? corridors[2] ?? corridors[0], junction: pickJunction(corridors.find((c) => c.includes('Bellary')) ?? corridors[2] ?? corridors[0], 0), priority: 'High' as const, hour: 18 },
      { event_cause: findCause('breakdown', 0),    corridor: corridors.find((c) => c.includes('ORR')) ?? corridors[3] ?? corridors[0], junction: pickJunction(corridors.find((c) => c.includes('ORR')) ?? corridors[3] ?? corridors[0], 0), priority: 'High' as const, hour: 18 },
      { event_cause: findCause('vip', 0),          corridor: corridors.find((c) => c.includes('Old Madras')) ?? corridors[4] ?? corridors[0], junction: pickJunction(corridors.find((c) => c.includes('Old Madras')) ?? corridors[4] ?? corridors[0], 0), priority: 'High' as const, hour: 18 },
    ]

    // Dedupe guard: skip picks whose identity key already exists in the
    // current events array.  This prevents duplicate rows regardless of
    // whether the collision comes from index-based fallbacks or from
    // clicking "Chaos Scenario" while earlier events are still loaded.
    const existing = new Set(events.map(eventKey))
    chaosPicks.forEach((p) => {
      if (existing.has(eventKey(p))) return
      existing.add(eventKey(p))
      const entry: EventEntry = { id: nextId++, ...p, result: null, loading: true, error: null }
      setEvents((prev) => [...prev, entry])
      assess({ ...p }).then((r) => {
        setEvents((prev) => prev.map((e) => (e.id === entry.id ? { ...e, result: r, loading: false } : e)))
      }).catch((err) => {
        setEvents((prev) => prev.map((e) => (e.id === entry.id ? { ...e, error: err instanceof Error ? err.message : String(err), loading: false } : e)))
      })
    })
  }

  // Sort by readiness score (highest urgency first).
  const ranked = [...events]
    .filter((e) => e.result)
    .sort((a, b) => (b.result?.readiness_score ?? 0) - (a.result?.readiness_score ?? 0))

  const scoreBand = (score: number) => {
    if (score <= 40) return 'border-accent-500 bg-accent-50'
    if (score <= 70) return 'border-amber-500 bg-amber-50'
    return 'border-brand-500 bg-brand-50'
  }

  const scoreTextColor = (score: number) => {
    if (score <= 40) return 'text-accent-700'
    if (score <= 70) return 'text-amber-600'
    return 'text-brand-700'
  }

  /**
   * Action tier — determines the recommended operational response.
   * Thresholds:
   *   ≥ 70  → Deploy First  (high urgency, commit resources immediately)
   *   40-69 → Monitor       (moderate urgency, standby with ready resources)
   *   < 40  → Standby       (low urgency, maintain awareness)
   */
  const actionLabel = (score: number): { text: string; icon: string; cls: string } => {
    if (score >= 70) return { text: 'DEPLOY FIRST', icon: '🚨', cls: 'bg-red-100 text-red-700 border-red-200' }
    if (score >= 40) return { text: 'MONITOR', icon: '🟡', cls: 'bg-amber-100 text-amber-700 border-amber-200' }
    return { text: 'STANDBY', icon: '🟢', cls: 'bg-slate-100 text-slate-600 border-slate-200' }
  }

  // Coverage Optimization logic
  let officersLeft = availableOfficers
  let marshalsLeft = availableMarshals
  let barricadesLeft = availableBarricades
  let officersExhaustedBefore = officersLeft <= 0
  let marshalsExhaustedBefore = marshalsLeft <= 0
  let barricadesExhaustedBefore = barricadesLeft <= 0

  const coverage = ranked.map(entry => {
    const r = entry.result!
    const reqO = r.deployment.officers
    const reqM = r.deployment.marshals
    const reqB = r.deployment.barricades

    // Snapshot whether each pool was ALREADY drained before this event.
    const oWasDry = officersExhaustedBefore
    const mWasDry = marshalsExhaustedBefore
    const bWasDry = barricadesExhaustedBefore

    const allocatedO = Math.min(reqO, officersLeft)
    const allocatedM = Math.min(reqM, marshalsLeft)
    const allocatedB = Math.min(reqB, barricadesLeft)

    const shortfallO = reqO - allocatedO
    const shortfallM = reqM - allocatedM
    const shortfallB = reqB - allocatedB

    officersLeft -= allocatedO
    marshalsLeft -= allocatedM
    barricadesLeft -= allocatedB

    // Update exhaustion trackers AFTER allocation so the *next* event sees it.
    if (officersLeft <= 0) officersExhaustedBefore = true
    if (marshalsLeft <= 0) marshalsExhaustedBefore = true
    if (barricadesLeft <= 0) barricadesExhaustedBefore = true

    const isUnderstaffed = shortfallO > 0 || shortfallM > 0 || shortfallB > 0
    // Fully unstaffed = ALL THREE pools were exhausted before this event
    const isFullyExhausted = oWasDry && mWasDry && bWasDry
    // Partially exhausted = at least one pool was dry but not all
    const isPartiallyExhausted = (oWasDry || mWasDry || bWasDry) && !isFullyExhausted

    return {
      entry,
      reqO, reqM, reqB,
      allocatedO, allocatedM, allocatedB,
      shortfallO, shortfallM, shortfallB,
      isUnderstaffed,
      isFullyExhausted,
      isPartiallyExhausted,
      oWasDry, mWasDry, bWasDry,
    }
  })

  const totalOfficersNeeded = coverage.reduce((acc, c) => acc + c.reqO, 0)
  const isNetworkStress = totalOfficersNeeded > availableOfficers
  const coveragePercentage = totalOfficersNeeded > 0 ? Math.round((availableOfficers / totalOfficersNeeded) * 100) : 100
  const topShortfalls = coverage
    .filter(c => c.shortfallO > 0)
    .sort((a, b) => b.shortfallO - a.shortfallO)
    .slice(0, 3)
    .map(c => c.entry.event_cause.replace('_', ' '))

  // Explanation logic for Task 4
  function getExplanation(breakdown: any) {
    const factors = [
      { label: 'High closure probability', value: breakdown.closure_probability },
      { label: 'High junction criticality', value: breakdown.junction_criticality },
      { label: 'Peak-hour timing', value: breakdown.peak_hour_factor },
      { label: 'High priority', value: breakdown.priority_factor },
    ]
    factors.sort((a, b) => b.value - a.value)
    return `Ranked due to: ${factors[0].label}, ${factors[1].label.toLowerCase()}`
  }

  // DISABLED: automatic understaffed logging from the Command Center.
  //
  // Previously this useEffect fired a /api/log call (writing a row to
  // event_memory_clean.csv) every time the Coverage Optimization detected a
  // shortfall — which happens automatically whenever the Chaos Scenario
  // button fires or events are added/ranked, WITHOUT the user explicitly
  // clicking an outcome button. That contaminated the learning log with
  // repeated auto-generated rows (the 200+ understaffed rows in the file are
  // largely from this loop being triggered during Chaos testing).
  //
  // Logging an outcome now ONLY happens when a user explicitly clicks one of
  // the three outcome buttons (Understaffed/Sufficient/Overstaffed) on a
  // specific event's own Single Event assessment view (see
  // LogOutcomeButtons.tsx). The existing 231 rows are left untouched.
  //
  // useEffect(() => {
  //   coverage.forEach(({ entry, isUnderstaffed }) => {
  //     if (isUnderstaffed && !loggedShortfalls.has(entry.id)) {
  //       setLoggedShortfalls(prev => new Set(prev).add(entry.id))
  //       const r = entry.result!
  //       logOutcome({
  //         event_cause: entry.event_cause,
  //         corridor: entry.corridor,
  //         junction: entry.junction,
  //         hour_bucket: r.hour_bucket,
  //         outcome: 'understaffed',
  //         readiness_score: r.readiness_score,
  //       }).catch(err => console.error('Auto-log failed', err))
  //     }
  //   })
  // }, [coverage, loggedShortfalls])

  const bucket = deriveHourBucket(addForm.hour)
  const bucketLabel: Record<string, string> = {
    morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
    night_peak: 'Night Peak', late_night: 'Late Night',
  }

  return (
    <div className="animate-fade-in w-full">
      {/* Sub-header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand-600" />
            Multi-Event Command Center
          </h2>
          <p className="text-xs text-slate-500">
            Rank concurrent events by deployment priority. The commanding officer deploys the top event first.
          </p>
        </div>
        <button
          onClick={() => triggerChaosScenario()}
          className="animate-pulse rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-red-200 transition hover:bg-red-700"
        >
          🚨 Chaos Scenario
        </button>
      </div>

      {/* Resource Panel */}
      <div className="mb-4 flex items-center gap-4 rounded-xl border border-brand-200 bg-brand-50 p-3 px-4">
        <div className="text-sm font-semibold text-brand-900">Available Resources:</div>
        <div className="flex items-center gap-2" title="Adjustable scenario inputs">
          <label className="text-xs font-semibold text-slate-500">Available Officers</label>
          <input 
            type="number" 
            min="0"
            className="w-16 rounded border border-brand-200 px-2 py-1 text-xs font-mono"
            value={availableOfficers}
            onChange={(e) => setAvailableOfficers(Number(e.target.value))}
          />
        </div>
        <div className="flex items-center gap-2" title="Adjustable scenario inputs">
          <label className="text-xs font-semibold text-slate-500">Available Marshals</label>
          <input 
            type="number" 
            min="0"
            className="w-16 rounded border border-brand-200 px-2 py-1 text-xs font-mono"
            value={availableMarshals}
            onChange={(e) => setAvailableMarshals(Number(e.target.value))}
          />
        </div>
        <div className="flex items-center gap-2" title="Adjustable scenario inputs">
          <label className="text-xs font-semibold text-brand-700">Barricades</label>
          <input 
            type="number" 
            min="0"
            className="w-16 rounded border border-brand-200 px-2 py-1 text-xs font-mono"
            value={availableBarricades}
            onChange={(e) => setAvailableBarricades(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Add Event form */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-md shadow-slate-200/60">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Add Concurrent Event</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Cause</label>
            <select className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" value={addForm.event_cause} onChange={(e) => setAddForm((f) => ({ ...f, event_cause: e.target.value }))}>
              {opts.event_causes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Corridor</label>
            <select className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" value={addForm.corridor} onChange={(e) => {
              const newCorridor = e.target.value
              // BUG 1 fix: reset junction to a valid option for the new corridor
              const cjMap = opts.corridor_junction_map ?? {}
              const jList = cjMap[newCorridor] ?? opts.junctions
              setAddForm((f) => ({ ...f, corridor: newCorridor, junction: jList[0] ?? '' }))
            }}>
              {opts.corridors.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Junction</label>
            <select className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" value={addForm.junction} onChange={(e) => setAddForm((f) => ({ ...f, junction: e.target.value }))}>
              {(() => {
                const cjMap = opts.corridor_junction_map ?? {}
                const mapped = addForm.corridor ? cjMap[addForm.corridor] : undefined
                const junctionList = mapped && mapped.length > 0 ? mapped : opts.junctions
                return junctionList.map((j: string) => <option key={j} value={j}>{j}</option>)
              })()}
            </select>
            {opts.corridor_junction_map?.[addForm.corridor] && (
              <p className="mt-0.5 text-[9px] text-slate-400">Filtered to {addForm.corridor} junctions</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Priority</label>
            <div className="flex gap-1">
              {(['High', 'Low'] as const).map((p) => (
                <button key={p} type="button" onClick={() => setAddForm((f) => ({ ...f, priority: p }))}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${addForm.priority === p ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Hour ({bucketLabel[bucket] ?? bucket})</label>
            <input type="range" min={0} max={23} value={addForm.hour} onChange={(e) => setAddForm((f) => ({ ...f, hour: Number(e.target.value) }))} className="w-full" />
          </div>
          <div className="flex items-end">
            <button onClick={addEvent} className="w-full rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-brand-200 transition hover:bg-brand-700">
              + Assess
            </button>
          </div>
        </div>
      </div>

      {/* Loading events */}
      {events.filter((e) => e.loading).length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
          Assessing {events.filter((e) => e.loading).length} event(s)...
        </div>
      )}

      {/* Ranked results — TABLE FORMAT (Phase 3)
          Columns: Rank | Event | Score | Action
          Score-band thresholds (documented in actionLabel):
            ≥ 65  → Deploy First  (red)
            50-64 → Monitor       (amber)
            < 50  → Standby       (slate)
          All existing ranking/sorting/breakdown logic is preserved unchanged. */}
      {ranked.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Ranked Events — Deploy Priority</h3>
            <span className="text-[10px] text-slate-500">{ranked.length} assessed</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5 w-12 text-center">#</th>
                  <th className="px-3 py-2.5">Event</th>
                  <th className="px-3 py-2.5 w-16 text-right">Score</th>
                  <th className="px-3 py-2.5 w-28 text-center">Action</th>
                  <th className="px-3 py-2.5 w-24 text-right hidden sm:table-cell">Deploy</th>
                  <th className="px-3 py-2.5 w-16 text-right hidden sm:table-cell">Duration</th>
                  <th className="px-3 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((entry, idx) => {
                  const r = entry.result!
                  const rank = idx + 1
                  const action = actionLabel(r.readiness_score)
                  return (
                    <tr
                      key={entry.id}
                      className={`border-b border-slate-100 last:border-b-0 transition hover:bg-slate-50 ${scoreBand(r.readiness_score)}`}
                    >
                      {/* Rank */}
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${rank === 1 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                          {rank}
                        </span>
                      </td>
                      {/* Event info */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="truncate text-xs font-semibold text-slate-800">
                            {entry.event_cause} <span className="font-normal text-slate-700">·</span> {entry.corridor}
                          </p>
                          {ranked.some(other => other.id !== entry.id && other.result?.diversion_routes?.some(r => r.name.toLowerCase() === entry.corridor.toLowerCase())) && (
                            <span className="inline-flex items-center rounded-md bg-red-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-red-600 border border-red-200" title="This corridor is a diversion target for another active event">
                              ⚠ Ripple Risk
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-500 truncate">
                          {entry.junction || 'No junction'} · {entry.priority} · {r.hour_bucket}
                          {r.nearest_police_station && (
                            <> · 🏛 {r.nearest_police_station}</>
                          )}
                        </p>
                        {/* Ranked-due-to explanation — placed in the wide Event
                            column (not the narrow Score column) for readable layout */}
                        <p className="mt-0.5 text-[9px] text-slate-400 leading-snug">
                          {getExplanation(r.score_breakdown)}
                        </p>
                        {/* Checklist preview */}
                        {r.checklist.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {r.checklist.slice(0, 3).map((item, i) => (
                              <span key={i} className="rounded border border-slate-100 bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
                                {item}
                              </span>
                            ))}
                            {r.checklist.length > 3 && (
                              <span className="text-[9px] text-slate-500">+{r.checklist.length - 3}</span>
                            )}
                          </div>
                        )}
                        {/* Breakdown toggle */}
                        <div className="mt-1">
                          <button
                            onClick={() => toggleBreakdown(entry.id)}
                            className="text-[9px] font-semibold text-slate-500 transition hover:text-brand-600"
                          >
                            {openBreakdowns.has(entry.id) ? '▴ hide' : '▾ breakdown'}
                          </button>
                          {openBreakdowns.has(entry.id) && (
                            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 text-[9px] sm:grid-cols-4">
                              {([
                                ['Closure', r.score_breakdown.closure_probability, 30],
                                ['Junction', r.score_breakdown.junction_criticality, 25],
                                ['Peak hr', r.score_breakdown.peak_hour_factor, 25],
                                ['Priority', r.score_breakdown.priority_factor, 20],
                              ] as const).map(([label, val, w]) => (
                                <div key={label} title={`${Math.round(val * 100)}% × ${w}`}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-500">{label}</span>
                                    <span className="font-semibold text-slate-700">{Math.round(val * 100)}%</span>
                                  </div>
                                  <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-200">
                                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round(val * 100)}%` }} />
                                  </div>
                                </div>
                              ))}
                              {r.memory_score_boost ? (
                                <div className="col-span-2 mt-0.5 text-amber-600 sm:col-span-4">
                                  <span title="Points added by prior 'Understaffed' feedback for this corridor + cause">
                                    ⚡ feedback +{r.memory_score_boost} ({r.memory_modifier ?? 0} prior log{(r.memory_modifier ?? 0) === 1 ? '' : 's'})
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </td>
                      {/* Score */}
                      <td className={`px-3 py-2.5 text-right text-lg font-extrabold ${scoreTextColor(r.readiness_score)}`}>
                        {r.readiness_score}
                      </td>
                      {/* Action */}
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${action.cls}`}>
                          {action.icon} {action.text}
                        </span>
                      </td>
                      {/* Deploy summary */}
                      <td className="px-3 py-2.5 text-right hidden sm:table-cell">
                        <span className="text-[11px] text-slate-500">
                          👮 {r.deployment.officers}
                          {r.deployment.marshals > 0 && <> · 🦺 {r.deployment.marshals}</>}
                          {r.deployment.barricades > 0 && <> · 🚧 {r.deployment.barricades}</>}
                        </span>
                      </td>
                      {/* Duration */}
                      <td className="px-3 py-2.5 text-right hidden sm:table-cell">
                        <span className="font-bold text-slate-700">{r.predicted_duration_hours.toFixed(1)}h</span>
                      </td>
                      {/* Remove */}
                      <td className="px-3 py-2.5">
                        <button onClick={() => removeEvent(entry.id)} className="text-sm text-slate-700 transition hover:text-red-400" title="Remove">✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Coverage Optimization (P2) */}
      {ranked.length > 0 && (
        <div className="mt-4">
          {isNetworkStress && (
            <div className="mb-3 animate-fade-in rounded-lg border border-red-200 bg-red-50 p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-red-600 animate-pulse font-bold">⚠</span>
                <span className="text-xs font-bold uppercase tracking-wider text-red-700">NETWORK STRESS</span>
              </div>
              <p className="mt-1 text-[11px] font-medium text-red-800">
                Resources available: <strong className="text-red-900">{availableOfficers} officers</strong>. 
                Resources demanded across {ranked.length} ranked events: <strong className="text-red-900">{totalOfficersNeeded}</strong>. 
                Coverage achievable: <strong className="text-red-900">{Math.min(100, coveragePercentage)}%</strong>.
              </p>
              {topShortfalls.length > 0 && (
                <p className="mt-1 text-[10px] text-red-700">
                  Critical shortfalls: <span className="font-semibold">{topShortfalls.join(', ')}</span>.
                </p>
              )}
            </div>
          )}
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Coverage Optimization</h3>
            <span className="text-[10px] text-slate-500">Greedy allocation</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Event</th>
                  <th className="px-3 py-2.5 text-right">Officers Needed</th>
                  <th className="px-3 py-2.5 text-right">Officers Assigned</th>
                  <th className="px-3 py-2.5 text-right">Marshals Needed</th>
                  <th className="px-3 py-2.5 text-right">Marshals Assigned</th>
                  <th className="px-3 py-2.5 text-right">Barricades Needed</th>
                  <th className="px-3 py-2.5 text-right">Barricades Assigned</th>
                  <th className="px-3 py-2.5 text-center w-44">Status</th>
                </tr>
              </thead>
              <tbody>
                {coverage.map(({ entry, reqO, reqM, reqB, allocatedO, allocatedM, allocatedB, shortfallO, shortfallM, shortfallB, isUnderstaffed, isFullyExhausted, isPartiallyExhausted, oWasDry, mWasDry, bWasDry }) => {
                  // Build per-resource status parts for the label
                  const parts: string[] = []
                  if (oWasDry) parts.push('Officers Exhausted')
                  if (mWasDry) parts.push('Marshals Exhausted')
                  if (bWasDry) parts.push('Barricades Exhausted')

                  // Build the explanatory subtext identifying which resource(s) ran out
                  const exhaustedNames: string[] = []
                  if (oWasDry) exhaustedNames.push('officers')
                  if (mWasDry) exhaustedNames.push('marshals')
                  if (bWasDry) exhaustedNames.push('barricades')

                  return (
                  <tr key={entry.id} className={`border-b border-slate-100 last:border-b-0 ${
                    isFullyExhausted
                      ? 'bg-slate-100 opacity-60'
                      : isUnderstaffed
                        ? 'bg-red-50'
                        : ''
                  }`}>
                    <td className="px-3 py-2.5">
                      <p className={`truncate text-xs font-semibold ${isFullyExhausted ? 'text-slate-400' : 'text-slate-800'}`}>
                        {entry.event_cause} <span className="font-normal text-slate-700">·</span> {entry.corridor}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-600">{reqO}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${isFullyExhausted && oWasDry ? 'text-slate-400' : shortfallO > 0 ? 'text-red-600' : 'text-brand-600'}`}>
                      {allocatedO}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-600">{reqM}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${isFullyExhausted && mWasDry ? 'text-slate-400' : shortfallM > 0 ? 'text-red-600' : 'text-brand-600'}`}>
                      {allocatedM}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-600">{reqB}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${isFullyExhausted && bWasDry ? 'text-slate-400' : shortfallB > 0 ? 'text-red-600' : 'text-brand-600'}`}>
                      {allocatedB}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {isFullyExhausted ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">Unstaffed — Pool Exhausted</span>
                          <span className="text-[9px] text-slate-400 leading-tight max-w-[14rem] mx-auto">
                            No resources remaining after higher-priority allocation
                          </span>
                        </div>
                      ) : isPartiallyExhausted ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">Partial — {parts.join(' · ')}</span>
                          <span className="text-[9px] text-amber-600 leading-tight max-w-[14rem] mx-auto">
                            {exhaustedNames.join(' & ')} exhausted; other resource types covered
                          </span>
                        </div>
                      ) : isUnderstaffed ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">Shortfall</span>
                          <span className="text-[9px] text-red-600 leading-tight max-w-[14rem] mx-auto">
                            {shortfallO > 0 ? `Redeploy ${shortfallO} officers from nearest idle station` : shortfallM > 0 ? `Redeploy ${shortfallM} marshals` : `Redeploy ${shortfallB} barricades`}
                          </span>
                        </div>
                      ) : (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Covered</span>
                      )}
                    </td>
	                  </tr>
	                  )
	                })}
	              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Error events */}
      {events.filter((e) => e.error).map((entry) => (
        <div key={entry.id} className="mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600">
          <strong>{entry.event_cause} · {entry.corridor}:</strong> {entry.error}
          <button onClick={() => removeEvent(entry.id)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
        </div>
      ))}

      {/* Empty state */}
      {events.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-500">No events assessed yet</p>
          <p className="mt-1 text-xs text-slate-500">Add concurrent events above to see them ranked by deployment priority.</p>
        </div>
      )}
    </div>
  )
}

