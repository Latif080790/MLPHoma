/**
 * CPMReportView.tsx
 *
 * Visual summary used for CPM PDF export:
 * - Shows KPI (project duration, critical count)
 * - Bar chart of Total Float (TF) per task (lower TF indicates critical)
 * - Table with ES/EF/LS/LF/TF, duration and critical flag
 *
 * This component is designed to be rendered offscreen for PDF capture (html2canvas).
 */

import React from 'react'
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts'

/**
 * CPMRow
 * Represents a single row/metric for a task used by the report view.
 */
export interface CPMRow {
  id: string
  name: string
  startDate: string
  endDate: string
  durationDays: number
  ES: number
  EF: number
  LS: number
  LF: number
  TF: number
  critical: 'yes' | 'no'
}

/**
 * Props for CPMReportView
 */
export interface CPMReportViewProps {
  projectId: string
  projectName?: string
  projectDuration?: number
  rows: CPMRow[]
}

/**
 * fmt
 * Small numeric formatter for integers
 */
function fmt(n: number) {
  return String(Math.round(n))
}

/**
 * CPMReportView component
 * Renders a printable visual summary for CPM metrics.
 */
export default function CPMReportView({ projectId, projectName, projectDuration = 0, rows = [] }: CPMReportViewProps) {
  const chartData = rows
    .slice()
    .sort((a, b) => a.TF - b.TF || a.name.localeCompare(b.name))
    .map((r) => ({ name: r.name.length > 22 ? r.name.slice(0, 22) + '…' : r.name, TF: r.TF }))

  const criticalCount = rows.filter((r) => r.critical === 'yes').length
  const minTF = rows.length ? Math.min(...rows.map((r) => r.TF)) : 0

  return (
    <div style={{ width: 1000, padding: 20, fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial', background: '#fff', color: '#111827' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{projectName || projectId}</h1>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>CPM Analysis — generated {new Date().toLocaleString()}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Project Duration</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{projectDuration} days</div>
          <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>Critical tasks</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>{criticalCount}</div>
        </div>
      </header>

      <section style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minHeight: 240, border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Total Float (TF) per task</div>
          <div style={{ height: 200 }}>
            {chartData.length === 0 ? (
              <div style={{ fontSize: 12, color: '#6b7280' }}>No data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="TF" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={{ width: 360, border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ padding: 10, border: '1px solid #f3f4f6', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Tasks</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{rows.length}</div>
            </div>
            <div style={{ padding: 10, border: '1px solid #f3f4f6', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Critical</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>{criticalCount}</div>
            </div>
            <div style={{ padding: 10, border: '1px solid #f3f4f6', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Project duration</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{projectDuration}d</div>
            </div>
            <div style={{ padding: 10, border: '1px solid #f3f4f6', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Min TF</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{minTF}</div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 6 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Detailed CPM Metrics</div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Task</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>Dur (d)</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>ES</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>EF</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>LS</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>LF</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>TF</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>Critical</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ background: r.critical === 'yes' ? '#fff7f6' : 'transparent' }}>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.name}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{fmt(r.durationDays)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{fmt(r.ES)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{fmt(r.EF)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{fmt(r.LS)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{fmt(r.LF)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'center', color: r.TF === 0 ? '#ef4444' : undefined }}>
                    {fmt(r.TF)}
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{r.critical === 'yes' ? '✓' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}