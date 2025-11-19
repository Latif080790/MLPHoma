/**
 * NotFound.tsx
 * 404 page with a simple call-to-action to go back Home.
 */

import React from "react"
import { AppShell } from "../components/layout/AppShell"
import { EmptyState } from "../components/common/EmptyState"

/**
 * NotFound
 * Minimal UX to navigate users back.
 */
export default function NotFound() {
  const goto = (path: string) => {
    const normalized = path.startsWith("/") ? path : `/${path}`
    window.location.hash = `#${normalized}`
  }
  return (
    <AppShell projectName="—">
      <div className="grid gap-4">
        <EmptyState
          title="Page not found"
          description="Halaman yang Anda cari tidak tersedia."
          imageKeyword="lost road"
          actions={
            <button
              onClick={() => goto("/")}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Go Home
            </button>
          }
        />
      </div>
    </AppShell>
  )
}
