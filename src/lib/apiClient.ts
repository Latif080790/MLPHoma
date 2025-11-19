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
  getToken?: () =&gt; string | null | undefined
  /** Header default tambahan */
  defaultHeaders?: Record&lt;string, string&gt;
  /** Timeout default dalam ms (default: 15000) */
  timeoutMs?: number
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RequestOptions {
  method?: HttpMethod
  headers?: Record&lt;string, string&gt;
  params?: Record&lt;string, any&gt;
  body?: any
  signal?: AbortSignal
  timeoutMs?: number
}

/** Konfigurasi runtime (mutable) */
const cfg: Required&lt;Pick&lt;ApiClientConfig, 'baseURL' | 'timeoutMs'&gt;&gt; &amp;
  Pick&lt;ApiClientConfig, 'getToken' | 'defaultHeaders'&gt; = {
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
function buildURL(path: string, params?: Record&lt;string, any&gt;): string {
  const base = cfg.baseURL.replace(/\/$/, '')
  let url = `${base}/${String(path).replace(/^\//, '')}`
  if (params &amp;&amp; Object.keys(params).length) {
    const usp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v == null) continue
      if (Array.isArray(v)) {
        v.forEach((item) =&gt; usp.append(k, String(item)))
      } else {
        usp.append(k, String(v))
      }
    }
    url += (url.includes('?') ? '&amp;' : '?') + usp.toString()
  }
  return url
}

/**
 * Core request dengan timeout dan JSON handling otomatis.
 */
export async function request&lt;T = any&gt;(path: string, options: RequestOptions = {}): Promise&lt;T&gt; {
  const method: HttpMethod = options.method ?? 'GET'
  const headers: Record&lt;string, string&gt; = {
    Accept: 'application/json',
    ...(cfg.defaultHeaders || {}),
    ...(options.headers || {}),
  }

  // Body handling
  let body: BodyInit | undefined
  if (options.body != null &amp;&amp; method !== 'GET') {
    if (options.body instanceof FormData || options.body instanceof Blob) {
      body = options.body as any
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
  const timeout = setTimeout(() =&gt; controller.abort(), options.timeoutMs ?? cfg.timeoutMs)
  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', () =&gt; controller.abort(), { once: true })
  }

  const res = await fetch(buildURL(path, options.params), {
    method,
    headers,
    body,
    signal: controller.signal,
  }).finally(() =&gt; clearTimeout(timeout))

  const contentType = res.headers.get('content-type') || ''

  if (!res.ok) {
    let data: any = null
    try {
      data = contentType.includes('application/json') ? await res.json() : await res.text()
    } catch {
      // ignore
    }
    const message =
      (data &amp;&amp; (data.message || data.error || data.msg)) || res.statusText || 'Request failed'
    const err: any = new Error(message)
    err.status = res.status
    err.data = data
    throw err
  }

  if (contentType.includes('application/json')) return (await res.json()) as T
  if (contentType.startsWith('text/')) return (await res.text()) as any as T
  return (await res.blob()) as any as T
}

/**
 * API helpers per method.
 */
const api = {
  get&lt;T = any&gt;(path: string, params?: RequestOptions['params'], opts?: Omit&lt;RequestOptions, 'method' | 'params'&gt;) {
    return request&lt;T&gt;(path, { ...opts, params, method: 'GET' })
  },
  post&lt;T = any&gt;(path: string, body?: any, opts?: Omit&lt;RequestOptions, 'method' | 'body'&gt;) {
    return request&lt;T&gt;(path, { ...opts, body, method: 'POST' })
  },
  put&lt;T = any&gt;(path: string, body?: any, opts?: Omit&lt;RequestOptions, 'method' | 'body'&gt;) {
    return request&lt;T&gt;(path, { ...opts, body, method: 'PUT' })
  },
  patch&lt;T = any&gt;(path: string, body?: any, opts?: Omit&lt;RequestOptions, 'method' | 'body'&gt;) {
    return request&lt;T&gt;(path, { ...opts, body, method: 'PATCH' })
  },
  delete&lt;T = any&gt;(path: string, params?: RequestOptions['params'], opts?: Omit&lt;RequestOptions, 'method' | 'params'&gt;) {
    return request&lt;T&gt;(path, { ...opts, params, method: 'DELETE' })
  },
}

export default api
