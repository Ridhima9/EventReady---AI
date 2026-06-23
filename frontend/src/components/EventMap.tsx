import { useEffect, useRef, useState } from 'react'

/* ─── Helpers ───────────────────────────────────────────────────────────── */

/** Greedy nearest-neighbor sort: traces a path through points without
 *  creating crossing lines. Starts from the first point and always picks
 *  the closest unvisited point next. O(n²) but fine for polyline sizes
 *  (typically < 100 points). */
function greedyNearestNeighbor(points: number[][]): { lat: number; lng: number }[] {
  if (points.length <= 2) return points.map((p) => ({ lat: p[0], lng: p[1] }))

  const result: { lat: number; lng: number }[] = []
  const used = new Set<number>()

  // Start from the first point
  let currentIdx = 0
  result.push({ lat: points[currentIdx][0], lng: points[currentIdx][1] })
  used.add(currentIdx)

  for (let i = 1; i < points.length; i++) {
    let bestIdx = -1
    let bestDist = Infinity
    const cx = points[currentIdx][1] // lng
    const cy = points[currentIdx][0] // lat

    for (let j = 0; j < points.length; j++) {
      if (used.has(j)) continue
      const dx = points[j][1] - cx
      const dy = points[j][0] - cy
      const dist = dx * dx + dy * dy // squared distance, no sqrt needed
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = j
      }
    }

    if (bestIdx >= 0) {
      result.push({ lat: points[bestIdx][0], lng: points[bestIdx][1] })
      used.add(bestIdx)
      currentIdx = bestIdx
    }
  }

  return result
}

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface Props {
  lat: number
  lng: number
  /** Recorded route_path from the dataset — the affected corridor polyline. */
  diversion: number[][]
  /** Alternative routes for diversion. */
  diversionRoutes?: { name: string; path: number[][] }[]
  /** True if the junction coords are spread out (>3km) */
  approximate_location?: boolean
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function EventMap({ lat, lng, diversion, diversionRoutes = [], approximate_location = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [isDegraded, setIsDegraded] = useState(false)

  useEffect(() => {
    let cancelled = false

    const initMappls = async () => {
      if (!containerRef.current || mapRef.current) return

      try {
        const MAPPLS_CLIENT_ID = import.meta.env.VITE_MAPPLS_CLIENT_ID ?? ''
        const MAPPLS_CLIENT_SECRET = import.meta.env.VITE_MAPPLS_CLIENT_SECRET ?? ''
        
        if (!MAPPLS_CLIENT_ID) {
            setIsDegraded(true)
            return
        }

        /* ── 1. Get OAuth Token ─────────────────────────────────────────── */
        const params = new URLSearchParams()
        params.append('grant_type', 'client_credentials')
        params.append('client_id', MAPPLS_CLIENT_ID)
        params.append('client_secret', MAPPLS_CLIENT_SECRET)

        const tokenRes = await fetch('/api/security/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        })
        if (!tokenRes.ok) throw new Error('Token fetch failed')
        const tokenData = await tokenRes.json()
        const token = tokenData.access_token

        if (cancelled) return

        /* ── 2. Dynamically Load Mappls JS SDK ────────────────────────── */
        await new Promise<void>((resolve, reject) => {
          if ((window as any).mappls) { resolve(); return }
          const script = document.createElement('script')
          script.src = `https://apis.mappls.com/advancedmaps/api/${token}/map_sdk?layer=vector&v=3.0`
          script.async = true
          script.defer = true
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Mappls SDK failed to load'))
          document.head.appendChild(script)
        })

        if (cancelled || !containerRef.current) return

        const mappls = (window as any).mappls

        /* ── 3. Initialize Map ──────────────────────────────────────────── */
        const map = new mappls.Map('mappls-container', {
          center: [lat, lng],
          zoom: 14,
          zoomControl: true,
          location: true
        })
        mapRef.current = map

        /* ── 4. Add Event Marker ────────────────────────────────────────── */
        new mappls.Marker({
          map: map,
          position: { lat, lng },
          popupHtml: `<div><strong>Event Location</strong></div>`
        })

        /* ── 5. Add Problem Corridor Polyline ──────────────────────────── */
        if (diversion && diversion.length >= 2) {
          // Sort points using greedy nearest-neighbor to avoid tangled
          // crossing lines when the raw CSV row order is non-sequential.
          const path = greedyNearestNeighbor(diversion)
          new mappls.Polyline({
            map: map,
            paths: path,
            strokeColor: '#6366f1',
            strokeOpacity: 0.9,
            strokeWeight: 5,
            fitbounds: true
          })
        }

        /* ── 6. Add Diversion Route(s) ─────────────────────────────────── */
        diversionRoutes.forEach((route) => {
          if (route.path && route.path.length >= 3) {
            const divPath = greedyNearestNeighbor(route.path)
            new mappls.Polyline({
              map: map,
              paths: divPath,
              strokeColor: '#10b981',
              strokeOpacity: 0.85,
              strokeWeight: 4,
              strokeDasharray: '8 6',
            })
          } else if (route.path && route.path.length >= 1) {
            // Fallback: single marker for corridors with sparse data
            const pt = route.path[0]
            new mappls.Marker({
              map: map,
              position: { lat: pt[0], lng: pt[1] },
              popupHtml: `<div><strong>Diversion: ${route.name}</strong></div>`
            })
          }
        })
      } catch (err) {
        console.error('Mappls JS SDK init error:', err)
        if (!cancelled) setIsDegraded(true)
      }
    }

    initMappls()

    return () => {
      cancelled = true
    }
  }, [lat, lng, diversion, diversionRoutes])

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <div className="animate-fade-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* ── Header bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-sm">📍</span>
          <span className="text-xs font-semibold tracking-wide text-slate-900">
            Event Location &amp; Corridor Path
          </span>
          {approximate_location && (
            <span className="ml-2 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600 border border-slate-200">
              Approximate Location
            </span>
          )}
        </div>
        {/* Badge */}
        {!isDegraded ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-emerald-700 ring-1 ring-emerald-300">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"
              style={{ animation: 'mappls-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
            />
            MAPPLS LIVE
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-700 ring-1 ring-amber-300">
            SIMULATION MODE
          </span>
        )}
        <style>{`
          @keyframes mappls-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%      { opacity: 0.4; transform: scale(0.75); }
          }
        `}</style>
      </div>

      {/* ── Map container or SVG Fallback ──────────────────────────── */}
      {!isDegraded ? (
        <div className="relative">
          <div id="mappls-container" ref={containerRef} style={{ height: 320 }} className="w-full" />
          {/* Legend overlay — positioned over bottom-left of map */}
          <div className="absolute bottom-2 left-2 z-[1000] flex items-center gap-3 rounded-lg border border-white/80 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-5 rounded-sm" style={{ backgroundColor: '#6366f1' }} />
              <span className="text-[9px] font-semibold text-slate-700">Affected Route</span>
            </div>
            {diversionRoutes.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-5 rounded-sm border-t-2 border-dashed" style={{ borderColor: '#10b981' }} />
                <span className="text-[9px] font-semibold text-slate-700">Suggested Diversion</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="relative w-full overflow-hidden bg-slate-50 flex items-center justify-center" style={{ height: 320 }}>
          {/* Animated wireframe SVG simulation */}
          <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <path d="M -50 150 Q 150 50 350 200 T 750 100" fill="none" stroke="#475569" strokeWidth="6" />
            <path d="M 100 350 Q 300 150 500 250 T 900 150" fill="none" stroke="#475569" strokeWidth="4" />
          </svg>
          <div className="z-10 flex flex-col items-center">
            <div className="relative mb-2 flex h-6 w-6 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600"></span>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5  text-center">
              <div className="text-[10px] font-bold text-slate-700">EPICENTER</div>
              <div className="text-[9px] text-slate-500">{lat.toFixed(4)}, {lng.toFixed(4)}</div>
            </div>
          </div>
          <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            {/* Simulation Route */}
            <path d="M 0 300 Q 200 200 400 250 T 800 150" fill="none" stroke="#6366f1" strokeWidth="3" strokeDasharray="10 10" className="animated-corridor-path opacity-80" />
            <path d="M 400 250 Q 500 100 700 120" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="5 5" className="opacity-80" />
          </svg>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-slate-50 px-4 py-1.5 border-t border-slate-200">
        <span className="text-[9px] leading-tight text-slate-500">
          {!isDegraded 
            ? `Indigo line: affected corridor (${diversion.length} pts).${diversionRoutes.length > 0 ? ` Green dashed: suggested diversion via ${diversionRoutes.map(r => r.name).join(', ')}.` : ''}`
            : `Mappls keys failed to load map tiles. Showing simulation visualization.`}
        </span>
        <span className="shrink-0 text-[9px] text-slate-600">
          {!isDegraded ? 'Tiles © Mappls' : 'Simulation Mode'}
        </span>
      </div>
    </div>
  )
}
