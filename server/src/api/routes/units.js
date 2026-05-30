const router = require('express').Router({ mergeParams: true })
const service = require('../services/units.service')

router.get('/', async (req, res, next) => {
  try {
    res.json(await service.getByItemId(req.params.item_id))
  } catch (e) { next(e) }
})

router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await service.create(req.params.item_id, req.body))
  } catch (e) { next(e) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    res.json(await service.remove(req.params.id))
  } catch (e) { next(e) }
})

router.patch('/:id', async (req, res, next) => {
  try {
    res.json(await service.update(req.params.id, req.body))
  } catch (e) { next(e) }
})
module.exports = router