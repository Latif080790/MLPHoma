/**
 * AuthLayout.tsx
 *
 * Shared 2-column layout for all auth pages.
 * Left: brand panel (hidden on mobile), Right: form panel.
 * Design system: NATA LABA navy dark, DM Sans, orange accent.
 */

import React from 'react'

interface AuthLayoutProps {
  children: React.ReactNode
}

// Hexagon SVG logo mark
function HexLogo() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#F97316]/40 bg-[rgba(249,115,22,0.12)]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#F97316"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <polygon points="12,2 22,7 22,17 12,22 2,17 2,7" />
      </svg>
    </div>
  )
}

// Small hex logo for form panel header
function HexLogoSm() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#F97316]/40 bg-[rgba(249,115,22,0.12)]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#F97316"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <polygon points="12,2 22,7 22,17 12,22 2,17 2,7" />
      </svg>
    </div>
  )
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen w-full">
      {/* ── LEFT: Brand Panel (desktop only) ─────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[40%] flex-col relative overflow-hidden"
        style={{ backgroundColor: '#0E1525', borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Geometric grid overlay */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="auth-grid"
              width="48"
              height="48"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 48 0 L 0 0 0 48"
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
              />
            </pattern>
            {/* Diagonal accent lines */}
            <pattern
              id="auth-diag"
              width="96"
              height="96"
              patternUnits="userSpaceOnUse"
            >
              <line
                x1="0"
                y1="96"
                x2="96"
                y2="0"
                stroke="rgba(249,115,22,0.04)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-grid)" />
          <rect width="100%" height="100%" fill="url(#auth-diag)" />
        </svg>

        {/* Orange glow blob — top-right of brand panel */}
        <div
          className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #F97316 0%, transparent 70%)' }}
        />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col p-10">
          {/* Logo + wordmark */}
          <div className="flex items-center gap-3">
            <HexLogo />
            <div>
              <div className="font-display text-lg font-extrabold tracking-tight text-white">
                NATA LABA
              </div>
              <div className="font-mono text-xs tracking-widest text-white/40 uppercase">
                Enterprise Construction Suite Indonesia
              </div>
            </div>
          </div>

          {/* Center copy */}
          <div className="mt-auto mb-auto pt-20">
            <h2 className="font-display text-3xl font-bold leading-tight text-white">
              Command Center
              <br />
              <span style={{ color: '#F97316' }}>Proyek Konstruksi</span>
              <br />
              Indonesia
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/50 max-w-xs">
              Kelola RAB, jadwal, rantai pasok, dan keuangan proyek dalam satu platform terintegrasi.
            </p>

            {/* Feature chips */}
            <div className="mt-8 flex flex-wrap gap-2">
              {['RAB & Estimasi', 'CPM Scheduling', 'Supply Chain', 'Finance EVM'].map((f) => (
                <span
                  key={f}
                  className="rounded-md border px-2.5 py-1 font-mono text-xs tracking-wide"
                  style={{
                    borderColor: 'rgba(249,115,22,0.25)',
                    color: 'rgba(249,115,22,0.7)',
                    backgroundColor: 'rgba(249,115,22,0.06)',
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Version badge — bottom left */}
          <div className="mt-auto">
            <span
              className="font-mono text-xs tracking-widest"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            >
              MLPHoma v2.0 · NATA LABA
            </span>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Form Panel ─────────────────────────────────────────────── */}
      <div
        className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-16"
        style={{ backgroundColor: '#070C18' }}
      >
        {/* Small logo — mobile only context, desktop shows inside form card */}
        <div className="mb-8 flex flex-col items-center gap-2 lg:hidden">
          <HexLogoSm />
          <span className="font-display text-sm font-bold tracking-tight text-white">NATA LABA</span>
        </div>

        {/* Form content slot */}
        <div className="w-full max-w-sm">
          {/* Logo kecil di atas form — desktop only (brand panel sudah ada di kiri) */}
          <div className="hidden lg:flex items-center gap-2.5 mb-6">
            <HexLogoSm />
            <span className="font-display text-sm font-bold tracking-tight text-white">NATA LABA</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
