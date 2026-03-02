/**
 * Retry Mechanism Utilities
 * 
 * Provides automatic and manual retry logic for failed operations.
 * Supports exponential backoff, maximum retries, and retry conditions.
 * 
 * @module retryUtils
 */

export interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffFactor?: number
  shouldRetry?: (error: Error, attempt: number) => boolean
  onRetry?: (error: Error, attempt: number, delay: number) => void
}

/**
 * Default retry condition - retry on network errors and 5xx status codes
 */
function defaultShouldRetry(error: Error): boolean {
  // Network errors
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return true
  }

  // Check for status code in error
  const status = (error as Error & { status?: number }).status
  if (status) {
    // Retry on 5xx server errors and 429 (rate limit)
    return status >= 500 || status === 429
  }

  return false
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffFactor: number
): number {
  const delay = initialDelay * Math.pow(backoffFactor, attempt - 1)
  return Math.min(delay, maxDelay)
}

/**
 * Retry an async function with exponential backoff
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options

  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry if this is the last attempt
      if (attempt === maxRetries) {
        break
      }

      // Check if we should retry
      if (!shouldRetry(lastError, attempt + 1)) {
        throw lastError
      }

      // Calculate delay
      const delay = calculateDelay(attempt + 1, initialDelay, maxDelay, backoffFactor)

      // Call retry callback
      onRetry?.(lastError, attempt + 1, delay)

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

/**
 * Create a retry wrapper for a function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return ((...args: Parameters<T>) => {
    return retryAsync(() => fn(...args), options)
  }) as T
}

/**
 * Retry fetch requests
 */
export async function retryFetch(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  return retryAsync(async () => {
    const response = await fetch(url, init)
    
    // Throw error for non-ok responses
    if (!response.ok) {
      const error = Object.assign(
        new Error(`HTTP ${response.status}: ${response.statusText}`),
        { status: response.status, response }
      )
      throw error
    }

    return response
  }, options)
}

/**
 * Retry with progressive timeout
 */
export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  options: RetryOptions = {}
): Promise<T> {
  return retryAsync(async () => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    })

    return Promise.race([fn(), timeoutPromise])
  }, options)
}

/**
 * Manual retry handler class
 */
export class RetryHandler<T> {
  private retryCount = 0
  private lastError: Error | null = null
  private isRetrying = false

  constructor(
    private fn: () => Promise<T>,
    private options: RetryOptions = {}
  ) {}

  /**
   * Execute with automatic retry
   */
  async execute(): Promise<T> {
    return retryAsync(this.fn, this.options)
  }

  /**
   * Manual retry
   */
  async retry(): Promise<T> {
    if (this.isRetrying) {
      throw new Error('Already retrying')
    }

    this.isRetrying = true
    this.retryCount++

    try {
      const result = await this.fn()
      this.lastError = null
      return result
    } catch (error) {
      this.lastError = error instanceof Error ? error : new Error(String(error))
      throw this.lastError
    } finally {
      this.isRetrying = false
    }
  }

  /**
   * Check if can retry
   */
  canRetry(): boolean {
    const maxRetries = this.options.maxRetries || 3
    return this.retryCount < maxRetries && !this.isRetrying
  }

  /**
   * Get retry count
   */
  getRetryCount(): number {
    return this.retryCount
  }

  /**
   * Get last error
   */
  getLastError(): Error | null {
    return this.lastError
  }

  /**
   * Reset retry state
   */
  reset(): void {
    this.retryCount = 0
    this.lastError = null
    this.isRetrying = false
  }
}

/**
 * Circuit breaker for retry logic
 */
export class CircuitBreaker<T> {
  private failureCount = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private fn: () => Promise<T>,
    private options: {
      failureThreshold?: number
      resetTimeout?: number
      monitoringPeriod?: number
    } = {}
  ) {}

  async execute(): Promise<T> {
    const { failureThreshold = 5, resetTimeout = 60000, monitoringPeriod: _monitoringPeriod = 10000 } = this.options

    // Check if circuit is open
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime
      
      if (timeSinceLastFailure >= resetTimeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }

    try {
      const result = await this.fn()

      // Success - reset or close circuit
      if (this.state === 'half-open') {
        this.state = 'closed'
        this.failureCount = 0
      }

      return result
    } catch (error) {
      this.lastFailureTime = Date.now()
      this.failureCount++

      // Check if should open circuit
      if (this.failureCount >= failureThreshold) {
        this.state = 'open'
      }

      throw error
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state
  }

  reset(): void {
    this.state = 'closed'
    this.failureCount = 0
    this.lastFailureTime = 0
  }
}
