import { useState } from 'react'
import { logOutcome } from '../api'
import type { AssessResponse, LogRequest } from '../types'

interface Props {
 event_cause: string
 corridor: string
 junction: string
 hour_bucket: string
 /** Current readiness score, used to show a before → after delta in the toast. */
 currentScore?: number
 /** Called after an "understaffed" log is written. Re-assesses and returns
  * the new response so the score on screen updates -- this is what makes the
  * learning loop *provable* in the demo rather than just a "Logged" toast. */
 onReassess?: () => Promise<AssessResponse>
}

type Outcome = LogRequest['outcome']

const OUTCOMES: { key: Outcome; label: string; cls: string }[] = [
 { key: 'understaffed', label: 'Understaffed', cls: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' },
 { key: 'sufficient', label: 'Sufficient', cls: 'border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100' },
 { key: 'overstaffed', label: 'Overstaffed', cls: 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100' },
]

export default function LogOutcomeButtons({ event_cause, corridor, junction, hour_bucket, currentScore, onReassess }: Props) {
 const [toast, setToast] = useState<string | null>(null)
 const [busy, setBusy] = useState<Outcome | null>(null)

 const handle = async (outcome: Outcome) => {
  setBusy(outcome)
  try {
   await logOutcome({ event_cause, corridor, junction, hour_bucket, outcome, readiness_score: currentScore })

   // Only the "understaffed" outcome feeds the loop on the backend, so only
   // it produces a score change worth showing a before/after for.
   if (outcome === 'understaffed' && onReassess) {
    const next = await onReassess()
    const delta = next.memory_score_boost ?? 0
    if (delta > 0 && currentScore != null) {
     setToast(`Logged → score ${currentScore} → ${next.readiness_score} (+${delta} feedback)`)
    } else {
     setToast('Logged → feedback recorded (no score change this time)')
    }
   } else {
    setToast(`Logged: ${outcome}`)
   }
   setTimeout(() => setToast(null), 3600)
  } catch {
   setToast('Failed to log — is the backend running?')
   setTimeout(() => setToast(null), 3000)
  } finally {
   setBusy(null)
  }
 }

 return (
  <div>
   <h3 className="mb-1 text-sm font-semibold text-slate-700">Log Outcome</h3>
   <p className="mb-2 text-[11px] text-slate-500">
    Logging <strong>Understaffed</strong> raises this corridor's urgency on the next
    assessment — the score above updates live.
   </p>
   <div className="flex flex-wrap gap-2">
    {OUTCOMES.map((o) => (
     <button key={o.key} onClick={() => handle(o.key)} disabled={busy !== null} className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 ${o.cls}`}>
      {busy === o.key ? '…' : o.label}
     </button>
    ))}
   </div>
   {toast && (
    <div className="animate-toast-in mt-2 inline-block rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-900 shadow">{toast}</div>
   )}
  </div>
 )
}
