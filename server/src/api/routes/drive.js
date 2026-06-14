const router = require('express').Router()
const { google } = require('googleapis')

router.get('/files', async (req, res, next) => {
  try {
    const { folder_id } = req.query
    const access_token = req.headers.authorization?.replace('Bearer ', '')

    if (!access_token) return res.status(401).json({ message: 'No token' })

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )
    client.setCredentials({ access_token })

    const drive = google.drive({ version: 'v3', auth: client })

    const query = folder_id
      ? `'${folder_id}' in parents and trashed = false`
      : `trashed = false`

    const { data } = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, webViewLink)',
      pageSize: 1000,
    })

    res.json(data.files)
  } catch (e) {
    next(e)
  }
})

router.get('/folders', (req, res) => {
  res.json({
    report: process.env.RAPORT_FOLDER_ID,
    journal_entry: process.env.EXTRACT_FOLDER_ID,
    invoice: process.env.INVOICE_FOLDER_ID,
  })
})

module.exports = router