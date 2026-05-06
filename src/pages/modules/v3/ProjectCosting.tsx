/**
 * v3/ProjectCosting.tsx
 * Re-exports the unified ProjectCosting workspace (already built to v3 enterprise standard).
 * Route: /costing  (defined in navRegistry.ts)
 *
 * Features (see src/pages/modules/ProjectCosting.tsx for full implementation):
 *   - 5-step pipeline: AHSP → WBS → RAB → RAP → Resource
 *   - WorkflowStepper with prerequisite guards
 *   - BudgetHealthPanel (Budget / RAB / RAP Planned / Actual / CPI)
 *   - Guided onboarding when pipeline is empty
 *   - GlobalContextBar with Pipeline health indicator
 *   - SummaryStrip with item counts
 *   - AlertStrip for empty-step warnings
 *   - ErrorBoundary + Suspense per step
 *   - Accessibility: sr-only aria-live announcements
 */
export { default } from '../ProjectCosting'
