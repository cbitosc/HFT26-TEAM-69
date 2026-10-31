const TAP_ENDPOINT = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync'

const PLANET_FIELDS = {
  radiusEarth: 'pl_rade',
  massEarth: 'pl_bmasse',
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

const NO_ERR = new Set(['pl_tranmid'])
const LIMIT_COLUMNS = new Set(['pl_rade', 'pl_bmasse'])

function suffixColumns(columns) {
  return columns.flatMap((column) => {
    const extras = [`${column}_reflink`]
    if (!NO_ERR.has(column)) extras.push(`${column}err1`, `${column}err2`)
    if (LIMIT_COLUMNS.has(column)) extras.push(`${column}lim`)
    return extras
  })
}

const VALUE_COLUMNS = [...Object.values(PLANET_FIELDS), ...Object.values(STAR_FIELDS), 'sy_dist']

export const NASA_COLUMNS = Object.freeze([
  'pl_name', 'hostname', 'sy_snum', 'sy_pnum', 'pl_controv_flag', 'ttv_flag',
  'discoverymethod', 'disc_year', 'disc_facility', 'disc_telescope',
  'pl_bmassprov', 'st_spectype', 'ra', 'dec', 'sy_vmag',
  ...VALUE_COLUMNS,
  ...suffixColumns(VALUE_COLUMNS),
])

export const NASA_TAP_ENDPOINT = TAP_ENDPOINT

export function buildCatalogQuery() {
  return `select ${NASA_COLUMNS.join(',')} from pscomppars where pl_name is not null order by pl_name`
}

export function catalogUrl() {
  return `${TAP_ENDPOINT}?query=${encodeURIComponent(buildCatalogQuery())}&format=json`
}

export { PLANET_FIELDS, STAR_FIELDS }
