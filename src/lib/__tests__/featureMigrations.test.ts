/**
 * featureMigrations.test.ts
 *
 * Tests for migrateConfig fallback behavior and canonicalization.
 */

import { describe, it, expect } from 'vitest'
import { migrateConfig } from '../featureMigrations'

describe('featureMigrations', () => {
  it('creates fallback when given invalid input', () => {
    // pass a bad value
    const out = migrateConfig(null as any)
    expect(out).toBeDefined()
    expect(out.projectManagement).toBeDefined()
    expect(out.projectId).toBeDefined()
  })

  it('ensures schemaVersion present in module meta', () => {
    const sample = { projectId: 'p1', projectManagement: { meta: { projectId: 'p1' } } }
    const migrated = migrateConfig(sample)
    expect(migrated.projectManagement.meta.schemaVersion).toBeDefined()
  })
})