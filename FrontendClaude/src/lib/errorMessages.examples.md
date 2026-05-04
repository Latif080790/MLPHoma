/**
 * Error Handling System - Usage Examples
 * 
 * This file demonstrates how to use the enhanced error handling system
 * in various scenarios throughout the application.
 */

import { useErrorHandler, useContextErrorHandler } from '@/hooks/useErrorHandler'
import { AppError } from '@/lib/errorMessages'
import api from '@/lib/apiClient'

/**
 * Example 1: Basic Error Handling in a Component
 */
export function BasicErrorExample() {
  const { handleError, handleAsync } = useErrorHandler()

  const loadData = async () => {
    // Wrap async operations with automatic error handling
    const data = await handleAsync(
      async () => {
        const response = await api.get('/projects')
        return response
      },
      'network.failed', // Error code if operation fails
      {
        showToast: true, // Show toast notification (default: true)
        logToConsole: true, // Log to console (default: true in dev)
      }
    )

    if (data) {
      // Handle successful response
      console.log('Data loaded:', data)
    }
  }

  const handleSubmit = (formData: any) => {
    try {
      // Validate data
      if (!formData.name) {
        throw new AppError('validation.required', 'Nama proyek wajib diisi')
      }

      // Process data
      // ...
    } catch (error) {
      // Handle error with user-friendly message
      handleError(error, undefined, {
        showToast: true,
      })
    }
  }

  return (
    <div>
      <button onClick={loadData}>Load Data</button>
      <button onClick={() => handleSubmit({})}>Submit</button>
    </div>
  )
}

/**
 * Example 2: Context-Specific Error Handling
 */
export function ContextErrorExample() {
  // Create error handler for specific context
  const { handleError, handleAsync } = useContextErrorHandler('ProjectEditor', {
    logToConsole: true,
    onError: (error, message) => {
      // Custom logging or tracking
      console.log('[ProjectEditor] Error occurred:', message.title)
    },
  })

  const saveProject = async (project: any) => {
    const result = await handleAsync(
      async () => {
        return await api.post('/projects', project)
      },
      'data.sync_failed'
    )

    if (result) {
      console.log('Project saved successfully')
    }
  }

  return (
    <div>
      <button onClick={() => saveProject({ name: 'New Project' })}>
        Save Project
      </button>
    </div>
  )
}

/**
 * Example 3: Validation Error Handling
 */
export function ValidationErrorExample() {
  const { handleValidationError } = useErrorHandler()

  const validateForm = (data: any) => {
    const errors: Record<string, string> = {}

    if (!data.name) {
      errors.name = 'Nama wajib diisi'
    }
    if (!data.startDate) {
      errors.startDate = 'Tanggal mulai wajib diisi'
    }
    if (data.budget && data.budget < 0) {
      errors.budget = 'Budget tidak boleh negatif'
    }

    if (Object.keys(errors).length > 0) {
      handleValidationError(errors, {
        showToast: true,
      })
      return false
    }

    return true
  }

  const handleSubmit = (formData: any) => {
    if (validateForm(formData)) {
      // Process valid data
      console.log('Form is valid')
    }
  }

  return (
    <div>
      <button onClick={() => handleSubmit({})}>Submit</button>
    </div>
  )
}

/**
 * Example 4: Network Error Handling
 */
export function NetworkErrorExample() {
  const { handleNetworkError } = useErrorHandler()

  const fetchData = async () => {
    try {
      const response = await fetch('/api/data', {
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch data')
      }

      const data = await response.json()
      return data
    } catch (error) {
      // Automatically detects offline, timeout, or network failure
      handleNetworkError(error, {
        showToast: true,
      })
    }
  }

  return (
    <div>
      <button onClick={fetchData}>Fetch Data</button>
    </div>
  )
}

/**
 * Example 5: API Error Handling with Status Codes
 */
export function ApiErrorExample() {
  const { handleApiError } = useErrorHandler()

  const deleteProject = async (id: string) => {
    try {
      await api.delete(`/projects/${id}`)
      console.log('Project deleted')
    } catch (error: any) {
      // Automatically maps HTTP status to user-friendly message
      handleApiError(error, error.status, {
        showToast: true,
      })
    }
  }

  return (
    <div>
      <button onClick={() => deleteProject('123')}>Delete Project</button>
    </div>
  )
}

/**
 * Example 6: Custom Error Handler
 */
export function CustomErrorHandlerExample() {
  const { createHandler } = useErrorHandler()

  // Create reusable error handlers
  const handleCalculationError = createHandler('calculation.invalid_input', {
    showToast: true,
    onError: (error, message) => {
      console.error('Calculation failed:', error)
      // Send to error tracking service
    },
  })

  const handleDataError = createHandler('data.corrupted', {
    showToast: true,
    onError: (error, message) => {
      // Attempt data recovery
      console.log('Attempting to recover data...')
    },
  })

  const calculateTotal = (items: any[]) => {
    try {
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Invalid items array')
      }

      const total = items.reduce((sum, item) => {
        if (typeof item.value !== 'number') {
          throw new Error('Invalid item value')
        }
        return sum + item.value
      }, 0)

      return total
    } catch (error) {
      handleCalculationError(error)
      return 0
    }
  }

  return (
    <div>
      <button onClick={() => calculateTotal([])}>Calculate</button>
    </div>
  )
}

/**
 * Example 7: Using AppError for Custom Errors
 */
export function AppErrorExample() {
  const { handleError } = useErrorHandler()

  const processData = (data: any) => {
    try {
      // Check for duplicate
      if (isDuplicate(data)) {
        throw new AppError('validation.duplicate', 'Data dengan nama ini sudah ada')
      }

      // Check permissions
      if (!hasPermission(data)) {
        throw new AppError('permission.denied', 'Anda tidak memiliki izin untuk mengubah data ini')
      }

      // Process...
      console.log('Data processed')
    } catch (error) {
      if (error instanceof AppError) {
        // AppError automatically handled with user-friendly messages
        handleError(error)
      } else {
        // Unknown error
        handleError(error, 'unknown.error')
      }
    }
  }

  return (
    <div>
      <button onClick={() => processData({ name: 'Test' })}>Process</button>
    </div>
  )
}

// Helper functions for examples
function isDuplicate(data: any): boolean {
  return false // Stub
}

function hasPermission(data: any): boolean {
  return true // Stub
}

/**
 * Example 8: Integration with Error Boundary
 */
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export function ErrorBoundaryExample() {
  const { handleError } = useErrorHandler()

  return (
    <ErrorBoundary
      showDetails={process.env.NODE_ENV === 'development'}
      onError={(error, errorInfo) => {
        // Log to error tracking service
        console.error('React error caught:', error, errorInfo)
      }}
      onReset={() => {
        // Reset app state if needed
        console.log('Error boundary reset')
      }}
    >
      <YourComponent />
    </ErrorBoundary>
  )
}

function YourComponent() {
  return <div>Your app content</div>
}

/**
 * Example 9: Batch Operations with Error Handling
 */
export function BatchOperationExample() {
  const { handleError, handleAsync } = useErrorHandler()

  const processBatch = async (items: any[]) => {
    const results = []
    const errors = []

    for (const item of items) {
      const result = await handleAsync(
        async () => {
          return await api.post('/process', item)
        },
        'client.invalid_request',
        {
          showToast: false, // Don't show toast for each error
        }
      )

      if (result) {
        results.push(result)
      } else {
        errors.push(item)
      }
    }

    // Show summary
    if (errors.length > 0) {
      handleError(
        new Error(`${errors.length} item(s) gagal diproses`),
        'client.invalid_request',
        {
          showToast: true,
        }
      )
    }

    return { results, errors }
  }

  return (
    <div>
      <button onClick={() => processBatch([{ id: 1 }, { id: 2 }])}>
        Process Batch
      </button>
    </div>
  )
}
