const path = require('path')
const { createCanvas } = require('@napi-rs/canvas')

const PDFJS_ROOT = path.dirname(require.resolve('pdfjs-dist/package.json'))
const CMAP_URL = path.join(PDFJS_ROOT, 'cmaps') + '/'
const STANDARD_FONTS_URL = path.join(PDFJS_ROOT, 'standard_fonts') + '/'

async function renderPdfToPngs(buffer, scale = 3) {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const pdf = await pdfjs.getDocument({
        data: new Uint8Array(buffer),
        disableWorker: true,
        cMapUrl: CMAP_URL,
        cMapPacked: true,
        standardFontDataUrl: STANDARD_FONTS_URL,
    }).promise

    const pages = []
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        const viewport = page.getViewport({ scale })
        const canvas = createCanvas(viewport.width, viewport.height)
        const ctx = canvas.getContext('2d')
        await page.render({ canvasContext: ctx, viewport }).promise

        const png = canvas.toBuffer('image/png')
        pages.push({ page: p, png, width: viewport.width, height: viewport.height })
    }
    return pages
}

module.exports = { renderPdfToPngs }