const pool = require('../../database/db')

const getAll = async ({ search, service_id, limit = 50, offset = 0 } = {}) => {
  const conditions = []
  const values = []
  let i = 1

  if (service_id) {
    conditions.push(`i.service_id = $${i++}`)
    values.push(service_id)
  }

  if (search) {
    conditions.push(`(i.name ILIKE $${i} OR i.invoice_name ILIKE $${i})`)
    values.push(`%${search}%`)
    i++
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const { rows } = await pool.query(
    `SELECT i.*,
      COUNT(u.id) AS total_quantity,
      COUNT(u.id) FILTER (WHERE u.available = true) AS available_quantity
    FROM items i
    LEFT JOIN units u ON u.item_id = i.id
    ${where}
    GROUP BY i.id
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
      COUNT(u.id) AS total_quantity,
      COUNT(u.id) FILTER (WHERE u.available = true) AS available_quantity
    FROM items i
    LEFT JOIN units u ON u.item_id = i.id
    WHERE i.id = $1
    GROUP BY i.id`,
    [id]
  )
  return rows[0]
}

const create = async (data) => {
  const { name, invoice_name, unit, service_id } = data
  const { rows } = await pool.query(
    `INSERT INTO items (name, invoice_name, unit, service_id)
    VALUES ($1,$2,$3,$4)
    RETURNING *`,
    [name, invoice_name || null, unit, service_id || null]
  )
  return rows[0]
}

const update = async (id, data) => {
  const fields = []
  const values = []
  let i = 1

  const allowed = ['name', 'invoice_name', 'unit', 'service_id']

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${i++}`)
      values.push(data[key])
    }
  }

  if (!fields.length) return null

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