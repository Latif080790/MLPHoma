/**
 * NotFound.tsx
 * 404 page with a simple call-to-action to go back Home.
 */

import React from "react"
import { useNavigate } from "react-router"
import { EmptyState } from "../components/common/EmptyState"

export default function NotFound() {
  const navigate = useNavigate()
  const goto = (path: string) => {
    const normalized = path.startsWith("/") ? path : `/${path}`
    navigate(normalized)
  }
  return (
    <div className="space-y-6">
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
    </div>
  )
}
