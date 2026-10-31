import { Router } from 'express'
import { getCatalog } from '../nasa/cache.js'

const router = Router()

router.get('/planets', async (_req, res, next) => {
  try {
    const catalog = await getCatalog()
    res.set('Cache-Control', 'no-store')
    res.json({
      generatedAt: catalog.generatedAt,
      source: catalog.source,
      count: catalog.planets.length,
      planets: catalog.planets,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/planets/:id', async (req, res, next) => {
  try {
    const catalog = await getCatalog()
    const planet = catalog.planets.find((candidate) => candidate.id === req.params.id)
    if (!planet) return res.status(404).json({ error: { code: 'NOT_FOUND', message: `No planet with id "${req.params.id}".` } })
    res.json({ planet, system: catalog.planets.filter((candidate) => candidate.host === planet.host) })
  } catch (error) {
    next(error)
  }
})

export default router
