/**
 * timelineService.test.ts
 * Unit tests for timeline task progress and photo upload.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockStorageFrom = vi.fn()

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: (t: string) => mockFrom(t),
    storage: { from: (b: string) => mockStorageFrom(b) },
  },
}))

import { timelineService } from '../timelineService'

function makeChain(result: any) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.update = () => c
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

      mockFrom.mockImplementation(() => ({
        update: (data: any) => {
          updatedData = data
          return {
            eq: () => ({
              select: () => Promise.resolve({ data: [{ id: 'task-1', progress: 75 }], error: null }),
            }),
          }
        },
      }))

      const result = await timelineService.updateTaskProgress('task-1', 75)
      expect(updatedData.progress).toBe(75)
      expect(updatedData.updated_at).toBeDefined()
      expect(result).toHaveLength(1)
    })

    it('should throw on error', async () => {
      mockFrom.mockImplementation(() => ({
        update: () => ({ eq: () => ({ select: () => Promise.resolve({ data: null, error: new Error('fail') }) }) }),
      }))

      await expect(timelineService.updateTaskProgress('x', 50)).rejects.toThrow()
    })
  })

  describe('uploadProgressPhoto', () => {
    it('should upload file and return public URL', async () => {
      mockStorageFrom.mockImplementation(() => ({
        upload: () => Promise.resolve({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://storage.example.com/photo.jpg' } }),
      }))

      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })
      const url = await timelineService.uploadProgressPhoto(file, 'project-1/task-1')

      expect(url).toBe('https://storage.example.com/photo.jpg')
      expect(mockStorageFrom).toHaveBeenCalledWith('project-evidence')
    })

    it('should throw on upload error', async () => {
      mockStorageFrom.mockImplementation(() => ({
        upload: () => Promise.resolve({ error: { message: 'Bucket not found' } }),
      }))

      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })
      await expect(timelineService.uploadProgressPhoto(file, 'path')).rejects.toThrow('Upload failed')
    })
  })
})
