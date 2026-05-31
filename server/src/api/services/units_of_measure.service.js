const dal = require('../dal/units_of_measure.dal')

const getAll = async () => dal.getAll()

const getById = async (id) => {
  const unit = await dal.getById(id)
  if (!unit) throw { status: 404, message: 'Unit of measure not found' }
  return unit
}

const create = async ({ name }) => {
  if (!name) throw { status: 400, message: 'Name is required' }
  return dal.create(name)
}

const update = async (id, { name }) => {
  if (!name) throw { status: 400, message: 'Name is required' }
  const unit = await dal.update(id, name)
  if (!unit) throw { status: 404, message: 'Unit of measure not found' }
  return unit
}

const remove = async (id) => {
  const unit = await dal.remove(id)
  if (!unit) throw { status: 404, message: 'Unit of measure not found' }
  return unit
}

module.exports = { getAll, getById, create, update, remove }