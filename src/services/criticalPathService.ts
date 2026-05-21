/**
 * criticalPathService.ts
 *
 * Implements the Critical Path Method (CPM) for the WBS timeline.
 * Calculates Early Start (ES), Early Finish (EF), Late Start (LS), Late Finish (LF),
 * and Total Float to identify critical bottlenecks.
 *
 * Also includes Predictive Scheduling logic: if actual progress is behind
 * the planned S-Curve, it inflates the duration of critical tasks to forecast
 * the new project end date dynamically.
 */

import { addDays, differenceInDays, parseISO, format } from 'date-fns'
import type { TimelineTask } from '../store/timelineStore'
import type { DependencyType } from '../types/timeline'

export interface CPMNode extends TimelineTask {
    earlyStart: number // days from project start
    earlyFinish: number
    lateStart: number
    lateFinish: number
    totalFloat: number
    isCritical: boolean
    predictedDurationDays: number
    predictedEndDate: string
}

export const criticalPathService = {
    /**
     * Build the CPM network and calculate all floats
     */
    calculateCPM(tasks: TimelineTask[], projectStartDate: Date, forcePrediction: boolean = false): CPMNode[] {
        if (!tasks.length) return []

        interface Edge { neighborId: string; type: DependencyType; lag: number }
        const nodes: Record<string, CPMNode> = {}
        const adjacencyList: Record<string, Edge[]> = {}
        const reverseAdjacencyList: Record<string, string[]> = {}

        // 1. Initialize nodes & graph
        tasks.forEach(task => {
            const plannedDuration = Math.max(1, differenceInDays(parseISO(task.endDate), parseISO(task.startDate)) + 1)

            // PREDICTIVE LOGIC: Inflate duration if behind schedule and prediction is forced
            let predictedDuration = plannedDuration
            if (forcePrediction && task.progress < 100) {
                const MAX_PREDICTED_MULTIPLIER = 3
                const timePassed = differenceInDays(new Date(), parseISO(task.startDate))
                if (timePassed > 0 && task.progress > 0) {
                    const daysPerPercent = timePassed / task.progress
                    const remainingPercent = 100 - task.progress
                    const rawPrediction = timePassed + (remainingPercent * daysPerPercent)
                    // Cap at 3x planned to prevent extreme inflation from very low progress values
                    predictedDuration = Math.min(rawPrediction, plannedDuration * MAX_PREDICTED_MULTIPLIER)
                } else if (timePassed > 0 && task.progress === 0) {
                    // Completely stalled — cap at 3x planned
                    predictedDuration = Math.min(plannedDuration + timePassed, plannedDuration * MAX_PREDICTED_MULTIPLIER)
                }
            }

            nodes[task.id] = {
                ...task,
                earlyStart: 0,
                earlyFinish: 0,
                lateStart: 0,
                lateFinish: 0,
                totalFloat: 0,
                isCritical: false,
                predictedDurationDays: Math.ceil(predictedDuration),
                predictedEndDate: task.endDate // will update later
            }
            adjacencyList[task.id] = []
            reverseAdjacencyList[task.id] = []
        })

        // Build edges based on dependencies
        tasks.forEach(task => {
            task.dependencies?.forEach(dep => {
                if (nodes[dep.predecessorId]) {
                    adjacencyList[dep.predecessorId].push({
                        neighborId: task.id,
                        type: dep.type ?? 'FS',
                        lag: dep.lag ?? 0
                    }) // predecessor -> task
                    reverseAdjacencyList[task.id].push(dep.predecessorId)
                }
            })
        })

        // 2. Forward Pass (Calculate ES and EF)
        // Topological sort using Kahn's algorithm
        const inDegree: Record<string, number> = {}
        Object.keys(nodes).forEach(id => { inDegree[id] = reverseAdjacencyList[id].length })

        const queue: string[] = Object.keys(nodes).filter(id => inDegree[id] === 0)
        const sortedNodes: string[] = []

        while (queue.length > 0) {
            const currId = queue.shift()!
            sortedNodes.push(currId)

            const currNode = nodes[currId]
            currNode.earlyFinish = currNode.earlyStart + currNode.predictedDurationDays

            adjacencyList[currId].forEach(edge => {
                const neighbor = nodes[edge.neighborId]
                const lag = edge.lag ?? 0
                switch (edge.type) {
                    case 'SS':
                        // Successor can start when predecessor starts (+ lag)
                        neighbor.earlyStart = Math.max(neighbor.earlyStart, currNode.earlyStart + lag)
                        break
                    case 'FF':
                        // Successor must finish when predecessor finishes (+ lag)
                        neighbor.earlyFinish = Math.max(neighbor.earlyFinish, currNode.earlyFinish + lag)
                        // Recalculate earlyStart from the constrained earlyFinish
                        neighbor.earlyStart = Math.max(neighbor.earlyStart, neighbor.earlyFinish - neighbor.predictedDurationDays)
                        break
                    case 'SF':
                        // Successor must finish when predecessor starts (+ lag)
                        neighbor.earlyFinish = Math.max(neighbor.earlyFinish, currNode.earlyStart + lag)
                        // Recalculate earlyStart from the constrained earlyFinish
                        neighbor.earlyStart = Math.max(neighbor.earlyStart, neighbor.earlyFinish - neighbor.predictedDurationDays)
                        break
                    case 'FS':
                    default:
                        // Successor can start when predecessor finishes (+ lag)
                        neighbor.earlyStart = Math.max(neighbor.earlyStart, currNode.earlyFinish + lag)
                        break
                }
                inDegree[edge.neighborId]--
                if (inDegree[edge.neighborId] === 0) queue.push(edge.neighborId)
            })
        }

        // Project total duration based on forward pass
        let maxEF = 0
        Object.values(nodes).forEach(n => { maxEF = Math.max(maxEF, n.earlyFinish) })

        // 3. Backward Pass (Calculate LS and LF)
        // Initialize LF with maxEF for all ending nodes
        Object.values(nodes).forEach(node => {
            node.lateFinish = maxEF
            node.lateStart = maxEF - node.predictedDurationDays
        })

        for (let i = sortedNodes.length - 1; i >= 0; i--) {
            const currId = sortedNodes[i]
            const currNode = nodes[currId]

            if (adjacencyList[currId].length > 0) {
                let minLF = Infinity
                adjacencyList[currId].forEach(edge => {
                    minLF = Math.min(minLF, nodes[edge.neighborId].lateStart)
                })
                currNode.lateFinish = minLF
            }
            currNode.lateStart = currNode.lateFinish - currNode.predictedDurationDays

            // Calculate Float and Critical Path
            currNode.totalFloat = currNode.lateStart - currNode.earlyStart
            currNode.isCritical = currNode.totalFloat <= 0

            // Resolve predicted dates mapped to real calendar
            const predEnd = addDays(projectStartDate, currNode.earlyFinish - 1) // -1 because day 1 is 0 days diff
            currNode.predictedEndDate = format(predEnd, 'yyyy-MM-dd')
        }

        return Object.values(nodes)
    },

    /**
     * Get diagnostic summary of the critical path
     */
    getProjectHealth(projectId: string, tasks: TimelineTask[]): {
        cpmNodes: CPMNode[],
        criticalPathLength: number,
        predictedDelayDays: number,
        criticalBottlenecks: string[]
    } {
        if (!tasks.length) return { cpmNodes: [], criticalPathLength: 0, predictedDelayDays: 0, criticalBottlenecks: [] }

        // Needs the actual project start, finding earliest task date
        let earliestDate = new Date('2099-01-01')
        let latestDatePlanned = new Date('2000-01-01')
        tasks.forEach((t: TimelineTask) => {
            const sd = parseISO(t.startDate)
            const ed = parseISO(t.endDate)
            if (sd < earliestDate) earliestDate = sd
            if (ed > latestDatePlanned) latestDatePlanned = ed
        })

        // Predictive network
        const predictedNodes = this.calculateCPM(tasks, earliestDate, true)

        let predictedMaxEnd = new Date('2000-01-01')
        const bottlenecks: string[] = []

        predictedNodes.forEach(n => {
            const ped = parseISO(n.predictedEndDate)
            if (ped > predictedMaxEnd) predictedMaxEnd = ped

            // Bottleneck = critical node that has inflated duration vs planned
            const plannedDuration = differenceInDays(parseISO(n.endDate), parseISO(n.startDate)) + 1
            if (n.isCritical && n.predictedDurationDays > plannedDuration) {
                bottlenecks.push(n.name)
            }
        })

        const delayDays = differenceInDays(predictedMaxEnd, latestDatePlanned)

        return {
            cpmNodes: predictedNodes,
            criticalPathLength: predictedNodes.filter(n => n.isCritical).length,
            predictedDelayDays: Math.max(0, delayDays),
            criticalBottlenecks: bottlenecks
        }
    }
}
