import type { IBPREntry, IncidentType, IncidentSeverity, InspectionType, HazardType } from '@/types/qhse'
import { qhseService } from '@/services/qhseService'

// ── Constants ─────────────────────────────────────────────────────────────────

export const INCIDENT_TYPE_LABEL: Record<string, string> = {
    NEAR_MISS: 'Near Miss',
    FIRST_AID: 'First Aid',
    MEDICAL_TREATMENT: 'Medical Treatment',
    LOST_TIME: 'Lost Time Injury',
    FATALITY: 'Fatality',
    PROPERTY_DAMAGE: 'Property Damage',
    ENVIRONMENTAL: 'Environmental',
}

export const SEVERITY_COLORS: Record<string, string> = {
    LOW: 'bg-green-500/10 text-green-400 border border-green-500/20',
    MEDIUM: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    HIGH: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    CRITICAL: 'bg-red-500/10 text-red-400 border border-red-500/20',
}

// Enhanced severity badge config with animated dot for critical
export const SEVERITY_BADGE_CONFIG: Record<string, { cls: string; dot: string }> = {
    CRITICAL: { cls: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'animate-pulse bg-rose-500' },
    HIGH: { cls: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    MEDIUM: { cls: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
    LOW: { cls: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
}

export const INCIDENT_TYPE_COLORS: Record<string, string> = {
    NEAR_MISS: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    FIRST_AID: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    MEDICAL_TREATMENT: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    LOST_TIME: 'bg-red-500/10 text-red-400 border border-red-500/20',
    FATALITY: 'bg-red-500/10 text-red-400 border border-red-500/20',
    PROPERTY_DAMAGE: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    ENVIRONMENTAL: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
}

export const RISK_LEVEL_COLORS: Record<string, string> = {
    LOW: 'bg-green-500/10 text-green-400 border border-green-500/20',
    MEDIUM: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    HIGH: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    CRITICAL: 'bg-red-500/10 text-red-400 border border-red-500/20',
}

export const RISK_LEVEL_TEXT: Record<string, string> = {
    LOW: 'text-green-400',
    MEDIUM: 'text-amber-400',
    HIGH: 'text-orange-400',
    CRITICAL: 'text-red-400',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function today(): string {
    return new Date().toISOString().split('T')[0]
}

export function generateInspectionNumber(): string {
    const d = new Date()
    const yy = d.getFullYear().toString().slice(-2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const seq = d.getTime().toString().slice(-4)
    return `INS-${yy}${mm}-${seq}`
}

export function computeRiskLevel(score: number): IBPREntry['risk_level'] {
    if (score <= 4) return 'LOW'
    if (score <= 9) return 'MEDIUM'
    if (score <= 16) return 'HIGH'
    return 'CRITICAL'
}

// ── Form state interfaces ─────────────────────────────────────────────────────

export interface IncidentFormState {
    title: string
    incident_number: string
    type: IncidentType
    severity: IncidentSeverity
    incident_date: string
    location: string
    reported_by: string
    description: string
    lost_time_days: string
}

export interface InspectionFormState {
    title: string
    inspection_number: string
    type: InspectionType
    scheduled_date: string
    inspector: string
    area: string
}

export interface HazardFormState {
    activity: string
    hazard: string
    hazard_type: HazardType
    potential_risk: string
    likelihood: number
    severity: number
    control_measures: string
    responsible_person: string
}

// ── Default factory functions ─────────────────────────────────────────────────

export function defaultIncidentForm(): IncidentFormState {
    return {
        title: '',
        incident_number: qhseService.generateIncidentNumber(),
        type: 'NEAR_MISS',
        severity: 'LOW',
        incident_date: today(),
        location: '',
        reported_by: '',
        description: '',
        lost_time_days: '',
    }
}

export function defaultInspectionForm(): InspectionFormState {
    return {
        title: '',
        inspection_number: generateInspectionNumber(),
        type: 'ROUTINE',
        scheduled_date: today(),
        inspector: '',
        area: '',
    }
}

export function defaultHazardForm(): HazardFormState {
    return {
        activity: '',
        hazard: '',
        hazard_type: 'PHYSICAL',
        potential_risk: '',
        likelihood: 1,
        severity: 1,
        control_measures: '',
        responsible_person: '',
    }
}
