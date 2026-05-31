const dal = require('../dal/items.dal')

const getAll = async (query) => {
  const limit = parseInt(query.limit) || 50
  const page = parseInt(query.page) || 1
  const offset = (page - 1) * limit

  return dal.getAll({
    search: query.search,
    status_id: query.status_id,
    location_id: query.location_id,
    limit,
    offset,
  })
}

const getById = async (id) => {
  const item = await dal.getById(id)
  if (!item) throw { status: 404, message: 'Item not found' }
  return item
}

const create = async (data) => {
  if (!data.name) throw { status: 400, message: 'Name is required' }
  if (!data.unit_of_measure_id) throw { status: 400, message: 'Unit of measure is required' }
  return dal.create(data)
}

const update = async (id, data) => {
  const item = await dal.update(id, data)
  if (!item) throw { status: 404, message: 'Item not found' }
  return item
}

const remove = async (id) => {
  const item = await dal.remove(id)
  if (!item) throw { status: 404, message: 'Item not found' }
  return item
}

module.exports = { getAll, getById, create, update, remove }