/**
 * validationMiddleware.ts
 * 
 * Runtime validation middleware for store operations.
 * Provides wrapper functions that validate data using Zod schemas before
 * executing store mutations, preventing invalid data from entering the system.
 * 
 * Usage:
 * ```ts
 * const safeAddItem = validateAndExecute(
 *   ahspItemSchema,
 *   (data) => store.addItem(data),
 *   { onError: (errors) => toast.error(errors[0].message) }
 * )
 * ```
 */

import { z, ZodSchema, ZodError } from 'zod'
import { toast } from 'sonner'

/**
 * Validation result interface
 */
export interface ValidationResult<T> {
  success: boolean
  data?: T
  errors?: ValidationError[]
}

/**
 * Validation error interface
 */
export interface ValidationError {
  field: string
  message: string
}

/**
 * Validation middleware options
 */
export interface ValidationOptions {
  /** Custom error handler */
  onError?: (errors: ValidationError[]) => void
  /** Whether to show toast notifications */
  showToast?: boolean
  /** Custom toast message prefix */
  toastPrefix?: string
  /** Whether to throw on validation error */
  throwOnError?: boolean
}

/**
 * Format Zod errors into readable ValidationError array
 */
export function formatZodErrors(error: ZodError): ValidationError[] {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }))
}

/**
 * Validate data against a Zod schema
 * 
 * @param schema Zod schema to validate against
 * @param data Data to validate
 * @returns ValidationResult with success status and data/errors
 * 
 * @example
 * ```ts
 * const result = validate(ahspItemSchema, formData)
 * if (result.success) {
 *   // result.data is typed and validated
 *   store.addItem(result.data)
 * } else {
 *   // result.errors contains formatted error messages
 *   console.error(result.errors)
 * }
 * ```
 */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const result = schema.safeParse(data)
    
    if (result.success) {
      return {
        success: true,
        data: result.data,
      }
    } else {
      return {
        success: false,
        errors: formatZodErrors(result.error),
      }
    }
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          field: '_general',
          message: error instanceof Error ? error.message : 'Validation failed',
        },
      ],
    }
  }
}

/**
 * Create a validated wrapper around a function
 * 
 * Returns a new function that validates input before executing the original function.
 * If validation fails, the original function is not called.
 * 
 * @param schema Zod schema for input validation
 * @param fn Function to wrap with validation
 * @param options Validation options
 * @returns Wrapped function with validation
 * 
 * @example
 * ```ts
 * const addAHSPItem = validateAndExecute(
 *   ahspItemSchema,
 *   (data) => useAHSPStore.getState().addItem(data),
 *   { showToast: true, toastPrefix: 'AHSP Item' }
 * )
 * 
 * // Later in component:
 * const handleSubmit = (formData) => {
 *   const result = addAHSPItem(formData)
 *   if (result.success) {
 *     onClose()
 *   }
 * }
 * ```
 */
export function validateAndExecute<TInput, TOutput>(
  schema: ZodSchema<TInput>,
  fn: (data: TInput) => TOutput,
  options: ValidationOptions = {}
): (data: unknown) => ValidationResult<TOutput> {
  const {
    onError,
    showToast = true,
    toastPrefix = 'Validation',
    throwOnError = false,
  } = options

  return (data: unknown): ValidationResult<TOutput> => {
    // Validate input
    const validation = validate(schema, data)
    
    if (!validation.success) {
      // Handle validation errors
      const errors = validation.errors || []
      
      if (showToast && errors.length > 0) {
        const firstError = errors[0]
        toast.error(`${toastPrefix} Error: ${firstError.message}`, {
          description: firstError.field !== '_general' ? `Field: ${firstError.field}` : undefined,
        })
      }
      
      if (onError) {
        onError(errors)
      }
      
      if (throwOnError) {
        throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`)
      }
      
      return {
        success: false,
        errors,
      }
    }
    
    // Execute function with validated data
    try {
      const result = fn(validation.data!)
      return {
        success: true,
        data: result,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Execution failed'
      const errors: ValidationError[] = [
        {
          field: '_execution',
          message: errorMessage,
        },
      ]
      
      if (showToast) {
        toast.error(`${toastPrefix} Error: ${errorMessage}`)
      }
      
      if (onError) {
        onError(errors)
      }
      
      if (throwOnError) {
        throw error
      }
      
      return {
        success: false,
        errors,
      }
    }
  }
}

/**
 * Create a validated async wrapper around an async function
 * 
 * @param schema Zod schema for input validation
 * @param fn Async function to wrap with validation
 * @param options Validation options
 * @returns Wrapped async function with validation
 * 
 * @example
 * ```ts
 * const importAHSPItems = validateAndExecuteAsync(
 *   z.array(ahspItemSchema),
 *   async (items) => {
 *     await store.importItems(items)
 *     await syncToSupabase(items)
 *   },
 *   { showToast: true, toastPrefix: 'Import' }
 * )
 * 
 * // Later:
 * const result = await importAHSPItems(parsedData)
 * ```
 */
export function validateAndExecuteAsync<TInput, TOutput>(
  schema: ZodSchema<TInput>,
  fn: (data: TInput) => Promise<TOutput>,
  options: ValidationOptions = {}
): (data: unknown) => Promise<ValidationResult<TOutput>> {
  const {
    onError,
    showToast = true,
    toastPrefix = 'Validation',
    throwOnError = false,
  } = options

  return async (data: unknown): Promise<ValidationResult<TOutput>> => {
    // Validate input
    const validation = validate(schema, data)
    
    if (!validation.success) {
      // Handle validation errors
      const errors = validation.errors || []
      
      if (showToast && errors.length > 0) {
        const firstError = errors[0]
        toast.error(`${toastPrefix} Error: ${firstError.message}`, {
          description: firstError.field !== '_general' ? `Field: ${firstError.field}` : undefined,
        })
      }
      
      if (onError) {
        onError(errors)
      }
      
      if (throwOnError) {
        throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`)
      }
      
      return {
        success: false,
        errors,
      }
    }
    
    // Execute async function with validated data
    try {
      const result = await fn(validation.data!)
      return {
        success: true,
        data: result,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Execution failed'
      const errors: ValidationError[] = [
        {
          field: '_execution',
          message: errorMessage,
        },
      ]
      
      if (showToast) {
        toast.error(`${toastPrefix} Error: ${errorMessage}`)
      }
      
      if (onError) {
        onError(errors)
      }
      
      if (throwOnError) {
        throw error
      }
      
      return {
        success: false,
        errors,
      }
    }
  }
}

/**
 * Batch validate multiple items
 * 
 * @param schema Zod schema for each item
 * @param items Array of items to validate
 * @returns Array of validation results with indices
 * 
 * @example
 * ```ts
 * const results = batchValidate(ahspItemSchema, importedItems)
 * const valid = results.filter(r => r.success).map(r => r.data)
 * const invalid = results.filter(r => !r.success)
 * 
 * if (invalid.length > 0) {
 *   console.log(`${invalid.length} items failed validation`)
 * }
 * ```
 */
export function batchValidate<T>(
  schema: ZodSchema<T>,
  items: unknown[]
): Array<ValidationResult<T> & { index: number }> {
  return items.map((item, index) => ({
    ...validate(schema, item),
    index,
  }))
}

/**
 * Create validation schemas with common patterns
 */
export const commonValidations = {
  /**
   * Positive number validation
   */
  positiveNumber: z.number().min(0, 'Must be positive'),
  
  /**
   * Percentage validation (0-100)
   */
  percentage: z.number().min(0, 'Min 0%').max(100, 'Max 100%'),
  
  /**
   * Non-empty string validation
   */
  nonEmptyString: z.string().min(1, 'Required'),
  
  /**
   * Code validation (alphanumeric with dots and dashes)
   */
  code: z.string()
    .min(1, 'Code is required')
    .regex(/^[A-Za-z0-9\.\-]+$/, 'Invalid code format'),
  
  /**
   * ISO date validation
   */
  isoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  
  /**
   * Email validation
   */
  email: z.string().email('Invalid email format'),
  
  /**
   * URL validation
   */
  url: z.string().url('Invalid URL format'),
}

/**
 * Create a partial schema from an existing schema
 * Useful for update operations where all fields are optional
 * 
 * @example
 * ```ts
 * const updateSchema = createPartialSchema(ahspItemSchema)
 * // All fields now optional for partial updates
 * ```
 */
export function createPartialSchema<T extends z.ZodObject<any>>(
  schema: T
): z.ZodObject<{
  [K in keyof T['shape']]: z.ZodOptional<T['shape'][K]>
}> {
  return schema.partial() as any
}

/**
 * Merge multiple validation errors into a single message
 */
export function mergeErrorMessages(errors: ValidationError[] | undefined): string {
  if (!errors || errors.length === 0) return 'Validation failed'
  return errors.map(e => `${e.field}: ${e.message}`).join('; ')
}

/**
 * Get errors for a specific field
 */
export function getFieldErrors(
  errors: ValidationError[] | undefined,
  field: string
): string[] {
  if (!errors) return []
  return errors
    .filter(e => e.field === field)
    .map(e => e.message)
}

export default {
  validate,
  validateAndExecute,
  validateAndExecuteAsync,
  batchValidate,
  commonValidations,
  createPartialSchema,
  mergeErrorMessages,
  getFieldErrors,
}
