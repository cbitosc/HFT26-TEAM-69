import { planetSlug, PROVENANCE, missing, quantity } from '../../src/contracts/planet.js'

const NO_ERR = new Set(['pl_tranmid'])

function number(value) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseSource(reflink) {
  if (typeof reflink !== 'string' || !reflink.trim()) return undefined
  const label = reflink.replace(/<[^>]*>/g, '').trim()
  const href = reflink.match(/href\s*=\s*["']?([^"'\s>]+)/i)?.[1]
  let url = null
  if (href) {
    try {
      url = new URL(href, 'https://exoplanetarchive.ipac.caltech.edu').toString()
    } catch {
      url = null
    }
  }
  return { label, url }
}

function q(row, column) {
  const value = number(row[column])
  if (value == null) return missing()
  const reflink = row[`${column}_reflink`]
  const out = quantity(value, reflink?.includes('CALCULATED_VALUE') ? PROVENANCE.CALCULATED : PROVENANCE.MEASURED)
  if (!NO_ERR.has(column)) {
    const plus = number(row[`${column}err1`])
    const minus = number(row[`${column}err2`])
    if (plus != null && minus != null) out.err = [plus, minus]
  }
  const limit = number(row[`${column}lim`])
  if (limit === 1) out.limit = '<'
  if (limit === -1) out.limit = '>'
  const source = parseSource(reflink)
  if (source) out.source = source
  return out
}

function massQuantity(row) {
  const base = q(row, 'pl_bmasse')
  if (base.status === PROVENANCE.MISSING) return base
  const provider = row.pl_bmassprov
  const kind = provider === 'Msini' ? 'Msini' : provider === 'M-R relationship' ? 'M-R' : 'Mass'
  return { ...base, kind, ...(kind === 'M-R' ? { status: PROVENANCE.ESTIMATED } : {}) }
}

const PLANET_FIELDS = {
  radiusEarth: 'pl_rade',
  densityGcc: 'pl_dens',
  eqTempK: 'pl_eqt',
  insolationEarth: 'pl_insol',
  periodDays: 'pl_orbper',
  semiMajorAxisAU: 'pl_orbsmax',
  eccentricity: 'pl_orbeccen',
  inclinationDeg: 'pl_orbincl',
  periastronArgDeg: 'pl_orblper',
  periastronTimeJD: 'pl_orbtper',
  transitMidJD: 'pl_tranmid',
}

const STAR_FIELDS = {
  teff: 'st_teff',
  radiusSun: 'st_rad',
  massSun: 'st_mass',
  lumLog: 'st_lum',
  metallicity: 'st_met',
  ageGyr: 'st_age',
}

export function normalizePlanet(row) {
  const name = typeof row.pl_name === 'string' ? row.pl_name.trim() : ''
  const host = typeof row.hostname === 'string' ? row.hostname.trim() : ''
  if (!name || !host) return null
  const planet = { id: planetSlug(name), name, host }
  for (const [field, column] of Object.entries(PLANET_FIELDS)) planet[field] = q(row, column)
  planet.massEarth = massQuantity(row)
  planet.star = { name: host, spectralType: row.st_spectype ?? null }
  for (const [field, column] of Object.entries(STAR_FIELDS)) planet.star[field] = q(row, column)
  planet.discovery = {
    year: number(row.disc_year),
    method: row.discoverymethod ?? null,
    facility: row.disc_facility ?? null,
    telescope: row.disc_telescope ?? null,
  }
  planet.system = {
    distancePc: q(row, 'sy_dist'),
    planetCount: number(row.sy_pnum),
    starCount: number(row.sy_snum),
    raDeg: number(row.ra),
    decDeg: number(row.dec),
    vMag: number(row.sy_vmag),
  }
  planet.flags = { controversial: row.pl_controv_flag === 1, ttv: row.ttv_flag === 1 }
  return planet
}

export function normalizeCatalog(rows) {
  const seen = new Set()
  return rows.map(normalizePlanet).filter((planet) => {
    if (!planet || seen.has(planet.id)) return false
    seen.add(planet.id)
    return true
  })
}
