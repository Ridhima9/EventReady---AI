import type { EventEntry } from '../types'

interface Props {
  checklist: string[]
  extraLines?: string[]
  diversionRoutes?: { name: string; count: number; note: string }[]
  commandEvents?: EventEntry[]
}

function classify(item: string): 'core' | 'upstream' | 'lateral' | null {
  const s = item.toLowerCase()
  if (/(officer|tow truck|ambulance|crane|tree-cutting)/.test(s)) return 'core'
  if (/(barricade|lighting|drain|visibility)/.test(s)) return 'upstream'
  if (/(diversion|crowd-control|crowd control|road repair|signage)/.test(s)) return 'lateral'
  return null
}

function verb(item: string): string {
  const s = item.toLowerCase()
  if (s.includes('tow truck')) return 'Tow truck'
  if (s.includes('ambulance')) return 'Ambulance + crane'
  if (s.includes('tree-cutting')) return 'Tree-cutting squad'
  if (s.includes('officers at junction')) return 'Extra officers'
  if (s.includes('crowd-control')) return 'Crowd control'
  if (s.includes('barricades')) return 'Barricades'
  if (s.includes('lighting')) return 'Lighting'
  if (s.includes('drain')) return 'Drain team'
  if (s.includes('diversion signage')) return 'Verify signage'
  if (s.includes('road repair')) return 'Road repair alert'
  if (s.includes('early diversion')) return 'Early signage'
  return item
}

interface Column { title: string; subtitle: string; tint: string; dot: string; items: string[], isLateral?: boolean }

export default function SpatialMatrix({ checklist, extraLines = [], diversionRoutes = [], commandEvents = [] }: Props) {
  const core: string[] = []
  const upstream: string[] = []
  const lateral: string[] = []

  checklist.forEach((item) => {
    const role = classify(item)
    if (role === 'core') core.push(item)
    else if (role === 'upstream') upstream.push(item)
    else if (role === 'lateral') lateral.push(item)
  })
  extraLines.forEach((line) => lateral.push(line))

  const columns: Column[] = [
    { title: 'Core Intersection', subtitle: 'At the main junction', tint: 'bg-brand-50', dot: 'bg-brand-600', items: core },
    { title: 'Upstream Throttle', subtitle: '≈500m before junction', tint: 'bg-amber-50', dot: 'bg-amber-500', items: upstream },
    { title: 'Lateral Reroute', subtitle: 'Alternate paths', tint: 'bg-accent-50', dot: 'bg-accent-600', items: lateral, isLateral: true },
  ]

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Spatial Role Matrix</h3>
      <div className="grid grid-cols-3 gap-2">
        {columns.map((col) => (
          <div key={col.title} className={`rounded-lg border border-slate-200 border-t-2 p-3 ${col.tint}`} style={{ borderTopColor: col.dot === 'bg-brand-600' ? '#4f46e5' : col.dot === 'bg-amber-500' ? '#f59e0b' : '#0d9488' }}>
            <div className="mb-2 flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${col.dot}`} />
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{col.title}</span>
            </div>
            <p className="mb-2 text-[10px] text-slate-500">{col.subtitle}</p>
            {col.isLateral && diversionRoutes && diversionRoutes.length > 0 && (
              <div className="mb-3 space-y-2">
                {diversionRoutes.map((route, i) => {
                  // Check if this route name is a target of an active event in command queue
                  const activeEventOnRoute = commandEvents.find(e => 
                    e.corridor.toLowerCase() === route.name.toLowerCase()
                  )
                  
                  return (
                    <div key={i} className="rounded-md bg-white/90 px-2 py-1.5 text-xs shadow-sm border border-accent-100">
                      <p className="font-bold text-accent-700">Via {route.name}</p>
                      <p className="mt-0.5 text-[9px] text-slate-500 leading-tight">{route.note} (n={route.count})</p>
                      {activeEventOnRoute && (
                        <div className="mt-1.5 border-t border-red-100 pt-1 text-[9px] font-semibold text-red-600">
                          ⚠ Ripple Risk — {route.name} has an active {activeEventOnRoute.event_cause.replace('_', ' ')} event. Diverting here compounds congestion in {activeEventOnRoute.result?.zone || 'the area'}.
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {col.items.length === 0 && (!col.isLateral || !diversionRoutes || diversionRoutes.length === 0) ? (
              <p className="rounded border border-dashed border-slate-200 px-2 py-3 text-center text-[10px] text-slate-500">None needed</p>
            ) : (
              <ul className="space-y-1.5">
                {col.items.map((item, i) => (
                  <li key={i} className="animate-fade-in rounded-md bg-white/80 px-2 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm" style={{ animationDelay: `${i * 100}ms` }}>{verb(item)}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
