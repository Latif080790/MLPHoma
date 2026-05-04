/**
 * apiClient.ts
 * Fetch wrapper ringan untuk pemanggilan API:
 * - Base URL terkonfigurasi
 * - Query params builder
 * - Timeout via AbortController
 * - JSON handling otomatis
 * - Bearer token opsional
 */

export interface ApiClientConfig {
  /** Base URL, default: "/api/v1" */
  baseURL?: string
  /** Provider token auth bearer (opsional) */
  getToken?: () => string | null | undefined
  /** Header default tambahan */
  defaultHeaders?: Record<string, string>
  /** Timeout default dalam ms (default: 15000) */
  timeoutMs?: number
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RequestOptions {
  method?: HttpMethod
  headers?: Record<string, string>
  params?: Record<string, unknown>
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
}

/** Konfigurasi runtime (mutable) */
const cfg: Required<Pick<ApiClientConfig, 'baseURL' | 'timeoutMs'>> &
  Pick<ApiClientConfig, 'getToken' | 'defaultHeaders'> = {
  baseURL: '/api/v1',
  timeoutMs: 15000,
  getToken: undefined,
  defaultHeaders: undefined,
}

/**
 * Set/merge konfigurasi API client.
 */
export function setApiConfig(partial: ApiClientConfig) {
  if (partial.baseURL) cfg.baseURL = partial.baseURL
  if (typeof partial.timeoutMs === 'number') cfg.timeoutMs = partial.timeoutMs
  if (partial.getToken) cfg.getToken = partial.getToken
  if (partial.defaultHeaders) cfg.defaultHeaders = partial.defaultHeaders
}

/**
 * Build URL dengan query string dari params.
 */
function buildURL(path: string, params?: Record<string, unknown>): string {
  const base = cfg.baseURL.replace(/\/$/, '')
  let url = `${base}/${String(path).replace(/^\//, '')}`
  if (params && Object.keys(params).length) {
    const usp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v == null) continue
      if (Array.isArray(v)) {
        v.forEach((item) => usp.append(k, String(item)))
      } else {
        usp.append(k, String(v))
      }
    }
    url += (url.includes('?') ? '&' : '?') + usp.toString()
  }
  return url
}

/**
 * Core request dengan timeout dan JSON handling otomatis.
 */
export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const method: HttpMethod = options.method ?? 'GET'
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(cfg.defaultHeaders || {}),
    ...(options.headers || {}),
  }

  // Body handling
  let body: BodyInit | undefined
  if (options.body != null && method !== 'GET') {
    if (options.body instanceof FormData || options.body instanceof Blob) {
      body = options.body as BodyInit
    } else if (typeof options.body === 'string') {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json'
      body = options.body
    } else {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json'
      body = JSON.stringify(options.body)
    }
  }

  // Auth token (opsional)
  if (cfg.getToken) {
    const token = cfg.getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  // Timeout dan abort signal
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? cfg.timeoutMs)
  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  const res = await fetch(buildURL(path, options.params), {
    method,
    headers,
    body,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout))

  const contentType = res.headers.get('content-type') || ''

  if (!res.ok) {
    let data: unknown = null
    try {
      data = contentType.includes('application/json') ? await res.json() : await res.text()
    } catch {
      // ignore
    }
    const dataObj = data as Record<string, unknown> | null
    const message =
      (dataObj && (dataObj['message'] || dataObj['error'] || dataObj['msg'])) || res.statusText || 'Request failed'
    const err = Object.assign(new Error(String(message)), { status: res.status, data })
    throw err
  }

  if (contentType.includes('application/json')) return (await res.json()) as T
  if (contentType.startsWith('text/')) return (await res.text()) as unknown as T
  return (await res.blob()) as unknown as T
}

/**
 * API helpers per method.
 */
const api = {
  get<T = unknown>(path: string, params?: RequestOptions['params'], opts?: Omit<RequestOptions, 'method' | 'params'>) {
    return request<T>(path, { ...opts, params, method: 'GET' })
  },
  post<T = unknown>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) {
    return request<T>(path, { ...opts, body, method: 'POST' })
  },
  put<T = unknown>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) {
    return request<T>(path, { ...opts, body, method: 'PUT' })
  },
  patch<T = unknown>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) {
    return request<T>(path, { ...opts, body, method: 'PATCH' })
  },
  delete<T = unknown>(path: string, params?: RequestOptions['params'], opts?: Omit<RequestOptions, 'method' | 'params'>) {
    return request<T>(path, { ...opts, params, method: 'DELETE' })
  },
}

export default api
