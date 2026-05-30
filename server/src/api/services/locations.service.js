const dal = require('../dal/locations.dal')

const getAll = async () => dal.getAll()

const getById = async (id) => {
  const location = await dal.getById(id)
  if (!location) throw { status: 404, message: 'Location not found' }
  return location
}

const create = async ({ name }) => {
  if (!name) throw { status: 400, message: 'Name is required' }
  return dal.create(name)
}

const update = async (id, { name }) => {
  if (!name) throw { status: 400, message: 'Name is required' }
  const location = await dal.update(id, name)
  if (!location) throw { status: 404, message: 'Location not found' }
  return location
}

const remove = async (id) => {
  const location = await dal.remove(id)
  if (!location) throw { status: 404, message: 'Location not found' }
  return location
}

module.exports = { getAll, getById, create, update, remove }