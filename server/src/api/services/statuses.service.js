const dal = require('../dal/statuses.dal')

const getAll = async () => {
  return dal.getAll()
}

const getById = async (id) => {
  const status = await dal.getById(id)
  if (!status) throw { status: 404, message: 'Status not found' }
  return status
}

const create = async ({ name }) => {
  if (!name) throw { status: 400, message: 'Name is required' }
  return dal.create(name)
}

const update = async (id, { name }) => {
  if (!name) throw { status: 400, message: 'Name is required' }
  const status = await dal.update(id, name)
  if (!status) throw { status: 404, message: 'Status not found' }
  return status
}

const remove = async (id) => {
  const status = await dal.remove(id)
  if (!status) throw { status: 404, message: 'Status not found' }
  return status
}

module.exports = { getAll, getById, create, update, remove }