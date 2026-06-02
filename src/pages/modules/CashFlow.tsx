import { useProjectStore } from '../../store/projectStore'
import useCurvaSStore from '../../store/curvaSStore'

export default function CashFlow() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const getSavedScenarios = useCurvaSStore((s) => s.getSavedScenarios)

  if (!activeProjectId) {
    return (
      <section aria-label="CashFlow Workspace">
        <h1 className="text-2xl font-bold">Cash Flow</h1>
        <p className="text-sm text-muted-foreground">Select an active project first.</p>
      </section>
    )
  }

  const scenarios = getSavedScenarios(activeProjectId)
  const count = scenarios.length

  return (
    <section aria-label="CashFlow Workspace" className="space-y-3">
      <h1 className="text-2xl font-bold">Cash Flow</h1>

      {count === 0 ? (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold">No saved scenarios</h2>
          <p className="text-sm text-muted-foreground">
            You do not have any saved cashflow scenarios
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium">
            {count} saved scenario{count > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </section>
  )
}