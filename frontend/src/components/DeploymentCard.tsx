import type { Deployment } from '../types'

interface Props {
  deployment: Deployment
}

/**
 * Displays the transparent manpower deployment recommendation.
 *
 * The disclaimer explicitly states that these numbers are estimated from event
 * characteristics — not historical deployment records — because the dataset's
 * assigned_to_police_id field is only populated for 1.6% of incidents.
 */
export default function DeploymentCard({ deployment }: Props) {
  const items = [
    { icon: '👮', label: 'Traffic Officers', count: deployment.officers, accent: 'text-brand-700' },
    { icon: '🦺', label: 'Marshals', count: deployment.marshals, accent: 'text-amber-600' },
    { icon: '🚧', label: 'Barricades', count: deployment.barricades, accent: 'text-accent-700' },
  ]

  return (
    <div className="animate-fade-in rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Recommended Deployment</h3>

      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg bg-white p-2.5 text-center shadow-sm">
            <div className="text-lg">{item.icon}</div>
            <div className={`text-2xl font-extrabold ${item.accent}`}>{item.count}</div>
            <div className="text-[10px] font-medium text-slate-500">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Step-by-step officer deployment breakdown (Phase 5) */}
      {deployment.deployment_steps && deployment.deployment_steps.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 font-mono text-[11px] text-slate-600 shadow-inner">
          <div className="mb-2 font-sans text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Deployment Formula</div>
          <div className="space-y-1.5">
            {deployment.deployment_steps.map((step, idx) => {
              if (step.final) {
                return (
                  <div key={idx} className="pt-1">
                    <div className="mb-1.5 border-t border-slate-300 border-dashed"></div>
                    <div className="flex justify-between font-bold text-brand-700">
                      <span>{step.label}</span>
                      <span>= {step.running} officers</span>
                    </div>
                  </div>
                )
              }
              
              const isBase = idx === 0 || step.label.toLowerCase().includes('base')
              let displayVal = ''
              if (isBase) {
                displayVal = `= ${step.running}`
              } else if (step.delta > 0) {
                displayVal = `+${step.delta}`
              } else if (step.delta < 0) {
                displayVal = `${step.delta}`
              } else {
                displayVal = '—'
              }

              return (
                <div key={idx} className="flex justify-between">
                  <span>{step.label}</span>
                  <span className={step.delta !== 0 ? (step.delta > 0 && !isBase ? 'text-accent-600' : 'text-slate-600') : 'text-slate-500'}>
                    {displayVal}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="mt-2.5 text-[10px] text-slate-500 leading-relaxed">
        <span className="font-semibold text-slate-500">Formula:</span> {deployment.formula_notes}
      </p>
      <p className="mt-1 rounded bg-slate-50 px-2 py-1.5 text-[9px] text-slate-500 leading-tight border border-slate-100">
        Estimated from event characteristics (cause, priority, junction criticality) —
        not derived from historical deployment records, since deployment data
        is only logged for 1.6% of incidents (assigned_to_police_id field).
      </p>
      {deployment.total_memory_logs !== undefined && deployment.total_memory_logs > 0 && (
        <p className="mt-1 text-[9px] text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1.5 rounded leading-tight">
          {deployment.total_memory_logs} outcomes logged during development testing — reflects repeated testing of
          high-priority/resource-constrained scenarios, not a representative measurement of real-world deployment accuracy.
          <span className="block mt-0.5 text-amber-500">See Analytics → Learning Ledger for the full, live concentration breakdown.</span>
        </p>
      )}
    </div>
  )
}
