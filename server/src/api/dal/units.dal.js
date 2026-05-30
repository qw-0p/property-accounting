const pool = require('../../database/db')

const getByItemId = async (item_id) => {
  const { rows } = await pool.query(
    'SELECT * FROM units WHERE item_id = $1 ORDER BY id',
    [item_id]
  )
  return rows
}

const getById = async (id) => {
  const { rows } = await pool.query(
    'SELECT * FROM units WHERE id = $1',
    [id]
  )
  return rows[0]
}

const create = async (item_id, serial_number) => {
  const { rows } = await pool.query(
    'INSERT INTO units (item_id, serial_number) VALUES ($1, $2) RETURNING *',
    [item_id, serial_number || null]
  )
  return rows[0]
}

const remove = async (id) => {
  const { rows } = await pool.query(
    'DELETE FROM units WHERE id = $1 RETURNING *',
    [id]
  )
  return rows[0]
}

module.exports = { getByItemId, getById, create, remove }