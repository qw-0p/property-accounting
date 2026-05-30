const pool = require('../../database/db')

const getAll = async ({ search, status_id, location_id, limit = 50, offset = 0 }) => {
  const conditions = []
  const values = []
  let i = 1

  if (status_id) {
    conditions.push(`i.status_id = $${i++}`)
    values.push(status_id)
  }

  if (location_id) {
    conditions.push(`i.location_id = $${i++}`)
    values.push(location_id)
  }

  if (search) {
    conditions.push(`(i.name ILIKE $${i} OR i.invoice_name ILIKE $${i} OR i.note ILIKE $${i})`)
    values.push(`%${search}%`)
    i++
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const { rows } = await pool.query(
    `SELECT i.*, 
      s.name AS status_name,
      l.name AS location_name
    FROM items i
    LEFT JOIN statuses s ON s.id = i.status_id
    LEFT JOIN locations l ON l.id = i.location_id
    ${where}
    ORDER BY i.id DESC
    LIMIT $${i} OFFSET $${i + 1}`,
    [...values, limit, offset]
  )

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) FROM items i ${where}`,
    values
  )

  return { items: rows, total: parseInt(countRows[0].count) }
}

const getById = async (id) => {
  const { rows } = await pool.query(
    `SELECT i.*,
      s.name AS status_name,
      l.name AS location_name
    FROM items i
    LEFT JOIN statuses s ON s.id = i.status_id
    LEFT JOIN locations l ON l.id = i.location_id
    WHERE i.id = $1`,
    [id]
  )
  return rows[0]
}

const create = async (data) => {
  const { name, invoice_name, unit, counted, available, total_quantity, note, report, journal_entry, status_id, location_id } = data
  const { rows } = await pool.query(
    `INSERT INTO items (name, invoice_name, unit, counted, available, total_quantity, note, report, journal_entry, status_id, location_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *`,
    [name, invoice_name, unit, counted ?? 0, available ?? 0, total_quantity ?? 0, note, report, journal_entry, status_id, location_id]
  )
  return rows[0]
}

const update = async (id, data) => {
  const fields = []
  const values = []
  let i = 1

  const allowed = ['name', 'invoice_name', 'unit', 'counted', 'available', 'total_quantity', 'note', 'report', 'journal_entry', 'status_id', 'location_id']

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${i++}`)
      values.push(data[key])
    }
  }

  if (!fields.length) return null

  fields.push(`updated_at = NOW()`)
  values.push(id)

  const { rows } = await pool.query(
    `UPDATE items SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  )
  return rows[0]
}

const remove = async (id) => {
  const { rows } = await pool.query(
    'DELETE FROM items WHERE id = $1 RETURNING *',
    [id]
  )
  return rows[0]
}

module.exports = { getAll, getById, create, update, remove }