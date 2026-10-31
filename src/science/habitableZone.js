// Kopparapu et al. (2013, 2014) conservative habitable-zone flux limits.
// The polynomial is calibrated for main-sequence stars and uses Teff in kelvin.

const SOLAR_TEFF = 5780

const EDGES = {
  runaway: { solar: 1.107, a: 1.332e-4, b: 1.58e-8, c: -8.308e-12, d: -1.931e-15 },
  maximumGreenhouse: { solar: 0.356, a: 6.171e-5, b: 1.698e-9, c: -3.198e-12, d: -5.575e-16 },
}

function effectiveFlux(teffK, edge) {
  const t = teffK - SOLAR_TEFF
  return edge.solar + edge.a * t + edge.b * t ** 2 + edge.c * t ** 3 + edge.d * t ** 4
}

/**
 * Return conservative runaway-greenhouse and maximum-greenhouse boundaries
 * in Earth-relative stellar flux. The standard polynomial is intended for
 * main-sequence stars; callers should validate the temperature range.
 * @param {number|null} teffK
 * @returns {{ innerFlux: number, outerFlux: number }|null}
 */
export function habitableFluxBand(teffK) {
  if (!Number.isFinite(teffK) || teffK < 2600 || teffK > 7200) return null
  return {
    innerFlux: effectiveFlux(teffK, EDGES.runaway),
    outerFlux: effectiveFlux(teffK, EDGES.maximumGreenhouse),
  }
}

/**
 * @param {number|null} teffK
 * @param {number|null} lumLog
 * @returns {{ conservative: [number, number], optimistic: [number, number] }|null}
 */
export function habitableZone(teffK, lumLog) {
  if (!Number.isFinite(teffK) || !Number.isFinite(lumLog)) return null
  const flux = habitableFluxBand(teffK)
  const luminosity = 10 ** lumLog
  if (!flux || !Number.isFinite(luminosity) || luminosity <= 0) return null
  return {
    conservative: [Math.sqrt(luminosity / flux.innerFlux), Math.sqrt(luminosity / flux.outerFlux)],
    optimistic: [Math.sqrt(luminosity / 1.776), Math.sqrt(luminosity / 0.32)],
  }
}
