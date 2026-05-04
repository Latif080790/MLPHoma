/**
 * Error Handler Hook
 * 
 * Centralized error handling with user-friendly messages and notifications.
 * Integrates with error message mapping and toast notifications.
 * 
 * @module useErrorHandler
 */

import { useCallback } from 'react'
import { toast } from 'sonner'
import { formatError, getErrorMessage, AppError, type ErrorMessage } from '@/lib/errorMessages'

export interface ErrorHandlerOptions {
  showToast?: boolean
  logToConsole?: boolean
  onError?: (error: Error, errorMessage: ErrorMessage) => void
  fallbackMessage?: string
}

/**
 * Hook for handling errors with user-friendly messages
 */
export function useErrorHandler() {
  /**
   * Handle error with formatting and notification
   */
  const handleError = useCallback((
    error: Error | string | unknown,
    code?: string,
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      showToast = true,
      logToConsole = true,
      onError,
      fallbackMessage,
    } = options

    let errorObj: Error
    let errorMessage: ErrorMessage

    // Convert error to Error object
    if (error instanceof Error) {
      errorObj = error
    } else if (typeof error === 'string') {
      errorObj = new Error(error)
    } else {
      errorObj = new Error(fallbackMessage || 'An unknown error occurred')
    }

    // Get formatted error message
    if (error instanceof AppError) {
      errorMessage = error.toErrorMessage()
    } else if (code) {
      errorMessage = getErrorMessage(code)
    } else {
      errorMessage = formatError(errorObj)
    }

    // Log to console in development
    if (logToConsole && process.env.NODE_ENV === 'development') {
      console.error('[Error Handler]', {
        error: errorObj,
        code,
        message: errorMessage,
      })
    }

    // Show toast notification
    if (showToast) {
      const description = errorMessage.action
        ? `${errorMessage.message} — 💡 ${errorMessage.action}`
        : errorMessage.message

      if (errorMessage.severity === 'warning') {
        toast.warning(errorMessage.title, { description })
      } else {
        toast.error(errorMessage.title, { description })
      }
    }

    // Call custom error handler
    if (onError) {
      onError(errorObj, errorMessage)
    }

    return errorMessage
  }, [])

  /**
   * Handle async operation with error catching
   */
  const handleAsync = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    errorCode?: string,
    options: ErrorHandlerOptions = {}
  ): Promise<T | null> => {
    try {
      return await asyncFn()
    } catch (error) {
      handleError(error, errorCode, options)
      return null
    }
  }, [handleError])

  /**
   * Create error handler for specific error code
   */
  const createHandler = useCallback((
    code: string,
    options: ErrorHandlerOptions = {}
  ) => {
    return (error: Error | string | unknown) => {
      handleError(error, code, options)
    }
  }, [handleError])

  /**
   * Handle validation errors
   */
  const handleValidationError = useCallback((
    errors: Record<string, string> | string[],
    options: ErrorHandlerOptions = {}
  ) => {
    const errorMessage = Array.isArray(errors)
      ? errors.join(', ')
      : Object.values(errors).join(', ')

    return handleError(
      errorMessage,
      'validation.invalid_format',
      options
    )
  }, [handleError])

  /**
   * Handle network errors
   */
  const handleNetworkError = useCallback((
    error: Error | unknown,
    options: ErrorHandlerOptions = {}
  ) => {
    if (!navigator.onLine) {
      return handleError(error, 'network.offline', options)
    }

    const errorObj = error instanceof Error ? error : new Error('Network error')
    
    if (errorObj.message.includes('timeout')) {
      return handleError(error, 'network.timeout', options)
    }

    return handleError(error, 'network.failed', options)
  }, [handleError])

  /**
   * Handle API errors with HTTP status
   */
  const handleApiError = useCallback((
    error: Error | unknown,
    status?: number,
    options: ErrorHandlerOptions = {}
  ) => {
    let code: string | undefined

    if (status) {
      switch (status) {
        case 400:
          code = 'client.invalid_request'
          break
        case 401:
          code = 'auth.unauthorized'
          break
        case 403:
          code = 'permission.denied'
          break
        case 404:
          code = 'notfound.resource'
          break
        case 409:
          code = 'conflict.version'
          break
        case 429:
          code = 'client.rate_limit'
          break
        case 500:
          code = 'server.internal'
          break
        case 503:
          code = 'server.maintenance'
          break
        default:
          code = status >= 500 ? 'server.internal' : 'client.invalid_request'
      }
    }

    return handleError(error, code, options)
  }, [handleError])

  return {
    handleError,
    handleAsync,
    createHandler,
    handleValidationError,
    handleNetworkError,
    handleApiError,
  }
}

/**
 * Hook for handling errors in a specific context
 */
export function useContextErrorHandler(
  context: string,
  defaultOptions: ErrorHandlerOptions = {}
) {
  const { handleError, handleAsync } = useErrorHandler()

  const contextHandler = useCallback((
    error: Error | string | unknown,
    code?: string,
    options: ErrorHandlerOptions = {}
  ) => {
    return handleError(error, code, {
      ...defaultOptions,
      ...options,
      onError: (err, msg) => {
        console.error(`[${context}]`, err)
        options.onError?.(err, msg)
        defaultOptions.onError?.(err, msg)
      },
    })
  }, [context, handleError, defaultOptions])

  const contextAsync = useCallback(<T>(
    asyncFn: () => Promise<T>,
    errorCode?: string,
    options: ErrorHandlerOptions = {}
  ) => {
    return handleAsync(asyncFn, errorCode, {
      ...defaultOptions,
      ...options,
    })
  }, [handleAsync, defaultOptions])

  return {
    handleError: contextHandler,
    handleAsync: contextAsync,
  }
}
