require('dotenv').config()
const express = require('express')
const pool = require('./database/db')

const app = express()

app.use(express.json({ limit: '25mb' }))

const cors = require('cors')
app.use(cors())

app.use('/auth', require('./api/routes/auth').router)
app.use('/drive', require('./api/routes/drive'))
app.use('/services', require('./api/routes/services'))
app.use('/statuses', require('./api/routes/statuses'))
app.use('/locations', require('./api/routes/locations'))
app.use('/items', require('./api/routes/items'))
app.use('/units', require('./api/routes/units_standalone'))
app.use('/items/:item_id/units', require('./api/routes/units'))
app.use('/parse', require('./api/routes/parse'))
app.use('/units-of-measure', require('./api/routes/units_of_measure'))

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok' })
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message })
  }
})

const PORT = process.env.PORT || 3000

const path = require('path')
app.use(express.static(path.join(__dirname, '../../client')))
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ message: err.message || 'Internal error' })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})