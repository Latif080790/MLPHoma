import { describe, expect, it } from 'vitest'
import {
  getDomainErrorMessage,
  getErrorCategory,
  getErrorDomain,
} from '../errorMessages'

describe('errorMessages domain taxonomy', () => {
  it('parses lowercase notfound category correctly', () => {
    expect(getErrorCategory('notfound.resource')).toBe('notfound')
  })

  it('maps domain from code prefix with core fallback', () => {
    expect(getErrorDomain('finance.payment_blocked')).toBe('finance')
    expect(getErrorDomain('validation.required')).toBe('core')
    expect(getErrorDomain('random.anything')).toBe('core')
  })

  it('returns domain fallback message when code not provided', () => {
    const finance = getDomainErrorMessage('finance')
    const timeline = getDomainErrorMessage('timeline')

    expect(finance.title).toBe('Gangguan Modul Keuangan')
    expect(timeline.title).toBe('Gangguan Modul Timeline')
  })

  it('returns explicit code message when available', () => {
    const msg = getDomainErrorMessage('timeline', 'timeline.evidence_required')
    expect(msg.severity).toBe('warning')
    expect(msg.message).toContain('membutuhkan bukti lengkap')
  })
})
