// server/src/api/routes/units_of_measure.js
const router = require('express').Router()
const service = require('../services/units_of_measure.service')

router.get('/', async (req, res, next) => {
  try {
    res.json(await service.getAll())
  } catch (e) { next(e) }
})

router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await service.create(req.body))
  } catch (e) { next(e) }
})

router.patch('/:id', async (req, res, next) => {
  try {
    res.json(await service.update(req.params.id, req.body))
  } catch (e) { next(e) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    res.json(await service.remove(req.params.id))
  } catch (e) { next(e) }
})

module.exports = router