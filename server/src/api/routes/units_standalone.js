const router = require('express').Router()
const service = require('../services/units.service')

router.patch('/:id', async (req, res, next) => {
  try {
    res.json(await service.update(req.params.id, req.body))
  } catch (e) { next(e) }
})

module.exports = router