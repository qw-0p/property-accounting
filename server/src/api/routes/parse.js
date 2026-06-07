const router = require('express').Router()
const { google } = require('googleapis')
const { extractTableRows } = require('../services/invoice-parser')

const num = s => {
	const c = String(s || '').replace(/\s/g, '')
	const last = Math.max(c.lastIndexOf(','), c.lastIndexOf('.'))
	if (last === -1) return parseFloat(c) || null
	return parseFloat(c.slice(0, last).replace(/[.,]/g, '') + '.' + c.slice(last + 1)) || null
}

const NUMERIC_FIELDS = ['price', 'qty_sent', 'qty_received', 'qty_received', 'qty_disposed', 'qty_available', 'total']

function normalizeRow(row) {
	const out = { ...row }
	delete out._partial
	for (const f of NUMERIC_FIELDS) {
		if (f in out) out[f] = num(out[f])
	}
	if ('row_no' in out) out.row_no = parseInt(out.row_no) || null
	for (const k of Object.keys(out)) {
		if (typeof out[k] === 'string') out[k] = out[k].trim() || null
	}
	return out
}

router.post('/invoice', async (req, res, next) => {
	try {
		const { file_id } = req.body
		const access_token = req.headers.authorization?.replace('Bearer ', '')
		if (!file_id) return res.status(400).json({ message: 'file_id required' })
		if (!access_token) return res.status(401).json({ message: 'No token' })

		const client = new google.auth.OAuth2(
			process.env.GOOGLE_CLIENT_ID,
			process.env.GOOGLE_SECRET,
			process.env.GOOGLE_REDIRECT_URI
		)
		client.setCredentials({ access_token })
		const drive = google.drive({ version: 'v3', auth: client })

		const { data } = await drive.files.get(
			{ fileId: file_id, alt: 'media' },
			{ responseType: 'arraybuffer' }
		)
		const cells = await extractTableRows(Buffer.from(data))
		const rows = cells.map(normalizeRow)
		console.log('parsed rows:', rows.length)
		res.json({ rows })
	} catch (e) {
		console.error('Parse error:', e.message)
		next(e)
	}
})

module.exports = router
