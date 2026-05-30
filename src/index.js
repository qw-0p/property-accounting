require('dotenv').config()
const express = require('express')
const pool = require('./database/db')

const app = express()

app.use(express.json())

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok' })
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message })
  }
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})