/**
 * CriticalPathGantt.tsx
 * 
 * Renders a specialized Gantt chart that focuses on the Critical Path Method (CPM).
 * Highlights tasks with zero float (Critical Path) in red.
 * Shows original planned timelines vs predicted delayed timelines if Auto-Forecast is ON.
 */

import React, { useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, GitBranch, Zap } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { useTimelineStore } from '@/store/timelineStore'
import { criticalPathService } from '@/services/criticalPathService'
import { EmptyState } from '@/components/common/EmptyState'
import { differenceInDays, parseISO, format, addDays } from 'date-fns'

export function CriticalPathGantt() {
    const { activeProjectId } = useProjectStore()
    const { getTasks } = useTimelineStore()
    const [predictiveMode, setPredictiveMode] = useState(false)

    const projectTasks = useMemo(() => activeProjectId ? getTasks(activeProjectId) : [], [getTasks, activeProjectId])

    const cpmData = useMemo(() => {
        if (!activeProjectId || projectTasks.length === 0) return null
        return criticalPathService.getProjectHealth(activeProjectId, projectTasks)
    }, [activeProjectId, projectTasks])

    const displayNodes = useMemo(() => {
        if (!activeProjectId || projectTasks.length === 0) return []
        // We find the earliest date again to base our forward pass
        let earliestDate = new Date('2099-01-01')
        projectTasks.forEach((t: { startDate: string }) => {
            const sd = parseISO(t.startDate)
            if (sd < earliestDate) earliestDate = sd
        })
        return criticalPathService.calculateCPM(projectTasks, earliestDate, predictiveMode)
    }, [activeProjectId, projectTasks, predictiveMode])

    if (!activeProjectId) return <EmptyState title="No Project Selected" description="Select a project to view the Critical Path." />
    if (projectTasks.length === 0) return <EmptyState title="No Schedule Data" description="Create WBS timeline items first." icon={<GitBranch className="h-12 w-12 text-slate-300 mb-4" />} />

    // Determine coordinate space for Gantt lines
    let minDate = new Date('2099-01-01')
    let maxDate = new Date('2000-01-01')

    displayNodes.forEach(n => {
        const sd = parseISO(n.startDate)
        const ed = parseISO(predictiveMode ? n.predictedEndDate : n.endDate)
        if (sd < minDate) minDate = sd
        if (ed > maxDate) maxDate = ed
    })

    const totalDays = Math.max(1, differenceInDays(maxDate, minDate) + 1)

    // Layout config
    const rowHeight = 40
    const headerHeight = 60

    return (
        <Card className="flex flex-col h-[600px] border-slate-200 dark:border-slate-800">
            <CardHeader className="shrink-0 flex flex-row items-center justify-between pb-4">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <GitBranch size={18} className="text-violet-600" />
                        Critical Path Method (CPM)
                    </CardTitle>
                    <CardDescription className="mt-1">
                        Identify schedule bottlenecks. Tasks with 0 float are critical.
                    </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                    {cpmData?.predictedDelayDays && cpmData.predictedDelayDays > 0 ? (
                        <Badge variant="destructive" className="gap-1 px-3 py-1">
                            <AlertTriangle size={14} />
                            Project {cpmData.predictedDelayDays} Days at Risk
                        </Badge>
                    ) : null}

                    <Button
                        variant={predictiveMode ? "default" : "outline"}
                        className={`gap-2 ${predictiveMode ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}
                        onClick={() => setPredictiveMode(!predictiveMode)}
                    >
                        <Zap size={14} className={predictiveMode ? 'text-yellow-400' : ''} />
                        Auto-Forecast Mode
                    </Button>
                </div>
            </CardHeader>

            <div className="flex-1 overflow-hidden relative border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">

                {/* Fixed left column for labels */}
                <div className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 z-10 flex flex-col shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
                    <div className="h-[60px] shrink-0 border-b border-slate-200 dark:border-slate-800 p-3 flex flex-col justify-end bg-slate-50 dark:bg-slate-900">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">WBS Task</span>
                    </div>
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-2" id="cpm-left-col">
                        {displayNodes.map((node, _idx) => (
                            <div key={node.id} className="h-[40px] flex flex-col justify-center px-2 relative group">
                                <span className={`text-sm truncate w-full ${node.isCritical ? 'font-bold text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {node.name}
                                </span>
                                <div className="flex justify-between items-center w-full mt-0.5 opacity-60">
                                    <span className="text-xs text-slate-500">Float: {node.totalFloat}d</span>
                                    <span className="text-xs text-slate-500">{node.progress}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right side for Gantt Chart */}
                <div className="absolute left-64 right-0 top-0 bottom-0 overflow-auto" onScroll={(e) => {
                    const leftCol = document.getElementById('cpm-left-col')
                    if (leftCol) leftCol.scrollTop = e.currentTarget.scrollTop
                }}>
                    <div className="min-w-max p-4 pt-0">
                        <svg
                            width={Math.max(800, totalDays * 20)}
                            height={headerHeight + (displayNodes.length * rowHeight)}
                            className="bg-transparent"
                        >
                            {/* Time Axis Header */}
                            <g className="time-axis" transform={`translate(0, ${headerHeight - 20})`}>
                                <line x1="0" y1="0" x2="100%" y2="0" stroke="currentColor" strokeWidth="1" className="text-slate-200 dark:text-slate-800" />
                                {/* Generate monthly marks (simplified for mockup, ideally day/week marks based on scale) */}
                                {Array.from({ length: Math.ceil(totalDays / 7) }).map((_, i) => {
                                    const x = i * 7 * 20 // 7 days * 20px per day
                                    const date = addDays(minDate, i * 7)
                                    return (
                                        <g key={i} transform={`translate(${x}, 0)`}>
                                            <line x1="0" y1="-5" x2="0" y2="5" stroke="currentColor" className="text-slate-300 dark:text-slate-700" />
                                            <text x="5" y="-10" fontSize="10" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                                                {format(date, 'MMM dd')}
                                            </text>
                                            {/* Vertical grid line */}
                                            <line x1="0" y1="0" x2="0" y2={displayNodes.length * rowHeight + 20} stroke="currentColor" strokeDasharray="4 4" className="text-slate-100 dark:text-slate-800/50" />
                                        </g>
                                    )
                                })}
                            </g>

                            {/* Gantt Bars and Dependencies */}
                            <g transform={`translate(0, ${headerHeight})`}>

                                {/* 1. Render Dependency Lines First (so they are under bars) */}
                                {displayNodes.map((node, i) => {
                                    const startX = differenceInDays(parseISO(node.startDate), minDate) * 20
                                    const _endX = startX + (predictiveMode ? node.predictedDurationDays : Math.max(1, differenceInDays(parseISO(node.endDate), parseISO(node.startDate)) + 1)) * 20
                                    const y = i * rowHeight + (rowHeight / 2)

                                    return node.dependencies?.map(dep => {
                                        const depId = dep.predecessorId
                                        const depIndex = displayNodes.findIndex(n => n.id === depId)
                                        if (depIndex === -1) return null

                                        const depNode = displayNodes[depIndex]
                                        const depStartX = differenceInDays(parseISO(depNode.startDate), minDate) * 20
                                        const depEndX = depStartX + (predictiveMode ? depNode.predictedDurationDays : Math.max(1, differenceInDays(parseISO(depNode.endDate), parseISO(depNode.startDate)) + 1)) * 20
                                        const depY = depIndex * rowHeight + (rowHeight / 2)

                                        // Only color routing red if BOTH are critical
                                        const isCriticalPath = node.isCritical && depNode.isCritical

                                        // Draw elbow arrow
                                        const path = `M ${depEndX} ${depY} L ${depEndX + 10} ${depY} L ${depEndX + 10} ${y} L ${startX} ${y}`
                                        return (
                                            <path
                                                key={`${depId}-${node.id}`}
                                                d={path}
                                                fill="none"
                                                stroke={isCriticalPath ? '#ef4444' : 'currentColor'}
                                                strokeWidth={isCriticalPath ? 2 : 1.5}
                                                className={isCriticalPath ? 'opacity-90' : 'text-slate-300 dark:text-slate-700'}
                                                markerEnd={isCriticalPath ? 'url(#arrowhead-red)' : 'url(#arrowhead-gray)'}
                                            />
                                        )
                                    })
                                })}

                                {/* 2. Render Task Bars */}
                                {displayNodes.map((node, i) => {
                                    const plannedDuration = Math.max(1, differenceInDays(parseISO(node.endDate), parseISO(node.startDate)) + 1)
                                    const duration = predictiveMode ? node.predictedDurationDays : plannedDuration

                                    const startX = Math.max(0, differenceInDays(parseISO(node.startDate), minDate)) * 20
                                    const width = Math.max(4, duration * 20)
                                    const y = (i * rowHeight) + (rowHeight / 2) - 8 // center 16px bar

                                    const isDelaying = predictiveMode && duration > plannedDuration

                                    return (
                                        <g key={node.id} transform={`translate(${startX}, ${y})`}>
                                            {/* Float shadow box if not critical */}
                                            {!node.isCritical && node.totalFloat > 0 && (
                                                <rect
                                                    x="0"
                                                    y="0"
                                                    width={(duration + node.totalFloat) * 20}
                                                    height="16"
                                                    rx="4"
                                                    fill="currentColor"
                                                    className="text-slate-200 dark:text-slate-800/60"
                                                    strokeDasharray="2 2"
                                                    stroke="currentColor"
                                                />
                                            )}

                                            {/* Main Bar */}
                                            <rect
                                                x="0"
                                                y="0"
                                                width={width}
                                                height="16"
                                                rx="4"
                                                fill="currentColor"
                                                className={
                                                    node.isCritical
                                                        ? 'text-red-500' // Red for Critical path
                                                        : 'text-violet-500' // Violet for normal
                                                }
                                            />

                                            {/* Progress Fill */}
                                            {node.progress > 0 && (
                                                <rect
                                                    x="0"
                                                    y="0"
                                                    width={width * (node.progress / 100)}
                                                    height="16"
                                                    rx="4"
                                                    fill="currentColor"
                                                    className={node.isCritical ? 'text-red-700 dark:text-red-900' : 'text-violet-700 dark:text-violet-900'}
                                                />
                                            )}

                                            {/* Hover labels */}
                                            <text x={width + 8} y="11" fontSize="10" fill="currentColor" className="text-slate-600 dark:text-slate-400 font-mono">
                                                {isDelaying ? `${plannedDuration}d → ${duration}d (Delay)` : `${duration}d`}
                                            </text>
                                        </g>
                                    )
                                })}
                            </g>

                            {/* SVG Defs for markers */}
                            <defs>
                                <marker id="arrowhead-gray" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                    <polygon points="0 0, 6 2, 0 4" fill="currentColor" className="text-slate-300 dark:text-slate-700" />
                                </marker>
                                <marker id="arrowhead-red" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                    <polygon points="0 0, 6 2, 0 4" fill="#ef4444" />
                                </marker>
                            </defs>
                        </svg>
                    </div>
                </div>
            </div>

            {/* Bottom Legend */}
            <div className="shrink-0 h-10 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center px-4 gap-6 text-xs uppercase font-semibold text-slate-500">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-red-500"></div> Critical Path (0 Float)
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-violet-500"></div> Standard Task (Has Float)
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm border border-dashed border-slate-300 bg-slate-200"></div> Available Total Float
                </div>
            </div>
        </Card>
    )
}
