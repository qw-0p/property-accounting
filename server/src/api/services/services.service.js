const dal = require('../dal/services.dal')

const getAll = async () => dal.getAll()

const getById = async (id) => {
  const service = await dal.getById(id)
  if (!service) throw { status: 404, message: 'Service not found' }
  return service
}

const create = async ({ name }) => {
  if (!name) throw { status: 400, message: 'Name is required' }
  return dal.create(name)
}

const update = async (id, { name }) => {
  if (!name) throw { status: 400, message: 'Name is required' }
  const service = await dal.update(id, name)
  if (!service) throw { status: 404, message: 'Service not found' }
  return service
}

const remove = async (id) => {
  const service = await dal.remove(id)
  if (!service) throw { status: 404, message: 'Service not found' }
  return service
}

module.exports = { getAll, getById, create, update, remove }