/**
 * timelineService.test.ts
 * Unit tests for timeline task progress and photo upload.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockStorageFrom, mockSupabase } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  const mockStorageFrom = vi.fn()
  const mockSupabase = {
    from: mockFrom,
    storage: { from: mockStorageFrom },
  }
  return { mockFrom, mockStorageFrom, mockSupabase }
})

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => mockSupabase,
  supabase: mockSupabase,
}))

import { timelineService } from '../timelineService'

function makeChain(result: any, onUpdate?: (data: any) => void) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.update = (data: any) => {
    if (onUpdate) onUpdate(data)
    return c
  }
  c.single = () => Promise.resolve(result)
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

describe('timelineService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateTaskProgress', () => {
    it('should update progress and updated_at', async () => {
      let updatedData: any = null
      mockFrom.mockReturnValue(makeChain({ data: null, error: null }, (data) => {
        updatedData = data
      }))

      await timelineService.updateTaskProgress('project-1', 'task-1', 75)
      expect(updatedData.progress).toBe(75)
      expect(updatedData.updated_at).toBeDefined()
    })

    it('should throw on error', async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: new Error('fail') }))

      await expect(timelineService.updateTaskProgress('project-1', 'task-id', 50)).rejects.toThrow()
    })
  })

  describe('uploadProgressPhoto', () => {
    it('should upload file and return public URL', async () => {
      mockStorageFrom.mockImplementation(() => ({
        upload: () => Promise.resolve({ data: { path: 'test' }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://test.com/photo.jpg' } }),
      }))

      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })
      const url = await timelineService.uploadProgressPhoto(file, 'project-1/task-1')

      expect(url).toBe('https://test.com/photo.jpg')
      expect(mockStorageFrom).toHaveBeenCalledWith('progress-evidence')
    })

    it('should throw on upload error', async () => {
      mockStorageFrom.mockImplementation(() => ({
        upload: () => Promise.resolve({ error: { message: 'Bucket not found' } }),
      }))

      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })
      await expect(timelineService.uploadProgressPhoto(file, 'path')).rejects.toThrow('Bucket not found')
    })
  })
})
