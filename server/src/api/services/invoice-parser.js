const { renderPdfToPngs } = require('./pdf-render')
const { ocrPages } = require('./tesseract-ocr')

const NAME_KEYWORDS = ['військового майна']
const STOP_KEYWORDS = ['всього', 'матеріально', 'здав', 'прийняв', 'на суму', 'підпис']
const UNIT_VALUES = ['шт', 'кг', 'л', 'км', 'м', 'компл', 'пар', 'од', 'шт.', 'кг.']

const COLUMN_MAP = [
	{ field: 'row_no', keywords: ['№', 'no', 'з/п'] },
	{ field: 'name', keywords: ['найменування', 'назва'] },
	{ field: 'unit', keywords: ['одиниц', 'виміру'] },
	{ field: 'qty_received', keywords: ['надійшло', 'отримано', 'прибуло'] },
	{ field: 'qty_disposed', keywords: ['вибуло', 'витрачено', 'списано'] },
	{ field: 'qty_available', keywords: ['наявного', 'залишок', 'наявн'] },
	{ field: 'nomenclature_code', keywords: ['код', 'номенклатур'] },
	{ field: 'category', keywords: ['категор'] },
	{ field: 'price', keywords: ['ціна', 'вартість одн'] },
	{ field: 'total', keywords: ['сума', 'вартість'] },
	{ field: 'qty_sent', keywords: ['відпущено', 'відправлено'] },
	{ field: 'note', keywords: ['примітка'] },
]

class InvoiceTable {
	constructor(items) {
		this.rows = groupByY(items)
		this.headerIdx = -1
		this.colNumbersIdx = -1
		this.columns = []
	}

	findHeader() {
		for (let i = 0; i < this.rows.length; i++) {
			const text = this.rows.slice(i, i + 5).flat().map(c => c.text).join(' ').toLowerCase()
			if (NAME_KEYWORDS.some(k => text.includes(k))) {
				this.headerIdx = i
				return true
			}
		}
		return false
	}

	findColNumbers() {
		const from = this.headerIdx
		for (let i = from; i < Math.min(from + 8, this.rows.length); i++) {
			const text = this.rows[i].map(c => c.text).join(' ').trim()
			if (/^[\d\s]+$/.test(text) && text.trim().split(/\s+/).length >= 2) {
				this.colNumbersIdx = i
				return true
			}
		}
		return false
	}

	buildColumns() {
		const sourceRow = this.colNumbersIdx !== -1
			? this.rows[this.colNumbersIdx]
			: this.rows[this.headerIdx]

		const centers = sourceRow.map(it => it.x + (it.w || 0) / 2).sort((a, b) => a - b)
		const cols = centers.map(center => ({ center }))
		this.columns = cols.map((col, i) => ({
			center: col.center,
			left: i === 0 ? -Infinity : (cols[i - 1].center + col.center) / 2,
			right: i === cols.length - 1 ? Infinity : (col.center + cols[i + 1].center) / 2,
			label: '',
		}))
	}

	mapColumnLabels() {
		const endIdx = this.colNumbersIdx !== -1 ? this.colNumbersIdx : this.headerIdx
		const headerItems = this.rows.slice(this.headerIdx, endIdx).flat()
		for (const col of this.columns) {
			const inCol = headerItems.filter(it => {
				const cx = it.x + (it.w || 0) / 2
				return cx >= col.left && cx < col.right
			})
			col.label = inCol.map(c => c.text).join(' ').toLowerCase()
		}
	}

	resolveFields() {
		return this.columns.map(col => {
			const match = COLUMN_MAP.find(m => m.keywords.some(k => col.label.includes(k)))
			return match ? match.field : null
		})
	}

	parseRows(fields) {
		const dataEnd = this.colNumbersIdx !== -1 ? this.colNumbersIdx : this.headerIdx
		const records = []
		const colsWithoutNo = this.columns.slice(1)
		const fieldsWithoutNo = fields.slice(1)

		for (let i = dataEnd + 1; i < this.rows.length; i++) {
			const row = this.rows[i]
			const text = row.map(c => c.text).join(' ').toLowerCase()
			if (STOP_KEYWORDS.some(k => text.includes(k))) break

			const sorted = [...row].sort((a, b) => a.x - b.x)
			const firstWord = sorted[0]?.text.replace(/[|\s]/g, '') || ''
			const hasNo = /^\d+$/.test(firstWord)
			const isFirstRecord = !hasNo && records.length === 0

			const restWords = (hasNo || isFirstRecord) ? (hasNo ? sorted.slice(1) : sorted) : sorted
			const cells = this._distributeInto(hasNo ? sorted.slice(1) : sorted, colsWithoutNo)

			this._fixUnitOverflow(cells, fieldsWithoutNo)

			if (hasNo || isFirstRecord) {
				const record = { row_no: hasNo ? firstWord : '1' }
				fieldsWithoutNo.forEach((f, i) => { if (f) record[f] = cells[i] || '' })
				if (isFirstRecord && !hasNo) {
					const nameIdx = fieldsWithoutNo.indexOf('name')
					if (nameIdx >= 0) record.name = record.name ? firstWord + ' ' + record.name : firstWord
				}
				records.push(record)
			} else if (records.length > 0) {
				const prev = records[records.length - 1]
				fieldsWithoutNo.forEach((f, i) => {
					if (f && cells[i].trim()) {
						prev[f] = prev[f] ? prev[f] + ' ' + cells[i] : cells[i]
					}
				})
			}
		}

		return records
	}

	_fixUnitOverflow(cells, fields) {
		const unitIdx = fields.indexOf('unit')
		const nameIdx = fields.indexOf('name')
		if (unitIdx < 0 || nameIdx < 0) return
		const parts = cells[unitIdx].split(' ')
		const valid = []
		const overflow = []
		for (const p of parts) {
			if (UNIT_VALUES.includes(p.toLowerCase())) valid.push(p)
			else overflow.push(p)
		}
		if (overflow.length) {
			cells[unitIdx] = valid.join(' ')
			cells[nameIdx] = cells[nameIdx] ? cells[nameIdx] + ' ' + overflow.join(' ') : overflow.join(' ')
		}
	}

	_distribute(row) {
		return this._distributeInto(row, this.columns)
	}

	_distributeInto(words, columns) {
		const cells = columns.map(() => [])
		for (const item of words) {
			const cx = item.x + (item.w || 0) / 2
			const idx = columns.findIndex(c => cx >= c.left && cx < c.right)
			if (idx >= 0) cells[idx].push(item.text)
		}
		return cells.map(c => c.join(' ').trim())
	}
}

async function extractTableRows(buffer) {
	const pages = await renderPdfToPngs(buffer, 3)
	const items = await ocrPages(pages)
	console.log(`Tesseract extracted ${items.length} words`)

	const table = new InvoiceTable(items)

	if (!table.findHeader()) {
		console.log('Header not found. Top 15 rows:')
		table.rows.slice(0, 30).forEach((r, i) => console.log(`${i}: ${r.map(c => c.text).join(' ')}`))
		return []
	}

	table.findColNumbers()
	console.log(`headerIdx: ${table.headerIdx}, colNumbersIdx: ${table.colNumbersIdx}`)
	if (table.colNumbersIdx !== -1) console.log('ColNumbers row:', table.rows[table.colNumbersIdx].map(c => `"${c.text}"@${Math.round(c.x)}`).join(', '))
	table.buildColumns()
	table.mapColumnLabels()

	const fields = table.resolveFields()
	console.log('Fields:', fields)
	console.log('Column centers:', table.columns.map(c => Math.round(c.center)))
	console.log('Column labels:', table.columns.map(c => c.label))

	const dataStartIdx = (table.colNumbersIdx !== -1 ? table.colNumbersIdx : table.headerIdx) + 1
	const firstDataRow = table.rows[dataStartIdx]
	if (firstDataRow) console.log('First data row words:', firstDataRow.map(it => `"${it.text}"@${Math.round(it.x)}`).join(', '))
	const secondDataRow = table.rows[dataStartIdx + 1]
	if (secondDataRow) console.log('Second data row words:', secondDataRow.map(it => `"${it.text}"@${Math.round(it.x)}+${Math.round(it.w || 0)}(cx=${Math.round(it.x + (it.w || 0) / 2)})`).join(', '))

	const rows = table.parseRows(fields)
	console.log(`Parsed rows: ${rows.length}`)
	console.log('First 3:', JSON.stringify(rows.slice(0, 3)))
	return rows
}

function groupByY(items, tolerance = 5) {
	const sorted = [...items].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)
	const rows = []
	for (const it of sorted) {
		const last = rows[rows.length - 1]
		if (last && Math.abs(last[0].y - it.y) <= tolerance && last[0].page === it.page) {
			last.push(it)
		} else {
			rows.push([it])
		}
	}
	rows.forEach(r => r.sort((a, b) => a.x - b.x))
	return rows
}

module.exports = { extractTableRows }
