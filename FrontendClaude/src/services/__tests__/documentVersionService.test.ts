import { beforeEach, describe, expect, it, vi } from 'vitest'

let tableResults: Record<string, any> = {}

function makeChain(result: any) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.order = () => c
  c.or = () => c
  c.limit = () => c
  c.update = () => c
  c.insert = () => c
  c.single = () => Promise.resolve(result)
  c.maybeSingle = () => Promise.resolve(result)
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (table: string) => makeChain(tableResults[table] ?? { data: null, error: null }) }),
}))

vi.mock('../auditService', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}))

import { documentVersionService } from '../documentVersionService'

describe('documentVersionService', () => {
  beforeEach(() => {
    tableResults = {}
  })

  it('blocks upload when document is locked', async () => {
    documentVersionService.lockDocument('doc-group-1', 'PM User')

    await expect(documentVersionService.uploadNewVersion({
      documentId: 'doc-group-1',
      projectId: 'proj-1',
      fileUrl: 'https://example.com/new.pdf',
      changeNotes: 'new revision',
    })).rejects.toThrow(/locked by PM User/i)
  })

  it('returns latest document per group', async () => {
    tableResults.documents = {
      data: [
        { id: 'd1', document_group_id: 'g1', project_id: 'p1', category: 'Reports', title: 'A', file_url: 'u1', version_number: 1, change_notes: '', uploaded_by: 'u', is_latest: false, created_at: '2026-01-01' },
        { id: 'd2', document_group_id: 'g1', project_id: 'p1', category: 'Reports', title: 'A', file_url: 'u2', version_number: 2, change_notes: '', uploaded_by: 'u', is_latest: true, created_at: '2026-01-02' },
        { id: 'd3', document_group_id: 'g2', project_id: 'p1', category: 'Drawings', title: 'B', file_url: 'u3', version_number: 1, change_notes: '', uploaded_by: 'u', is_latest: true, created_at: '2026-01-03' },
      ],
      error: null,
    }

    const docs = await documentVersionService.getLatestDocuments('p1')
    expect(docs).toHaveLength(2)
    expect(docs.find((d) => d.documentId === 'g1')?.versionNumber).toBe(2)
  })
})
