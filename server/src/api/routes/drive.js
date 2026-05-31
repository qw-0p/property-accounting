const router = require('express').Router()
const { google } = require('googleapis')
const { oauth2Client } = require('./auth')

router.get('/files', async (req, res, next) => {
  try {
    const { access_token, folder_id } = req.query

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
      pageSize: 50,
    })

    res.json(data.files)
  } catch (e) {
    next(e)
  }
})

module.exports = router