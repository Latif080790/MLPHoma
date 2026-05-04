/**
 * Form Validation Hook
 * 
 * Provides real-time form validation with field-level feedback.
 * Supports custom validation rules and async validation.
 * 
 * @module useFormValidation
 */

import { useState, useCallback, useMemo } from 'react'

export type ValidationRule<T = unknown> = {
  validate: (value: T, allValues?: Record<string, unknown>) => boolean | Promise<boolean>
  message: string
}

export type FieldRules<T = unknown> = {
  required?: boolean | string
  min?: { value: number; message?: string }
  max?: { value: number; message?: string }
  minLength?: { value: number; message?: string }
  maxLength?: { value: number; message?: string }
  pattern?: { value: RegExp; message?: string }
  email?: boolean | string
  custom?: ValidationRule<T>[]
}

export interface FormConfig<T extends Record<string, unknown>> {
  initialValues: T
  validationRules?: Partial<Record<keyof T, FieldRules>>
  validateOnChange?: boolean
  validateOnBlur?: boolean
  onSubmit?: (values: T) => void | Promise<void>
}

/**
 * Hook for form validation
 */
export function useFormValidation<T extends Record<string, unknown>>(config: FormConfig<T>) {
  const [values, setValues] = useState<T>(config.initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  /**
   * Validate single field
   */
  const validateField = useCallback(
    async (name: keyof T, value: unknown): Promise<string | null> => {
      const rules = config.validationRules?.[name]
      if (!rules) return null

      // Required validation
      if (rules.required) {
        const isEmpty = value === null || value === undefined || value === ''
        if (isEmpty) {
          return typeof rules.required === 'string' ? rules.required : 'Field ini wajib diisi'
        }
      }

      // Email validation
      if (rules.email && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(String(value))) {
          return typeof rules.email === 'string' ? rules.email : 'Format email tidak valid'
        }
      }

      // Pattern validation
      if (rules.pattern && value) {
        if (!rules.pattern.value.test(String(value))) {
          return rules.pattern.message || 'Format tidak sesuai'
        }
      }

      // Min/Max for numbers
      if (typeof value === 'number') {
        if (rules.min && value < rules.min.value) {
          return rules.min.message || `Nilai minimum adalah ${rules.min.value}`
        }
        if (rules.max && value > rules.max.value) {
          return rules.max.message || `Nilai maksimum adalah ${rules.max.value}`
        }
      }

      // MinLength/MaxLength for strings
      if (typeof value === 'string') {
        if (rules.minLength && value.length < rules.minLength.value) {
          return rules.minLength.message || `Minimal ${rules.minLength.value} karakter`
        }
        if (rules.maxLength && value.length > rules.maxLength.value) {
          return rules.maxLength.message || `Maksimal ${rules.maxLength.value} karakter`
        }
      }

      // Custom validations
      if (rules.custom) {
        for (const rule of rules.custom) {
          const isValid = await rule.validate(value, values)
          if (!isValid) {
            return rule.message
          }
        }
      }

      return null
    },
    [config.validationRules, values]
  )

  /**
   * Validate all fields
   */
  const validateAll = useCallback(async (): Promise<boolean> => {
    setIsValidating(true)
    const newErrors: Partial<Record<keyof T, string>> = {}

    for (const name of Object.keys(values) as Array<keyof T>) {
      const error = await validateField(name, values[name])
      if (error) {
        newErrors[name] = error
      }
    }

    setErrors(newErrors)
    setIsValidating(false)

    return Object.keys(newErrors).length === 0
  }, [values, validateField])

  /**
   * Handle field change
   */
  const handleChange = useCallback(
    async (name: keyof T, value: unknown) => {
      setValues((prev) => ({ ...prev, [name]: value }))

      if (config.validateOnChange) {
        const error = await validateField(name, value)
        setErrors((prev) => ({
          ...prev,
          [name]: error || undefined,
        }))
      }
    },
    [config.validateOnChange, validateField]
  )

  /**
   * Handle field blur
   */
  const handleBlur = useCallback(
    async (name: keyof T) => {
      setTouched((prev) => ({ ...prev, [name]: true }))

      if (config.validateOnBlur) {
        const error = await validateField(name, values[name])
        setErrors((prev) => ({
          ...prev,
          [name]: error || undefined,
        }))
      }
    },
    [config.validateOnBlur, validateField, values]
  )

  /**
   * Handle form submit
   */
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()

      setIsSubmitting(true)
      const isValid = await validateAll()

      if (isValid && config.onSubmit) {
        try {
          await config.onSubmit(values)
        } catch (error) {
          console.error('Form submission error:', error)
        }
      }

      setIsSubmitting(false)
    },
    [validateAll, config, values]
  )

  /**
   * Reset form
   */
  const reset = useCallback(() => {
    setValues(config.initialValues)
    setErrors({})
    setTouched({})
    setIsSubmitting(false)
  }, [config.initialValues])

  /**
   * Set field value
   */
  const setFieldValue = useCallback((name: keyof T, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }))
  }, [])

  /**
   * Set field error
   */
  const setFieldError = useCallback((name: keyof T, error: string | null) => {
    setErrors((prev) => ({
      ...prev,
      [name]: error || undefined,
    }))
  }, [])

  /**
   * Set field touched
   */
  const setFieldTouched = useCallback((name: keyof T, isTouched = true) => {
    setTouched((prev) => ({ ...prev, [name]: isTouched }))
  }, [])

  /**
   * Get field props for input binding
   */
  const getFieldProps = useCallback(
    (name: keyof T) => ({
      name: String(name),
      value: values[name] ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        handleChange(name, e.target.value)
      },
      onBlur: () => handleBlur(name),
    }),
    [values, handleChange, handleBlur]
  )

  /**
   * Get field meta information
   */
  const getFieldMeta = useCallback(
    (name: keyof T) => ({
      value: values[name],
      error: errors[name],
      touched: touched[name],
      hasError: Boolean(errors[name]),
      shouldShowError: Boolean(touched[name] && errors[name]),
    }),
    [values, errors, touched]
  )

  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors])
  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(config.initialValues),
    [values, config.initialValues]
  )

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValidating,
    isValid,
    isDirty,
    handleChange,
    handleBlur,
    handleSubmit,
    validateField,
    validateAll,
    reset,
    setFieldValue,
    setFieldError,
    setFieldTouched,
    getFieldProps,
    getFieldMeta,
  }
}

/**
 * Common validation rules
 */
export const validationRules = {
  required: (message = 'Field ini wajib diisi'): FieldRules => ({
    required: message,
  }),

  email: (message = 'Format email tidak valid'): FieldRules => ({
    email: message,
  }),

  minLength: (length: number, message?: string): FieldRules => ({
    minLength: {
      value: length,
      message: message || `Minimal ${length} karakter`,
    },
  }),

  maxLength: (length: number, message?: string): FieldRules => ({
    maxLength: {
      value: length,
      message: message || `Maksimal ${length} karakter`,
    },
  }),

  min: (value: number, message?: string): FieldRules => ({
    min: {
      value,
      message: message || `Nilai minimum adalah ${value}`,
    },
  }),

  max: (value: number, message?: string): FieldRules => ({
    max: {
      value,
      message: message || `Nilai maksimum adalah ${value}`,
    },
  }),

  pattern: (regex: RegExp, message = 'Format tidak sesuai'): FieldRules => ({
    pattern: {
      value: regex,
      message,
    },
  }),

  numeric: (message = 'Hanya angka yang diperbolehkan'): FieldRules => ({
    pattern: {
      value: /^\d+$/,
      message,
    },
  }),

  alphanumeric: (message = 'Hanya huruf dan angka yang diperbolehkan'): FieldRules => ({
    pattern: {
      value: /^[a-zA-Z0-9]+$/,
      message,
    },
  }),

  url: (message = 'Format URL tidak valid'): FieldRules => ({
    pattern: {
      value: /^https?:\/\/.+/,
      message,
    },
  }),

  phone: (message = 'Format nomor telepon tidak valid'): FieldRules => ({
    pattern: {
      value: /^[0-9+\-\s()]+$/,
      message,
    },
  }),
}
