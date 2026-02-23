/**
 * documentService.test.ts
 * Unit tests for document CRUD + upload.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockFromImpl: (table: string) => any
let mockStorageImpl: (bucket: string) => any

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({
    from: (t: string) => mockFromImpl(t),
    storage: { from: (b: string) => mockStorageImpl(b) },
  }),
}))

vi.mock('../../lib/idGenerator', () => ({
  generateId: () => 'doc-gen-001',
}))

import { documentService } from '../documentService'

function makeChain(result: any) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.neq = () => c
  c.order = () => c
  c.limit = () => c
  c.single = () => Promise.resolve(result)
  c.insert = () => ({
    select: () => ({
      single: () => Promise.resolve(result)
    })
  })
  c.update = () => ({
    eq: () => Promise.resolve(result)
  })
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

describe('documentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageImpl = () => ({
      upload: () => Promise.resolve({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: 'https://storage.example.com/file.pdf' } }),
    })
  })

  describe('getDocuments', () => {
    it('should return documents filtered by is_active', async () => {
      const docs = [
        { id: 'd1', project_id: 'P1', title: 'Contract', category: 'Contracts', file_url: 'url', version_number: 1 },
        { id: 'd2', project_id: 'P1', title: 'Drawing', category: 'Drawings', file_url: 'url2', version_number: 1 },
      ]
      mockFromImpl = () => makeChain({ data: docs, error: null })

      const result = await documentService.getDocuments('P1')
      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('Contract')
    })

    it('should return empty array on null data', async () => {
      mockFromImpl = () => makeChain({ data: null, error: null })
      const result = await documentService.getDocuments('P1')
      expect(result).toEqual([])
    })

    it('should return empty array on error', async () => {
      mockFromImpl = () => makeChain({ data: null, error: new Error('query fail') })
      const result = await documentService.getDocuments('P1')
      expect(result).toEqual([])
    })
  })

  describe('uploadDocument', () => {
    it('should upload file to storage and insert document', async () => {
      let insertedData: any = null

      mockFromImpl = () => ({
        insert: (data: any) => {
          insertedData = data
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { ...data }, error: null }),
            }),
          }
        },
      })

      const file = new File(['pdf content'], 'contract.pdf', { type: 'application/pdf' })

      const result = await documentService.uploadDocument(
        { project_id: 'P1', title: 'Contract', category: 'Contracts' },
        file
      )

      expect(insertedData.id).toBe('doc-gen-001')
      expect(insertedData.file_url).toBe('https://storage.example.com/file.pdf')
      expect(insertedData.mime_type).toBe('application/pdf')
      expect(insertedData.version_number).toBe(1)
      expect(insertedData.is_active).toBe(true)
    })

    it('should use mock URL on storage upload failure', async () => {
      let insertedData: any = null

      mockStorageImpl = () => ({
        upload: () => Promise.resolve({ error: { message: 'Bucket not found' } }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      })

      mockFromImpl = () => ({
        insert: (data: any) => {
          insertedData = data
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { ...data }, error: null }),
            }),
          }
        },
      })

      const file = new File(['data'], 'drawing.dwg', { type: 'application/octet-stream' })
      await documentService.uploadDocument({ project_id: 'P1', title: 'Drawing' }, file)

      expect(insertedData.file_url).toContain('storage.example.com')
    })

    it('should insert without file when no file provided', async () => {
      let insertedData: any = null

      mockFromImpl = () => ({
        insert: (data: any) => {
          insertedData = data
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { ...data }, error: null }),
            }),
          }
        },
      })

      await documentService.uploadDocument({
        project_id: 'P1',
        title: 'External Link',
        file_url: 'https://external.com/doc.pdf',
      })

      expect(insertedData.file_url).toBe('https://external.com/doc.pdf')
    })
  })

  describe('deleteDocument', () => {
    it('should soft-delete by setting is_active to false', async () => {
      let updatedData: any = null

      mockFromImpl = () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { title: 'Test' }, error: null })
          })
        }),
        update: (data: any) => {
          updatedData = data
          return { eq: () => Promise.resolve({ error: null }) }
        },
      })

      await documentService.deleteDocument('d1')
      expect(updatedData).toEqual({ is_active: false })
    })

    it('should throw on error', async () => {
      mockFromImpl = () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { title: 'Test' }, error: null })
          })
        }),
        update: () => ({ eq: () => Promise.resolve({ error: new Error('delete fail') }) }),
      })
      await expect(documentService.deleteDocument('x')).rejects.toThrow()
    })
  })
})
