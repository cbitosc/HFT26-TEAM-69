// Client for the CELESTRIA API — owner: DATA (D3.5).
//
// Browser client for the server-side NASA catalog. The server owns live
// fetching and snapshot fallback; local fixtures remain a last-resort offline
// fallback so the interface is still usable when the API is not running.

import { API_ERROR, ApiError } from '../contracts/api.js'
import { fixtureGeneratedAt, fixturePlanets } from '../data/fixtures/index.js'

async function request(path) {
  let response
  try {
    response = await fetch(path, { cache: 'no-store' })
  } catch {
    throw new ApiError(API_ERROR.NETWORK, 'The catalog server could not be reached.')
  }
  let body
  try {
    body = await response.json()
  } catch {
    throw new ApiError(API_ERROR.UNKNOWN, 'The catalog server returned an invalid response.', response.status)
  }
  if (!response.ok) {
    throw new ApiError(body.error?.code ?? API_ERROR.UNKNOWN, body.error?.message ?? 'Catalog request failed.', response.status)
  }
  return body
}

/** @returns {Promise<import('../contracts/api.js').CatalogResponse>} */
export async function getCatalog() {
  try {
    return await request('/api/planets')
  } catch (error) {
    if (error.code !== API_ERROR.NETWORK) throw error
    return { generatedAt: fixtureGeneratedAt, source: 'fixtures', count: fixturePlanets.length, planets: fixturePlanets }
  }
}

/**
 * @param {string} id
 * @returns {Promise<import('../contracts/api.js').PlanetResponse>}
 */
export async function getPlanet(id) {
  try {
    return await request(`/api/planets/${encodeURIComponent(id)}`)
  } catch (error) {
    if (error.code !== API_ERROR.NETWORK) throw error
    const planet = fixturePlanets.find((p) => p.id === id)
    if (!planet) throw new ApiError(API_ERROR.NOT_FOUND, `No planet with id "${id}".`, 404)
    return { planet, system: fixturePlanets.filter((p) => p.host === planet.host) }
  }
}

/**
 * Owner of the endpoint: AI (D4.3). Implemented here by DATA once it exists.
 * @param {import('../contracts/api.js').AstronomerRequest} _req
 * @returns {Promise<import('../contracts/api.js').AstronomerResponse>}
 */
export async function askAstronomer(_req) {
  throw new ApiError(API_ERROR.NOT_IMPLEMENTED, 'AI astronomer not available yet (D4.3).')
}
