import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAHSPStore } from '../ahspStore'

// Mock Supabase
vi.mock('../../lib/supabaseClient', () => ({
    assertSupabase: () => ({
        from: () => ({
            select: () => ({
                order: () => Promise.resolve({ data: [], error: null })
            }),
            upsert: () => Promise.resolve({ data: null, error: null }),
            delete: () => ({
                eq: () => Promise.resolve({ data: null, error: null })
            })
        })
    })
}))

describe('ahspStore Logic', () => {
    beforeEach(() => {
        useAHSPStore.setState({
            ahspItems: [],
            resources: [],
            componentsByAHSP: {},
            settings: { defaultOverhead: 10, defaultProfit: 10 }
        })
    })

    it('should initialize with default settings', () => {
        const state = useAHSPStore.getState()
        expect(state.settings.defaultOverhead).toBe(10)
        expect(state.settings.defaultProfit).toBe(10)
    })

    it('should update settings', () => {
        useAHSPStore.getState().updateSettings({ defaultOverhead: 15 })
        const state = useAHSPStore.getState()
        expect(state.settings.defaultOverhead).toBe(15)
        // Profit should remain unchanged
        expect(state.settings.defaultProfit).toBe(10)
    })

    it('should apply settings to all items', () => {
        // Setup initial state with an item having old settings
        useAHSPStore.setState({
            ahspItems: [
                {
                    id: '1',
                    code: 'A.1',
                    name: 'Test Item',
                    unit: 'm3',
                    category: 'Test',
                    basePrice: 1000,
                    overheadPercentage: 5,
                    profitPercentage: 5,
                    finalPrice: 1100, // 1000 + 5% + 5% roughly
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ],
            settings: { defaultOverhead: 10, defaultProfit: 20 }
        })

        // Apply settings
        useAHSPStore.getState().applySettingsToAll()

        // Check if item was updated
        const state = useAHSPStore.getState()
        const item = state.ahspItems[0]
        expect(item.overheadPercentage).toBe(10)
        expect(item.profitPercentage).toBe(20)
    })
})
