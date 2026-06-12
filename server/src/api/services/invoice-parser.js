const { renderPdfToPngs } = require('./pdf-render')
const { spawn } = require('child_process')
const path = require('path')

const EXTRACT_SCRIPT = path.join(__dirname, 'extract_table.py')

function runExtract(png, colMap) {
	return new Promise((resolve, reject) => {
		const env = colMap
			? { ...process.env, COL_MAP_JSON: JSON.stringify(colMap) }
			: process.env

		const proc = spawn('python3', [EXTRACT_SCRIPT], { timeout: 300000, env })
		const out = []
		const err = []

		proc.stdout.on('data', d => out.push(d))
		proc.stderr.on('data', d => err.push(d))
		proc.on('error', reject)
		proc.on('close', code => {
			if (code !== 0) {
				return reject(new Error(Buffer.concat(err).toString() || `python3 exited ${code}`))
			}
			try {
				resolve(JSON.parse(Buffer.concat(out).toString()))
			} catch (e) {
				reject(e)
			}
		})

		proc.stdin.write(png)
		proc.stdin.end()
	})
}

async function extractTableRows(buffer) {
	const pages = await renderPdfToPngs(buffer, 3)
	const allRows = []
	let vizBase64 = null
	let sharedColMap = null

	for (const { page, png } of pages) {
		try {
			const { records, viz, col_map } = await runExtract(png, sharedColMap)
			if (col_map && !sharedColMap) sharedColMap = col_map
			allRows.push(...records)
			if (viz && !vizBase64) vizBase64 = viz
		} catch (e) {
			console.error(`Extract error (page ${page}):`, e.message)
		}
	}

	console.log(`Extracted ${allRows.length} rows total`)
	return { rows: allRows, viz: vizBase64 }
}

module.exports = { extractTableRows }