const { renderPdfToPngs } = require('./pdf-render')
const { execFileSync } = require('child_process')
const path = require('path')

const EXTRACT_SCRIPT = path.join(__dirname, 'extract_table.py')

async function extractTableRows(buffer) {
    const pages = await renderPdfToPngs(buffer, 3)
    const allRows = []
    let vizBase64 = null

    for (const { png } of pages) {
        try {
						const result = execFileSync('python3', [EXTRACT_SCRIPT], {
								input: png,
								maxBuffer: 50 * 1024 * 1024,
								timeout: 300000,
						})
						const { records, viz } = JSON.parse(result.toString())
						allRows.push(...records)
						if (viz && !vizBase64) vizBase64 = viz 
        } catch (e) {
            console.error('Extract error:', e.stderr?.toString() || e.message)
        }
    }

    console.log(`Extracted ${allRows.length} rows total`)
    return allRows
}

module.exports = { extractTableRows }