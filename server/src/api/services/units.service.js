const dal = require('../dal/units.dal')
const itemsDal = require('../dal/items.dal')

const getByItemId = async (item_id) => {
  const item = await itemsDal.getById(item_id)
  if (!item) throw { status: 404, message: 'Item not found' }
  return dal.getByItemId(item_id)
}

const create = async (item_id, { serial_number }) => {
  const item = await itemsDal.getById(item_id)
  if (!item) throw { status: 404, message: 'Item not found' }
  return dal.create(item_id, serial_number)
}

const remove = async (id) => {
  const unit = await dal.remove(id)
  if (!unit) throw { status: 404, message: 'Unit not found' }
  return unit
}

module.exports = { getByItemId, create, remove }