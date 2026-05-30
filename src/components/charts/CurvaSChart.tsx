/**
 * CurvaSChart.tsx
 * Komponen chart Curva-S interaktif: planned vs actual progress/cost.
 * Perbaikan: hilangkan early-return sebelum hook, agar jumlah hooks konsisten di setiap render.
 * - Semua useMemo dipanggil tanpa kondisi, lalu kondisi "no data" ditangani di JSX.
 */

import React, { useMemo } from 'react'
import {
  Area,
  Line,
  ComposedChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Alert, AlertDescription } from '../ui/alert'
import {
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Calendar,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { CurvaSDataPoint, CurvaSAnalysis } from '../../types/curvaS'
import { cn } from '../../lib/utils'

/** Props untuk CurvaSChart component */
export interface CurvaSChartProps {
  /** Titik data S-Curve */
  data: CurvaSDataPoint[]
  /** Hasil analisis proyek */
  analysis: CurvaSAnalysis | null
  /** Pengaturan tampilan */
  showPlanned?: boolean
  showActual?: boolean
  showForecast?: boolean
  showShadow?: boolean
  /** Shadow curve data (CCO-adjusted) */
  shadowData?: { date: string; shadowProgress: number; shadowCost: number }[]
  /** Ukuran chart */
  height?: number
  /** Jenis chart */
  type?: 'progress' | 'cost' | 'both'
  /** Tema warna */
  theme?: 'default' | 'dark'
  /** Opsi padat untuk sumbu X (untuk data sangat panjang) */
  denseMode?: boolean
}

/**
 * Tooltip kustom untuk S-Curve chart
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const CustomTooltip = ({ active, payload, label, type }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-card p-3 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
        <p className="mb-2 font-medium">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {Number(entry.value).toLocaleString('id-ID')}
            {type === 'progress' ? '%' : ''}
            {type === 'cost' && ' Rp'}
          </p>
        ))}
      </div>
    )
  }
  return null
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Komponen indikator performa (SPI/CPI dll)
 */
const PerformanceIndicator = ({
  label,
  value,
  threshold,
  icon: Icon,
  format = 'number',
}: {
  label: string
  value: number
  threshold: number
  icon: React.ElementType
  format?: 'number' | 'percentage'
}) => {
  const isGood = value >= threshold
  const displayValue = format === 'percentage' ? `${((value ?? 0) * 100).toFixed(1)}%` : (value ?? 0).toFixed(2)

  return (
    <div className="flex items-center space-x-2 rounded-lg border p-3 dark:border-neutral-800">
      <Icon className={cn('h-5 w-5', isGood ? 'text-green-600' : 'text-red-600')} />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className={cn('text-lg font-bold', isGood ? 'text-green-600' : 'text-red-600')}>
          {displayValue}
        </p>
      </div>
    </div>
  )
}

/**
 * Helper to check if a date is valid
 */
const isValidDate = (d: unknown) => {
  const date = new Date(d as string)
  return date instanceof Date && !isNaN(date.getTime())
}

/**
 * Komponen utama CurvaSChart
 * Catatan penting:
 * - Tidak ada early-return sebelum semua hooks (useMemo) agar jumlah hooks konsisten antar render.
 */
export function CurvaSChart({
  data,
  analysis,
  showPlanned = true,
  showActual = true,
  showForecast = true,
  showShadow = false,
  shadowData,
  height = 400,
  type = 'progress',
  theme = 'default',
  denseMode = false,
}: CurvaSChartProps) {
  // Proses data untuk chart
  const chartData = useMemo(() => {
    return data.map((point) => {
      const dateObj = new Date(point.date)
      const formattedDate = isValidDate(dateObj)
        ? dateObj.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
        : 'Invalid Date'

      return {
        date: formattedDate,
        fullDate: point.date,
        planned: type === 'progress' ? point.plannedProgress : point.plannedCost,
        actual: type === 'progress' ? point.actualProgress : point.actualCost,
        plannedVolume: point.plannedVolume || 0,
        actualVolume: point.actualVolume || 0,
      }
    })
  }, [data, type])

  // Hitung forecast data (berbasis last actual date)
  const forecastData = useMemo(() => {
    if (!showForecast || !analysis || !data.length) return []

    const lastDataPoint = data[data.length - 1]
    const remainingProgress = 100 - (lastDataPoint?.actualProgress || 0)
    const remainingCost = (analysis.forecastTotalCost || 0) - (lastDataPoint?.actualCost || 0)

    if (remainingProgress <= 0 && type === 'progress') return []

    const forecastEnd = analysis.forecastCompletionDate
      ? new Date(analysis.forecastCompletionDate)
      : null
    const baseDate = new Date(lastDataPoint.date)
    let daysToComplete = 30
    if (forecastEnd) {
      const diff = Math.ceil((forecastEnd.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24))
      daysToComplete = Math.max(14, diff)
    }

    const points = []
    for (let i = 1; i <= 4; i++) {
      const futureDate = new Date(baseDate)
      futureDate.setDate(futureDate.getDate() + Math.round((daysToComplete / 4) * i))

      const formatted = isValidDate(futureDate)
        ? futureDate.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
        : 'Invalid Date'

      points.push({
        date: formatted,
        fullDate: isValidDate(futureDate) ? futureDate.toISOString().split('T')[0] : '',
        forecast:
          type === 'progress'
            ? Math.min(100, (lastDataPoint?.actualProgress || 0) + (remainingProgress * i) / 4)
            : (lastDataPoint?.actualCost || 0) + (remainingCost * i) / 4,
      })
    }

    return points
  }, [showForecast, analysis, data, type])

  // Gabungkan actual dan forecast
  const combinedData = useMemo(() => {
    const actual = chartData.map((item, idx) => {
      const shadow = shadowData && shadowData[idx]
      return {
        ...item,
        forecast: undefined,
        shadow: shadow ? (type === 'progress' ? shadow.shadowProgress : shadow.shadowCost) : undefined,
      }
    })
    const forecast = forecastData.map((item) => ({ ...item, planned: undefined, actual: undefined, shadow: undefined }))
    return [...actual, ...forecast]
  }, [chartData, forecastData, shadowData, type])

  // Warna chart berdasarkan tema
  const colors = {
    planned: theme === 'dark' ? '#56B4E9' : '#0072B2',   // Okabe-Ito sky/cobalt
    actual: theme === 'dark' ? '#00C896' : '#009E73',     // Okabe-Ito teal
    forecast: theme === 'dark' ? '#F0C040' : '#E69F00',   // Okabe-Ito amber
    shadow: theme === 'dark' ? '#E8A0CC' : '#CC79A7',     // Okabe-Ito pink
  }

  // Status → warna/ikon
  const getStatusColor = (status: CurvaSAnalysis['status']) => {
    switch (status) {
      case 'on-track':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'ahead-schedule':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'behind-schedule':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      case 'over-budget':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      case 'under-budget':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  const getStatusIcon = (status: CurvaSAnalysis['status']) => {
    switch (status) {
      case 'on-track':
        return <Target className="h-4 w-4" />
      case 'ahead-schedule':
        return <TrendingUp className="h-4 w-4" />
      case 'behind-schedule':
        return <TrendingDown className="h-4 w-4" />
      case 'over-budget':
        return <AlertTriangle className="h-4 w-4" />
      case 'under-budget':
        return <DollarSign className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  // Penentuan kepadatan label sumbu X
  const manyPoints = combinedData.length > 24
  const veryManyPoints = combinedData.length > 48
  const effectiveDense = denseMode || veryManyPoints

  // Sampling ticks jika dense agar tidak menumpuk (target ~8-10 ticks)
  const sampledTicks = useMemo(() => {
    if (!effectiveDense) return undefined as string[] | undefined
    const len = combinedData.length
    if (len <= 2) return undefined
    const step = Math.max(1, Math.ceil(len / 8))
    const arr: string[] = []
    for (let i = 0; i < len; i += step) {
      arr.push(combinedData[i].date as string)
    }
    const last = combinedData[len - 1].date as string
    if (arr[arr.length - 1] !== last) arr.push(last)
    return arr
  }, [combinedData, effectiveDense])

  const xTickInterval: number | 'preserveStartEnd' = effectiveDense
    ? 0 // gunakan sampledTicks, tampilkan hanya yang ada
    : manyPoints
      ? 'preserveStartEnd'
      : 0

  const xTick = {
    fontSize: effectiveDense ? 10 : 12,
  }

  const xAngle = effectiveDense ? -65 : -45
  const xHeight = effectiveDense ? 95 : 80

  const isEmpty = !data.length

  return (
    <div className="space-y-6">
      {/* Performance Overview */}
      {analysis && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <PerformanceIndicator label="SPI (Schedule)" value={analysis.metrics.spi} threshold={0.95} icon={Calendar} />
          <PerformanceIndicator label="CPI (Cost)" value={analysis.metrics.cpi} threshold={0.95} icon={DollarSign} />
          <div className="flex items-center space-x-2 rounded-lg border p-3 dark:border-neutral-800">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium">Progress</p>
              <p className="text-lg font-bold text-blue-600">{(analysis.currentProgress ?? 0).toFixed(1)}%</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 rounded-lg border p-3 dark:border-neutral-800">
            {getStatusIcon(analysis.status)}
            <div>
              <p className="text-sm font-medium">Status</p>
              <Badge className={getStatusColor(analysis.status)}>{analysis.status.replace('-', ' ').toUpperCase()}</Badge>
            </div>
          </div>
        </div>
      )}

      {/* Chart or Empty */}
      {isEmpty ? (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No S-Curve Data Available</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Generate baseline from RAB data or input actual progress.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>S-Curve {type === 'progress' ? 'Progress' : 'Cost'} Analysis</CardTitle>
              <div className="flex space-x-2">
                <Badge variant={showPlanned ? 'default' : 'outline'}>Planned</Badge>
                <Badge variant={showActual ? 'default' : 'outline'}>Actual</Badge>
                {showForecast && <Badge variant={showForecast ? 'default' : 'outline'}>Forecast</Badge>}
                {showShadow && <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Shadow (CCO)</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={height}>
              <ComposedChart data={combinedData}>
                <defs>
                  <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.planned} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={colors.planned} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="date"
                  tick={xTick}
                  angle={xAngle}
                  textAnchor="end"
                  height={xHeight}
                  interval={xTickInterval}
                  ticks={sampledTicks}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  domain={[0, type === 'progress' ? 100 : 'dataMax']}
                  tickFormatter={(value: number) => (type === 'progress' ? `${value}%` : value.toLocaleString('id-ID'))}
                />
                <Tooltip content={<CustomTooltip type={type} />} />
                <Legend />

                {showPlanned && (
                  <Area
                    type="monotone"
                    dataKey="planned"
                    stroke={colors.planned}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPlanned)"
                    name="Planned"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}

                {showActual && (
                  <Line type="monotone" dataKey="actual" stroke={colors.actual} strokeWidth={2} name="Actual" dot={{ r: 3 }} />
                )}

                {showForecast && (
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke={colors.forecast}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Forecast"
                    dot={false}
                  />
                )}

                {showShadow && shadowData && shadowData.length > 0 && (
                  <Line
                    type="monotone"
                    dataKey="shadow"
                    stroke={colors.shadow}
                    strokeWidth={2}
                    strokeDasharray="8 4"
                    name="Shadow (CCO)"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}

                {/* Reference lines */}
                {type === 'progress' && (
                  <>
                    <ReferenceLine y={25} stroke="#e5e7eb" strokeDasharray="3 3" />
                    <ReferenceLine y={50} stroke="#e5e7eb" strokeDasharray="3 3" />
                    <ReferenceLine y={75} stroke="#e5e7eb" strokeDasharray="3 3" />
                    <ReferenceLine y={100} stroke="#374151" strokeWidth={2} />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {analysis?.insights && analysis.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Key Insights &amp; Recommendations</CardTitle>
          </CardHeader>
        </Card>
      )}

      {/* Forecast Info */}
      {analysis?.forecastTotalCost && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Calendar className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Forecast Completion</p>
                  <p className="text-lg font-bold">
                    {analysis.forecastCompletionDate
                      ? new Date(analysis.forecastCompletionDate).toLocaleDateString('id-ID')
                      : 'Not calculated'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Forecast Total Cost</p>
                  <p className="text-lg font-bold">{Number(analysis.forecastTotalCost).toLocaleString('id-ID')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Insights list (render terpisah agar tetap tampil rapi) */}
      {analysis?.insights && analysis.insights.length > 0 && (
        <Card>
          <CardContent>
            <div className="space-y-3">
              {analysis.insights.map((insight, index) => (
                <Alert key={index}>
                  <Info className="h-4 w-4" />
                  <AlertDescription>{insight}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default CurvaSChart
