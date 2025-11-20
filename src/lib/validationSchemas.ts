/**
 * validationSchemas.ts
 * Central zod schemas for AHSP & RAB related form inputs.
 * Non-invasive usage: existing components can import and use .safeParse.
 */
import { z } from 'zod'

// Common units allowed for AHSP items (extend as needed)
export const unitEnum = z.enum([
  'm3','m2','m','kg','ltr','bh','oh','jam','hr','hari','unit'
])

// AHSP Item form schema (excluding id & timestamps which are generated)
export const ahspItemSchema = z.object({
  code: z.string()
    .min(1, 'Code is required')
    .regex(/^[A-Za-z0-9\.\-]+$/, 'Code must contain only letters, numbers, dots, and dashes'),
  name: z.string().min(1, 'Name is required').max(200, 'Name must be less than 200 characters'),
  description: z.string().optional().or(z.literal('')),
  unit: unitEnum,
  category: z.string().min(1, 'Category is required'),
  overheadPercentage: z.number().min(0, 'Min 0').max(100, 'Max 100'),
  profitPercentage: z.number().min(0, 'Min 0').max(100, 'Max 100'),
  isActive: z.boolean(),
})

// RAB Item schema (example; adjust fields as actual RAB item shape evolves)
export const rabItemSchema = z.object({
  ahspCode: z.string().min(1),
  description: z.string().optional().or(z.literal('')),
  volume: z.number().min(0, 'Volume cannot be negative'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  overheadPercentage: z.number().min(0).max(100).optional(),
  profitPercentage: z.number().min(0).max(100).optional(),
  taxPercentage: z.number().min(0).max(100).optional(),
})

export type AHSPItemInput = z.infer<typeof ahspItemSchema>
export type RABItemInput = z.infer<typeof rabItemSchema>

export function validateAHSPItem(data: unknown) {
  return ahspItemSchema.safeParse(data)
}

export function validateRABItem(data: unknown) {
  return rabItemSchema.safeParse(data)
}
