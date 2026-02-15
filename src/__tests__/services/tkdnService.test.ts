
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tkdnService } from '../../services/tkdnService'
import type { TKDNItem } from '../../types/tkdn'

// --- MOCKS ---
const mockFromFn = vi.fn()

vi.mock('../../lib/supabaseClient', () => ({
    supabase: null,
    assertSupabase: () => ({
        from: (...args: any[]) => mockFromFn(...args),
        // chaining handled in tests
    }),
    generateId: (prefix = 'id') => `${prefix}-${Math.random().toString(36).substr(2, 5)}`
}))

describe('TKDN Service Unit Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('calculateSummary (Pure Logic)', () => {
        it('should calculate TKDN percentage correctly', () => {
            const items: TKDNItem[] = [
                {
                    id: '1', project_id: 'p1', name: 'Item A', category: 'material',
                    origin: 'domestic', quantity: 10, unit_price: 1000, total_value: 10000,
                    unit: 'pcs', created_at: '', updated_at: ''
                },
                {
                    id: '2', project_id: 'p1', name: 'Item B', category: 'material',
                    origin: 'imported', quantity: 5, unit_price: 2000, total_value: 10000,
                    unit: 'pcs', created_at: '', updated_at: ''
                }
            ]

            // Total: 20,000. Domestic: 10,000. Expected: 50%
            const summary = tkdnService.calculateSummary(items, 40)

            expect(summary.total_domestic).toBe(10000)
            expect(summary.total_imported).toBe(10000)
            expect(summary.tkdn_percentage).toBe(50.0)
            expect(summary.meets_target).toBe(true)
        })

        it('should handle empty items', () => {
            const summary = tkdnService.calculateSummary([], 40)
            expect(summary.tkdn_percentage).toBe(0)
            expect(summary.meets_target).toBe(false)
        })
    })

    describe('createItem', () => {
        it('should insert item and return mapped object', async () => {
            // Mock Insert
            mockFromFn.mockReturnValueOnce({
                insert: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: {
                                id: 'tkdn-1',
                                name: 'Cement',
                                category: 'material',
                                quantity: 100,
                                unit_price: 50000,
                                total_value: 5000000
                            },
                            error: null
                        })
                    })
                })
            })

            const input = {
                project_id: 'p1',
                name: 'Cement',
                category: 'material' as any,
                origin: 'domestic' as any,
                unit: 'sak',
                quantity: 100,
                unit_price: 50000
            }

            const result = await tkdnService.createItem(input)

            expect(result.id).toBe('tkdn-1')
            expect(result.total_value).toBe(5000000)
        })
    })

})
