import { isScientific } from '../contracts/planet.js'
import { habitableFluxBand } from './habitableZone.js'

const NOTES = [
  'This is a screening index, not a probability of habitability or life.',
  'Habitable-zone placement is not evidence of habitability or life.',
  'Atmospheric composition is unknown because it is not included in this catalog.',
]

const factorValue = (value, [low, high]) => {
  if (value >= low && value <= high) return 1
  return value < low ? value / low : high / value
}

const quantityInput = (label, quantity, unit) => ({ label, quantity, unit })
const known = (quantity) => isScientific(quantity) && Number.isFinite(quantity.value)

function fluxFactor(planet) {
  const flux = planet.insolationEarth
  const teff = planet.star?.teff
  const band = known(teff) ? habitableFluxBand(teff.value) : null
  if (!known(flux) || !band) {
    return {
      value: null,
      status: 'unknown',
      inputs: [quantityInput('Stellar flux', flux, 'S⊕'), quantityInput('Host effective temperature', teff, 'K')],
      explanation: 'Requires measured insolation and a host-star temperature within the HZ model range.',
    }
  }
  const value = factorValue(flux.value, [band.outerFlux, band.innerFlux])
  return {
    value,
    status: value === 1 ? 'favorable' : 'uncertain',
    inputs: [quantityInput('Stellar flux', flux, 'S⊕'), quantityInput('Host effective temperature', teff, 'K')],
    explanation:
      value === 1
        ? 'Measured insolation is inside the conservative runaway-greenhouse to maximum-greenhouse band.'
        : 'Measured insolation is outside the conservative habitable-zone flux band.',
  }
}

function boundedFactor(key, label, quantity, unit, range, explanation) {
  if (!known(quantity)) {
    return {
      key,
      value: null,
      status: 'unknown',
      inputs: [quantityInput(label, quantity, unit)],
      explanation: `Requires a measured ${label.toLowerCase()}.`,
    }
  }
  const value = factorValue(quantity.value, range)
  return {
    key,
    value,
    status: value === 1 ? 'favorable' : 'uncertain',
    inputs: [quantityInput(label, quantity, unit)],
    explanation: value === 1 ? explanation : `Outside the ${range[0]}–${range[1]} ${unit} screening band.`,
  }
}

/**
 * Calculate a geometric-mean screening index from available scientific values.
 * A score is withheld when fewer than three of the four core factors exist.
 * @param {import('../contracts/planet.js').Planet} planet
 */
export function assessHabitability(planet) {
  const factors = [
    { key: 'flux', label: 'Stellar flux / HZ', ...fluxFactor(planet) },
    boundedFactor(
      'radius',
      'Planet radius',
      planet.radiusEarth,
      'R⊕',
      [0.5, 1.6],
      'Radius is within the rocky-world screening range; composition is not established.',
    ),
    boundedFactor(
      'eqTemp',
      'Equilibrium temperature',
      planet.eqTempK,
      'K',
      [200, 320],
      'Equilibrium temperature is in a temperate screening range; it is not surface temperature.',
    ),
    boundedFactor(
      'star',
      'Host effective temperature',
      planet.star?.teff,
      'K',
      [3500, 6500],
      'Host temperature is within the team’s broad main-sequence screening range.',
    ),
  ]
  const usable = factors.filter((factor) => factor.value != null)
  const score = usable.length >= 3 ? usable.reduce((product, factor) => product * factor.value, 1) ** (1 / usable.length) : null
  const tier =
    score == null
      ? { key: 'insufficient-data', label: 'Insufficient measured data' }
      : score >= 0.8
        ? { key: 'strong-match', label: 'Strong screening match' }
        : score >= 0.6
          ? { key: 'partial-match', label: 'Partial screening match' }
          : score >= 0.3
            ? { key: 'weak-match', label: 'Weak screening match' }
            : { key: 'poor-match', label: 'Poor screening match' }

  return {
    score,
    tier,
    coverage: { known: usable.length, total: factors.length },
    factors,
    notes: NOTES,
  }
}
