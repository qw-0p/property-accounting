const Tesseract = require('tesseract.js')

async function ocrPages(pages) {
	const worker = await Tesseract.createWorker(['ukr', 'eng'])
	const items = []

	for (const { page, png, height } of pages) {
		console.log('PNG buffer size:', png?.length, 'type:', typeof png, Buffer.isBuffer(png))
		const { data } = await worker.recognize(png, {}, { blocks: true })
		console.log('blocks:', data.blocks?.length, 'block[0]:', data.blocks?.[0] ? Object.keys(data.blocks[0]) : 'none')
		const words = (data.blocks || [])
			.flatMap(b => b.paragraphs || [])
			.flatMap(p => p.lines || [])
			.flatMap(l => l.words || [])
		for (const word of words) {
			const text = word.text.trim()
			if (!text) continue
			const { x0, y0, x1 } = word.bbox
			items.push({
				text,
				x: x0,
				y: height - y0,
				w: x1 - x0,
				page,
			})
		}
	}

	await worker.terminate()
	return items
}

module.exports = { ocrPages }
