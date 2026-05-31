const router = require('express').Router()
const { google } = require('googleapis')

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_SECRET,
  process.env.GOOGLE_REDIRECT_URI
)

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

router.get('/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  })
  res.redirect(url)
})

router.get('/google/callback', async (req, res) => {
  const { code } = req.query
  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  const params = new URLSearchParams({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || '',
  })

  res.redirect(`http://localhost:8080/#/auth/callback?${params}`)
})

module.exports = { router, oauth2Client }