const { renderPdfToPngs } = require('./pdf-render')
const { spawn } = require('child_process')
const path = require('path')

const EXTRACT_SCRIPT = path.join(__dirname, 'extract_table.py')

function runPython(png, extraEnv) {
	return new Promise((resolve, reject) => {
		const env = extraEnv ? { ...process.env, ...extraEnv } : process.env
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

// Авто-розбір усіх сторінок. Повертає агреговані рядки + сітку кожної сторінки.
async function extractTableRows(buffer) {
	const pages = await renderPdfToPngs(buffer, 3)
	const allRows = []
	let vizBase64 = null
	let sharedColMap = null
	const pageInfos = []

	for (const { page, png } of pages) {
		try {
			const env = sharedColMap ? { COL_MAP_JSON: JSON.stringify(sharedColMap) } : null
			const { records, viz, col_map, grid } = await runPython(png, env)
			if (col_map && !sharedColMap) sharedColMap = col_map
			allRows.push(...records.map(r => ({ ...r, _page: page })))
			if (viz && !vizBase64) vizBase64 = viz
			pageInfos.push({ page, records, grid })
		} catch (e) {
			console.error(`Extract error (page ${page}):`, e.message)
		}
	}

	console.log(`Extracted ${allRows.length} rows total`)
	return { rows: allRows, viz: vizBase64, pages: pageInfos }
}

// Ручний ре-парсинг сторінки PDF за заданою сіткою.
// Сторінка рендериться наново й кропиться тим самим find_table_region (детерміновано),
// тож координати сітки з кроку 1 збігаються — фото туди-сюди гнати не треба.
async function extractManualPage(buffer, page, grid) {
	const pages = await renderPdfToPngs(buffer, 3)
	const target = pages.find(p => p.page === Number(page)) || pages[0]
	if (!target) throw new Error('page not found')
	const { records, viz } = await runPython(target.png, { MANUAL_GRID_JSON: JSON.stringify(grid) })
	return { rows: records, viz }
}

module.exports = { extractTableRows, extractManualPage }