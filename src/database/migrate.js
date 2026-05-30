require('dotenv').config()
const fs = require('fs')
const pool = require('./db')

async function migrate() {
  const path = require('path')
  const sql = fs.readFileSync(path.join(__dirname, 'migrations/001_init.sql'), 'utf8')
  await pool.query(sql)
  console.log('Migration done')
  process.exit(0)
}

migrate().catch(e => {
  console.error(e)
  process.exit(1)
})