#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { extractTableRows } = require('../src/api/services/invoice-parser')

const file = process.argv[2]
if (!file) {
	console.error('usage: node scripts/test-parse.js <path-to.pdf>')
	process.exit(1)
}

;(async () => {
	const buffer = fs.readFileSync(path.resolve(file))
	const cells = await extractTableRows(buffer)
	console.log('--- RAW CELLS ---')
	console.log(JSON.stringify(cells, null, 2))
	console.log('\n--- ROWS:', cells.length, '---')
})().catch(e => { console.error(e); process.exit(1) })
