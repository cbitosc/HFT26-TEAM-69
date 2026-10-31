import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { catalogUrl } from './query.js'
import { normalizeCatalog } from './normalize.js'

const TTL_MS = 24 * 60 * 60 * 1000
const TIMEOUT_MS = 45_000
const SNAPSHOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/three/lab/fixtures.json')

let state = { planets: null, generatedAt: null, source: null, error: null }
let inflight = null

async function fetchLive() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(catalogUrl(), { signal: controller.signal, headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`NASA TAP returned HTTP ${response.status}`)
    const rows = await response.json()
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('NASA TAP returned no catalog rows')
    const planets = normalizeCatalog(rows)
    if (planets.length === 0) throw new Error('NASA TAP returned no usable planet rows')
    return { planets, generatedAt: new Date().toISOString(), source: 'live', error: null }
  } finally {
    clearTimeout(timeout)
  }
}

async function readSnapshot() {
  const snapshot = JSON.parse(await readFile(SNAPSHOT, 'utf8'))
  return {
    planets: snapshot.planets,
    generatedAt: snapshot.generatedAt ?? null,
    source: 'snapshot',
    error: null,
  }
}

export async function getCatalog() {
  if (state.planets && state.source === 'live' && Date.now() - Date.parse(state.generatedAt) < TTL_MS) return state
  if (inflight) return inflight
  inflight = fetchLive()
    .catch(async (error) => {
      console.warn(`NASA catalog unavailable; using snapshot fallback: ${error.message}`)
      const fallback = await readSnapshot()
      return { ...fallback, error: error.message }
    })
    .then((next) => {
      state = next
      return state
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function catalogHealth() {
  return {
    count: state.planets?.length ?? 0,
    generatedAt: state.generatedAt,
    source: state.source,
  }
}
