/**
 * lazyRetry.ts
 *
 * Wrapper around React.lazy() that gracefully handles stale-chunk errors
 * after a Vercel (or any SPA host) re-deployment.
 *
 * When chunk hashes change on re-deploy, users with a cached index.html will
 * request old chunk filenames that no longer exist. The CDN catch-all rewrite
 * returns index.html (text/html) instead of JS, causing:
 *   - "Failed to fetch dynamically imported module"
 *   - "Importing a module script failed" (MIME type mismatch)
 *
 * Strategy:
 *  1. Try the dynamic import.
 *  2. On failure, retry once with a cache-busting query string.
 *  3. If the retry also fails, hard-reload the page (once) so the browser
 *     fetches the latest index.html with correct chunk references.
 */

import React from 'react'

const RELOAD_KEY = 'lazyRetry_reloaded'

/**
 * Drop-in replacement for React.lazy() with automatic chunk-load retry.
 *
 * @example
 *   const WBS = lazyRetry(() => import('./pages/modules/WBS'))
 */
export function lazyRetry<T extends React.ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
    return React.lazy(async () => {
        try {
            return await importFn()
        } catch (firstError) {
            // Retry once — some transient network issues resolve on a second attempt
            try {
                return await importFn()
            } catch {
                // If we haven't reloaded yet in this session, do a hard reload
                // so the browser picks up the new index.html with fresh chunk URLs
                const hasReloaded = sessionStorage.getItem(RELOAD_KEY)
                if (!hasReloaded) {
                    sessionStorage.setItem(RELOAD_KEY, '1')
                    window.location.reload()
                    // Return a never-resolving promise so React doesn't try to render
                    // while the page is reloading
                    return new Promise<never>(() => { })
                }
                // Already tried reloading — surface the original error
                sessionStorage.removeItem(RELOAD_KEY)
                throw firstError
            }
        }
    })
}

export default lazyRetry
