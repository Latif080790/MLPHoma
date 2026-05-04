/**
 * MiniSparkline — P1.1.1
 *
 * A minimal inline SVG polyline chart for trend / breakdown visualisation.
 * Zero dependencies. Pass `data` as an array of 0-100 values.
 */

interface MiniSparklineProps {
    /** Values between 0 and 100 */
    data: number[]
    /** Width in pixels (default 80) */
    width?: number
    /** Height in pixels (default 24) */
    height?: number
    /** Stroke color (default teal) */
    color?: string
    /** Fill the area under the line */
    fill?: boolean
    /** Show a trailing dot at the last data point */
    dot?: boolean
    className?: string
}

export function MiniSparkline({
    data,
    width = 80,
    height = 24,
    color = '#14b8a6',
    fill = true,
    dot = true,
    className = '',
}: MiniSparklineProps) {
    if (!data || data.length < 2) return null

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    // Map data → SVG coordinate space (0,0 top-left)
    const xStep = width / (data.length - 1)
    const pts = data.map((v, i) => {
        const x = i * xStep
        const y = height - ((v - min) / range) * (height - 4) - 2
        return { x, y }
    })

    const polyline = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const lastPt = pts[pts.length - 1]

    // Closed polygon for fill
    const polygon = [
        `${pts[0].x.toFixed(1)},${height}`,
        polyline,
        `${lastPt.x.toFixed(1)},${height}`,
    ].join(' ')

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className={className}
            aria-hidden="true"
        >
            {fill && (
                <polygon
                    points={polygon}
                    fill={color}
                    fillOpacity="0.12"
                    stroke="none"
                />
            )}
            <polyline
                points={polyline}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            {dot && (
                <circle
                    cx={lastPt.x.toFixed(1)}
                    cy={lastPt.y.toFixed(1)}
                    r="2.5"
                    fill={color}
                />
            )}
        </svg>
    )
}
