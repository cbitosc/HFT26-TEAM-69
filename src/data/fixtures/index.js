// Offline catalog fallback in the final Planet shape (src/contracts/planet.js).
// The snapshot is also used by the lab, so the app remains populated while
// the server-side NASA route is being completed.
import snapshot from '../../three/lab/fixtures.json'

/** @type {import('../../contracts/planet.js').Planet[]} */
export const fixturePlanets = snapshot.planets
export const fixtureGeneratedAt = snapshot.generatedAt
