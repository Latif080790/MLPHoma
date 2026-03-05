import { useEffect, useCallback, useRef } from 'react'

/**
 * QW.8 — Unsaved Changes Guard
 *
 * Blocks browser tab close/reload AND in-app hash navigation when the
 * user has unsaved changes.
 *
 * Note: useBlocker (React Router data-router API) is intentionally NOT
 * used here because the app uses <HashRouter> (legacy component router)
 * which does not support data-router APIs.  Instead we intercept:
 *   1. beforeunload  — tab close / hard reload
 *   2. popstate      — back/forward button in hash routing
 *   3. hashchange    — programmatic hash navigation
 *
 * @param isDirty  True when there are uncommitted changes.
 * @param message  Confirmation message shown in the native dialog.
 * @returns `confirmNavigation` — call after a successful save to clear the guard.
 */
export function useUnsavedChanges(
    isDirty: boolean,
    message = 'You have unsaved changes. Leave anyway?'
) {
    // Keep a ref so event handlers always see the latest value without
    // requiring re-registration.
    const isDirtyRef = useRef(isDirty)
    useEffect(() => { isDirtyRef.current = isDirty }, [isDirty])

    // 1. Browser tab close / hard reload guard
    useEffect(() => {
        if (!isDirty) return
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = message
            return message
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [isDirty, message])

    // 2. In-app navigation guard via popstate (back/forward) + hashchange
    useEffect(() => {
        const handlePop = (e: PopStateEvent | HashChangeEvent) => {
            if (!isDirtyRef.current) return
            const confirmed = window.confirm(message)
            if (!confirmed) {
                // Push the current state back to cancel the navigation
                if (e.type === 'popstate') {
                    window.history.pushState(null, '', window.location.href)
                } else {
                    // hashchange: restore old hash
                    const oldURL = (e as HashChangeEvent).oldURL
                    if (oldURL) {
                        const hash = '#' + oldURL.split('#')[1]
                        window.history.replaceState(null, '', hash || '#/')
                    }
                }
            }
        }
        window.addEventListener('popstate', handlePop)
        window.addEventListener('hashchange', handlePop)
        return () => {
            window.removeEventListener('popstate', handlePop)
            window.removeEventListener('hashchange', handlePop)
        }
    }, [message])

    // 3. Imperative escape hatch (no-op here, kept for API compatibility)
    const confirmNavigation = useCallback(() => {
        isDirtyRef.current = false
    }, [])

    return { confirmNavigation, isBlocked: false }
}
