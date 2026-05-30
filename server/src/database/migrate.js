// server/src/database/migrate.js
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const pool = require('./db')

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `)

  const dir = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()

  for (const file of files) {
    const { rows } = await pool.query('SELECT id FROM migrations WHERE name = $1', [file])
    if (rows.length > 0) {
      console.log(`Skipping ${file}`)
      continue
    }

    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    await pool.query(sql)
    await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file])
    console.log(`Applied ${file}`)
  }

  console.log('Done')
  process.exit(0)
}

migrate().catch(e => {
  console.error(e)
  process.exit(1)
})