import { useEffect, useState } from 'react'
import { assess, fetchOptions } from './api'
import type { AssessResponse, FormOptions, PlanningParadox, EventEntry } from './types'
import { FALLBACK_OPTIONS } from './types'
import AppHeader, { type View } from './components/AppHeader'
import InsightBar from './components/InsightBar'
import FormCard, { type FormState } from './components/FormCard'
import ResultCard from './components/ResultCard'
import CommandView from './components/CommandView'
import AnalyticsView from './components/AnalyticsView'
import ExecutiveBriefing from './components/ExecutiveBriefing'

type Screen = 'form' | 'result'

export default function App() {
  // 'briefing' is the default first view the app opens to -- a synthesis /
  // first-impression landing page that reuses numbers already computed and
  // verified elsewhere in the app (no independent calculation).
  const [view, setView] = useState<View>('briefing')
  const [screen, setScreen] = useState<Screen>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [result, setResult] = useState<AssessResponse | null>(null)
  const [options, setOptions] = useState<FormOptions | null>(null)
  
  // Hoist Command Center events state so ResultCard can check ripple risks
  const [commandEvents, setCommandEvents] = useState<EventEntry[]>([])
  const [startChaos, setStartChaos] = useState(false)

  // Fetch form options once at startup so we can also share the planning
  // paradox insight across every screen via InsightBar.
  useEffect(() => {
    fetchOptions()
      .then((opts) => setOptions(opts))
      .catch(() => setOptions(FALLBACK_OPTIONS))
  }, [])

  const paradox: PlanningParadox | undefined = options?.planning_paradox

  const handleSubmit = async (state: FormState) => {
    setLoading(true)
    setError(null)
    try {
      const r = await assess({
        event_cause: state.event_cause,
        corridor: state.corridor,
        junction: state.junction,
        priority: state.priority,
        hour: state.hour,
      })
      setForm(state)
      setResult(r)
      setScreen('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setScreen('form')
    setResult(null)
    setError(null)
  }

  const switchView = async (v: View) => {
    if (v === 'demo') {
      try {
        await fetch('http://localhost:8000/api/demo-seed', { method: 'POST' })
      } catch (e) {
        console.error('Failed to seed demo data', e)
      }
      setView('command')
      setScreen('form')
      setStartChaos(true)
      return
    }

    setView(v)
    setStartChaos(false)
    // Reset to a clean state when switching contexts so neither view leaks
    // the other's stale result onto the screen.
    if (v === 'command') {
      setScreen('form')
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 px-4 py-6 sm:py-8">
      <div className="mx-auto w-full max-w-[1440px]">
        <AppHeader view={view} onView={switchView} />

        {/* Evidence strip — visible on every screen EXCEPT the briefing,
            which renders InsightBar as its own section 1 (avoids duplication). */}
        {view !== 'briefing' && (
          <div className="mb-5">
            <InsightBar paradox={paradox} />
          </div>
        )}

        {view === 'briefing' && (
          <ExecutiveBriefing onViewAnalytics={() => switchView('analytics')} />
        )}

        {view === 'single' && (
          <>
            {screen === 'form' && (
              <>
                <FormCard onSubmit={handleSubmit} loading={loading} initial={form ?? undefined} />
                {error && (
                  <div className="animate-fade-in mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <strong>Couldn't assess:</strong> {error}
                  </div>
                )}
              </>
            )}
            {screen === 'result' && result && form && (
              <ResultCard result={result} form={form} onReset={reset} onResult={setResult} commandEvents={commandEvents} />
            )}
          </>
        )}

        {view === 'command' && <CommandView onBack={() => switchView('single')} events={commandEvents} setEvents={setCommandEvents} startChaos={startChaos} onChaosStarted={() => setStartChaos(false)} />}

        {view === 'analytics' && <AnalyticsView />}
      </div>
    </div>
  )
}
