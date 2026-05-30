const pool = require('../../database/db')

const getByItemId = async (item_id) => {
  const { rows } = await pool.query(
    `SELECT u.*,
      s.name AS status_name,
      l.name AS location_name
    FROM units u
    LEFT JOIN statuses s ON s.id = u.status_id
    LEFT JOIN locations l ON l.id = u.location_id
    WHERE u.item_id = $1
    ORDER BY u.id`,
    [item_id]
  )
  return rows
}

const getById = async (id) => {
  const { rows } = await pool.query(
    `SELECT u.*,
      s.name AS status_name,
      l.name AS location_name
    FROM units u
    LEFT JOIN statuses s ON s.id = u.status_id
    LEFT JOIN locations l ON l.id = u.location_id
    WHERE u.id = $1`,
    [id]
  )
  return rows[0]
}

const create = async (item_id, data) => {
  const { serial_number, status_id, location_id, counted, available, report, journal_entry, note } = data
  const { rows } = await pool.query(
    `INSERT INTO units (item_id, serial_number, status_id, location_id, counted, available, report, journal_entry, note)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *`,
    [item_id, serial_number || null, status_id || null, location_id || null, counted ?? true, available ?? true, report || null, journal_entry || null, note || null]
  )
  return rows[0]
}

const update = async (id, data) => {
  const fields = []
  const values = []
  let i = 1

  const allowed = ['serial_number', 'status_id', 'location_id', 'counted', 'available', 'report', 'journal_entry', 'note']

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${i++}`)
      values.push(data[key])
    }
  }

  if (!fields.length) return null

  values.push(id)

  const { rows } = await pool.query(
    `UPDATE units SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
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

const countByItemId = async (item_id) => {
  const { rows } = await pool.query(
    `SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE available = true) AS available
    FROM units WHERE item_id = $1`,
    [item_id]
  )
  return rows[0]
}

module.exports = { getByItemId, getById, create, update, remove, countByItemId }