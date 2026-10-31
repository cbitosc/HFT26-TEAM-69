import { describe, expect, it } from 'vitest'
import { assessHabitability } from './habitability.js'
import { habitableFluxBand } from './habitableZone.js'

const q = (value, status = 'measured') => ({ value, status })

function planet(overrides = {}) {
  return {
    radiusEarth: q(1),
    eqTempK: q(250),
    insolationEarth: q(1),
    star: { teff: q(5780) },
    ...overrides,
  }
}

describe('habitable zone', () => {
  it('uses the solar Kopparapu conservative flux limits', () => {
    expect(habitableFluxBand(5780)).toEqual({ innerFlux: 1.107, outerFlux: 0.356 })
  })
})

describe('habitability screening index', () => {
  it('gives a complete Earth-like screening case a score of one', () => {
    const result = assessHabitability(planet())
    expect(result.score).toBe(1)
    expect(result.coverage).toEqual({ known: 4, total: 4 })
    expect(result.tier.key).toBe('strong-match')
  })

  it('penalizes values outside their bands without claiming uninhabitability', () => {
    const result = assessHabitability(planet({ insolationEarth: q(10), eqTempK: q(1200), radiusEarth: q(10) }))
    expect(result.score).toBeLessThan(0.3)
    expect(result.tier.key).toBe('poor-match')
    expect(result.notes[0]).toContain('not a probability')
  })

  it('withholds the score when fewer than three core measurements exist', () => {
    const result = assessHabitability(planet({ radiusEarth: q(null, 'missing'), eqTempK: q(null, 'missing') }))
    expect(result.score).toBeNull()
    expect(result.tier.key).toBe('insufficient-data')
  })

  it('ignores imputed values', () => {
    const result = assessHabitability(planet({ radiusEarth: q(1, 'imputed') }))
    expect(result.factors.find((factor) => factor.key === 'radius').status).toBe('unknown')
  })
})
