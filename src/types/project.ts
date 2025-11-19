/**
 * project.ts
 * Shared Project types used by Zustand store and UI components.
 */

/**
 * Project
 * Minimal project information used on Home and AppShell headers.
 */
export interface Project {
  /** Unique project identifier (e.g., "P-001") */
  id: string
  /** Human-readable name */
  name: string
  /** Total project budget in IDR */
  budget: number
  /** Current lifecycle status */
  status: 'Active' | 'Planning' | 'Completed'
}
