const pool = require('../../database/db')

const getAll = async () => {
  const { rows } = await pool.query('SELECT * FROM units_of_measure ORDER BY id')
  return rows
}

const getById = async (id) => {
  const { rows } = await pool.query('SELECT * FROM units_of_measure WHERE id = $1', [id])
  return rows[0]
}

const create = async (name) => {
  const { rows } = await pool.query(
    'INSERT INTO units_of_measure (name) VALUES ($1) RETURNING *',
    [name]
  )
  return rows[0]
}

const update = async (id, name) => {
  const { rows } = await pool.query(
    'UPDATE units_of_measure SET name = $1 WHERE id = $2 RETURNING *',
    [name, id]
  )
  return rows[0]
}

const remove = async (id) => {
  const { rows } = await pool.query(
    'DELETE FROM units_of_measure WHERE id = $1 RETURNING *',
    [id]
  )
  return rows[0]
}

module.exports = { getAll, getById, create, update, remove }