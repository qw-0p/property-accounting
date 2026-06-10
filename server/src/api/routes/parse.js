const router = require('express').Router()
const { google } = require('googleapis')
const { extractTableRows } = require('../services/invoice-parser')

const num = s => {
	const c = String(s || '').replace(/\s/g, '')
	const last = Math.max(c.lastIndexOf(','), c.lastIndexOf('.'))
	if (last === -1) return parseFloat(c) || null
	return parseFloat(c.slice(0, last).replace(/[.,]/g, '') + '.' + c.slice(last + 1)) || null
}

const NUMERIC_FIELDS = ['price', 'qty_sent', 'qty_received', 'qty_disposed', 'qty_available', 'total']

// Прибираємо рядки що складаються переважно з OCR-сміття
function cleanText(s) {
	if (!s) return null
	const str = s.trim()
	if (!str) return null
	const letters = (str.match(/[\p{L}\d]/gu) || []).length
	if (str.length > 5 && letters / str.length < 0.4) return null
	// Прибираємо зайві символи з країв
	return str.replace(/^[|\-\s\/\\]+|[|\-\s\/\\]+$/g, '').trim() || null
}

function normalizeRow(row) {
	const out = { ...row }
	delete out._partial
	delete out.row_no

	// Очищаємо текстові поля
	for (const k of ['name', 'nomenclature_code', 'unit']) {
		out[k] = cleanText(out[k])
	}

	// Числові поля
	for (const f of NUMERIC_FIELDS) {
		if (f in out) out[f] = num(out[f])
	}
	if (out.price !== undefined) out.price = num(out.price)

	// Прибираємо null поля
	for (const k of Object.keys(out)) {
		if (out[k] === null || out[k] === undefined || out[k] === '') delete out[k]
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
		const rows = cells
			.map(normalizeRow)
			.filter(r => r.name || r.nomenclature_code)

		console.log('parsed rows:', rows.length)
		res.json({ rows, file_id })
	} catch (e) {
		console.error('Parse error:', e.message)
		next(e)
	}
})

module.exports = router