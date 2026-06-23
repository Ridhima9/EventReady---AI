import { useState, useEffect } from 'react'
import { assess } from '../api'
import type { FormState } from './FormCard'

interface Props {
  baseState: FormState
  currentScore: number
}

interface ScenarioResult {
  label: string
  score: number | null
  loading: boolean
}

export default function ScenarioComparison({ baseState, currentScore }: Props) {
  const [scenarios, setScenarios] = useState<ScenarioResult[]>([
    { label: 'Closure ON', score: null, loading: true },
    { label: 'Peak hour OFF', score: null, loading: true },
    { label: 'Priority LOW', score: null, loading: true },
  ])

  useEffect(() => {
    let active = true

    async function loadScenarios() {
      try {
        const [resClosure, resPeak, resPriority] = await Promise.all([
          assess({ ...baseState, force_closure_prob: 0.9 } as any),
          assess({ ...baseState, hour: 12 } as any), // 12 is midday (not peak)
          assess({ ...baseState, priority: 'Low' } as any),
        ])

        if (!active) return

        setScenarios([
          { label: 'Closure ON', score: resClosure.readiness_score, loading: false },
          { label: 'Peak hour OFF', score: resPeak.readiness_score, loading: false },
          { label: 'Priority LOW', score: resPriority.readiness_score, loading: false },
        ])
      } catch (err) {
        console.error(err)
      }
    }

    loadScenarios()
    return () => { active = false }
  }, [baseState])

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Scenario Comparison</h3>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-[13px] text-slate-600">
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-4 py-2.5 font-semibold text-slate-800">Current</td>
              <td className="px-4 py-2.5 text-right font-bold text-brand-600">{currentScore}</td>
            </tr>
            {scenarios.map((s) => (
              <tr key={s.label}>
                <td className="px-4 py-2.5">{s.label}</td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {s.loading ? '...' : s.score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
