/**
 * validationMiddleware.test.ts
 * 
 * Unit tests for validation middleware
 */

import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import {
  validate,
  validateAndExecute,
  validateAndExecuteAsync,
  batchValidate,
  commonValidations,
  createPartialSchema,
  mergeErrorMessages,
  getFieldErrors,
} from '../validationMiddleware'

describe('validationMiddleware', () => {
  describe('validate', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().min(0).max(150),
    })

    it('should validate correct data', () => {
      const result = validate(testSchema, {
        name: 'John',
        age: 30,
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: 'John', age: 30 })
      expect(result.errors).toBeUndefined()
    })

    it('should reject invalid data', () => {
      const result = validate(testSchema, {
        name: '',
        age: -5,
      })

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.length).toBeGreaterThan(0)
      expect(result.data).toBeUndefined()
    })

    it('should format errors correctly', () => {
      const result = validate(testSchema, {
        name: '',
        age: 200,
      })

      expect(result.errors).toBeDefined()
      const errors = result.errors!
      expect(errors.some(e => e.field === 'name')).toBe(true)
      expect(errors.some(e => e.field === 'age')).toBe(true)
    })

    it('should handle missing fields', () => {
      const result = validate(testSchema, {
        name: 'John',
        // age is missing
      })

      expect(result.success).toBe(false)
      expect(result.errors?.some(e => e.field === 'age')).toBe(true)
    })
  })

  describe('validateAndExecute', () => {
    const schema = z.object({
      value: z.number().min(0),
    })

    it('should execute function with valid data', () => {
      const fn = vi.fn((data: { value: number }) => data.value * 2)
      const wrapped = validateAndExecute(schema, fn, { showToast: false })

      const result = wrapped({ value: 10 })

      expect(result.success).toBe(true)
      expect(result.data).toBe(20)
      expect(fn).toHaveBeenCalledWith({ value: 10 })
    })

    it('should not execute function with invalid data', () => {
      const fn = vi.fn()
      const wrapped = validateAndExecute(schema, fn, { showToast: false })

      const result = wrapped({ value: -5 })

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(fn).not.toHaveBeenCalled()
    })

    it('should catch execution errors', () => {
      const fn = vi.fn(() => {
        throw new Error('Execution failed')
      })
      const wrapped = validateAndExecute(schema, fn, { 
        showToast: false,
        throwOnError: false 
      })

      const result = wrapped({ value: 10 })

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors![0].field).toBe('_execution')
    })

    it('should call onError callback on validation failure', () => {
      const onError = vi.fn()
      const fn = vi.fn()
      const wrapped = validateAndExecute(schema, fn, {
        showToast: false,
        onError,
      })

      wrapped({ value: -5 })

      expect(onError).toHaveBeenCalled()
      expect(onError.mock.calls[0][0]).toBeDefined()
    })

    it('should throw when throwOnError is true', () => {
      const fn = vi.fn()
      const wrapped = validateAndExecute(schema, fn, {
        showToast: false,
        throwOnError: true,
      })

      expect(() => wrapped({ value: -5 })).toThrow()
    })
  })

  describe('validateAndExecuteAsync', () => {
    const schema = z.object({
      value: z.number().min(0),
    })

    it('should execute async function with valid data', async () => {
      const fn = vi.fn(async (data: { value: number }) => {
        return data.value * 2
      })
      const wrapped = validateAndExecuteAsync(schema, fn, { showToast: false })

      const result = await wrapped({ value: 10 })

      expect(result.success).toBe(true)
      expect(result.data).toBe(20)
      expect(fn).toHaveBeenCalled()
    })

    it('should not execute async function with invalid data', async () => {
      const fn = vi.fn()
      const wrapped = validateAndExecuteAsync(schema, fn, { showToast: false })

      const result = await wrapped({ value: -5 })

      expect(result.success).toBe(false)
      expect(fn).not.toHaveBeenCalled()
    })

    it('should catch async execution errors', async () => {
      const fn = vi.fn(async () => {
        throw new Error('Async error')
      })
      const wrapped = validateAndExecuteAsync(schema, fn, {
        showToast: false,
        throwOnError: false,
      })

      const result = await wrapped({ value: 10 })

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })
  })

  describe('batchValidate', () => {
    const schema = z.object({
      name: z.string().min(1),
      value: z.number(),
    })

    it('should validate multiple items', () => {
      const items = [
        { name: 'A', value: 1 },
        { name: 'B', value: 2 },
        { name: 'C', value: 3 },
      ]

      const results = batchValidate(schema, items)

      expect(results).toHaveLength(3)
      expect(results.every(r => r.success)).toBe(true)
    })

    it('should include indices in results', () => {
      const items = [
        { name: 'A', value: 1 },
        { name: '', value: 2 }, // Invalid
        { name: 'C', value: 3 },
      ]

      const results = batchValidate(schema, items)

      expect(results[0].index).toBe(0)
      expect(results[1].index).toBe(1)
      expect(results[2].index).toBe(2)
    })

    it('should identify invalid items', () => {
      const items = [
        { name: 'A', value: 1 },
        { name: '', value: 2 }, // Invalid
        { name: 'C', value: 3 },
      ]

      const results = batchValidate(schema, items)

      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[2].success).toBe(true)
    })

    it('should handle empty array', () => {
      const results = batchValidate(schema, [])
      expect(results).toHaveLength(0)
    })
  })

  describe('commonValidations', () => {
    it('should validate positive numbers', () => {
      expect(commonValidations.positiveNumber.safeParse(10).success).toBe(true)
      expect(commonValidations.positiveNumber.safeParse(0).success).toBe(true)
      expect(commonValidations.positiveNumber.safeParse(-5).success).toBe(false)
    })

    it('should validate percentages', () => {
      expect(commonValidations.percentage.safeParse(0).success).toBe(true)
      expect(commonValidations.percentage.safeParse(50).success).toBe(true)
      expect(commonValidations.percentage.safeParse(100).success).toBe(true)
      expect(commonValidations.percentage.safeParse(-1).success).toBe(false)
      expect(commonValidations.percentage.safeParse(101).success).toBe(false)
    })

    it('should validate code format', () => {
      expect(commonValidations.code.safeParse('A.1.1').success).toBe(true)
      expect(commonValidations.code.safeParse('CODE-123').success).toBe(true)
      expect(commonValidations.code.safeParse('').success).toBe(false)
      expect(commonValidations.code.safeParse('code with spaces').success).toBe(false)
    })

    it('should validate ISO dates', () => {
      expect(commonValidations.isoDate.safeParse('2025-11-20').success).toBe(true)
      expect(commonValidations.isoDate.safeParse('2025-1-1').success).toBe(false)
      expect(commonValidations.isoDate.safeParse('20/11/2025').success).toBe(false)
    })

    it('should validate emails', () => {
      expect(commonValidations.email.safeParse('test@example.com').success).toBe(true)
      expect(commonValidations.email.safeParse('invalid-email').success).toBe(false)
    })

    it('should validate URLs', () => {
      expect(commonValidations.url.safeParse('https://example.com').success).toBe(true)
      expect(commonValidations.url.safeParse('not-a-url').success).toBe(false)
    })
  })

  describe('createPartialSchema', () => {
    it('should make all fields optional', () => {
      const schema = z.object({
        name: z.string().min(1),
        age: z.number(),
      })

      const partialSchema = createPartialSchema(schema)

      expect(partialSchema.safeParse({}).success).toBe(true)
      expect(partialSchema.safeParse({ name: 'John' }).success).toBe(true)
      expect(partialSchema.safeParse({ age: 30 }).success).toBe(true)
    })
  })

  describe('mergeErrorMessages', () => {
    it('should merge error messages', () => {
      const errors = [
        { field: 'name', message: 'Name is required' },
        { field: 'age', message: 'Age must be positive' },
      ]

      const merged = mergeErrorMessages(errors)

      expect(merged).toBe('name: Name is required; age: Age must be positive')
    })

    it('should handle empty errors', () => {
      expect(mergeErrorMessages([])).toBe('')
    })
  })

  describe('getFieldErrors', () => {
    it('should get errors for specific field', () => {
      const errors = [
        { field: 'name', message: 'Name is required' },
        { field: 'age', message: 'Age must be positive' },
        { field: 'name', message: 'Name too short' },
      ]

      const nameErrors = getFieldErrors(errors, 'name')

      expect(nameErrors).toHaveLength(2)
      expect(nameErrors).toContain('Name is required')
      expect(nameErrors).toContain('Name too short')
    })

    it('should return empty array for non-existent field', () => {
      const errors = [
        { field: 'name', message: 'Name is required' },
      ]

      const ageErrors = getFieldErrors(errors, 'age')

      expect(ageErrors).toHaveLength(0)
    })

    it('should handle undefined errors', () => {
      const errors = getFieldErrors(undefined, 'name')
      expect(errors).toHaveLength(0)
    })
  })
})
