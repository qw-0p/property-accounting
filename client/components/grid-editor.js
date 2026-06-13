// client/components/grid-editor.js
// Ручний редактор сітки таблиці поверх зображення.
// Колонки = прямокутники з типом; керування типом/видаленням — у легенді над зображенням.
// Краї колонок розміщені ВСЕРЕДИНІ смуги біля межі, щоб у сусідів вони не налазили.
// Горизонтальні лінії мають захват і кнопку ✕. Окрема лінія = межа «заголовок / дані».
// Координати зберігаються в пікселях ОРИГІНАЛЬНОГО зображення таблиці.

const FIELDS = [
  ['row_no', '№'], ['name', 'Назва'], ['nomenclature_code', 'КН'], ['unit', 'Од.'], ['price', 'Ціна'], ['qty_sent', 'Відправлено'], ['note', 'Примітка'],
]
const FIELD_COLORS = {
  row_no: '#c8c8c8', name: '#ffb232', nomenclature_code: '#32cd32', unit: '#3296ff',
  category: '#b432ff', price: '#ff5050', qty_sent: '#32dcdc', qty_received: '#dcb432',
  total: '#ff78b4', note: '#a0a0a0',
}
const colorOf = (f) => FIELD_COLORS[f] || '#94a3b8'

export function openGridEditor({ image, grid, onApply }) {
  const W = grid.width
  const H = grid.height
  const maxW = Math.min(W, 1040)
  const scale = maxW / W

  let columns = (grid.columns || []).map(c => ({ x1: +c.x1, x2: +c.x2, field: c.field || null }))
  let rowLines = [...new Set((grid.row_lines || []).map(Number))].sort((a, b) => a - b)
  let headerBottom = Number(grid.header_bottom || 0)

  const overlay = document.createElement('div')
  overlay.className = 'grid-editor-overlay'
  overlay.innerHTML = `
    <div class="grid-editor">
      <div class="ge-toolbar">
        <strong>Розмітка таблиці</strong>
        <select id="ge-add-field">
          ${FIELDS.map(([f, l]) => `<option value="${f}">${l}</option>`).join('')}
        </select>
        <button class="btn-ghost" id="ge-add-col">+ колонка</button>
        <button class="btn-ghost" id="ge-add-row">+ горизонтальна лінія</button>
        <span style="flex:1"></span>
        <button class="btn-ghost" id="ge-cancel">Скасувати</button>
        <button class="btn-primary" id="ge-apply">Застосувати</button>
      </div>

      <div class="ge-legend" id="ge-legend"></div>
      <div class="ge-hint">Краї колонок тягни біля межі (всередині смуги). Тип колонки міняй у легенді зверху. Горизонтальні лінії: тягни за смугу, ✕ — видалити.</div>

      <div class="ge-scroll">
        <div class="ge-stage" id="ge-stage" style="width:${W * scale}px;height:${H * scale}px">
          <img src="data:image/png;base64,${image}" style="width:100%;height:100%;display:block" draggable="false" />
          <div class="ge-layer" id="ge-layer"></div>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  const stage = overlay.querySelector('#ge-stage')
  const layer = overlay.querySelector('#ge-layer')
  const legend = overlay.querySelector('#ge-legend')

  const toPx = (v) => v * scale
  const toImg = (v) => Math.round(v / scale)

  function renderLegend() {
    // Сортуємо за x для стабільного порядку
    legend.innerHTML = columns
      .map((col, idx) => `
        <span class="ge-legend-item" data-idx="${idx}">
          <span class="ge-chip" style="background:${colorOf(col.field)}"></span>
          <select class="ge-legend-field" data-idx="${idx}">
            <option value="">—</option>
            ${FIELDS.map(([f, l]) => `<option value="${f}" ${col.field === f ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <span class="ge-legend-del" data-idx="${idx}" title="Видалити колонку">✕</span>
        </span>
      `).join('') || '<span style="color:#94a3b8;font-size:12px">Колонок нема — додай через «+ колонка»</span>'

    legend.querySelectorAll('.ge-legend-field').forEach(sel => {
      sel.onchange = () => { columns[+sel.dataset.idx].field = sel.value || null; render() }
    })
    legend.querySelectorAll('.ge-legend-del').forEach(x => {
      x.onclick = () => { columns.splice(+x.dataset.idx, 1); render() }
    })
    // Підсвічування смуги при наведенні на елемент легенди
    legend.querySelectorAll('.ge-legend-item').forEach(item => {
      const idx = +item.dataset.idx
      item.onmouseenter = () => layer.querySelector(`.ge-col[data-idx="${idx}"]`)?.classList.add('ge-col-hl')
      item.onmouseleave = () => layer.querySelector(`.ge-col[data-idx="${idx}"]`)?.classList.remove('ge-col-hl')
    })
  }

  function renderLayer() {
    layer.innerHTML = ''

    columns.forEach((col, idx) => {
      const band = document.createElement('div')
      band.className = 'ge-col'
      band.dataset.idx = idx
      band.style.left = toPx(col.x1) + 'px'
      band.style.width = toPx(col.x2 - col.x1) + 'px'
      band.style.background = colorOf(col.field) + '20'
      band.style.borderColor = colorOf(col.field)

      const left = document.createElement('div')
      left.className = 'ge-handle ge-handle-l'
      left.style.color = colorOf(col.field)
      const right = document.createElement('div')
      right.className = 'ge-handle ge-handle-r'
      right.style.color = colorOf(col.field)
      band.appendChild(left)
      band.appendChild(right)
      layer.appendChild(band)

      dragX(left, (imgX) => { col.x1 = Math.max(0, Math.min(imgX, col.x2 - 12)); renderLayer() })
      dragX(right, (imgX) => { col.x2 = Math.min(W, Math.max(imgX, col.x1 + 12)); renderLayer() })
    })

    rowLines.forEach((y, idx) => {
      const wrap = document.createElement('div')
      wrap.className = 'ge-row-wrap'
      wrap.style.top = toPx(y) + 'px'
      wrap.innerHTML = `<div class="ge-row-line"></div><span class="ge-row-del" title="Видалити лінію">✕</span>`
      layer.appendChild(wrap)

      const del = wrap.querySelector('.ge-row-del')
      del.onclick = (e) => { e.stopPropagation(); rowLines.splice(idx, 1); renderLayer() }
      dragY(wrap, del,
        (imgY) => { rowLines[idx] = Math.max(0, Math.min(H, imgY)); wrap.style.top = toPx(rowLines[idx]) + 'px' },
        () => { rowLines.sort((a, b) => a - b); renderLayer() })
    })

    // Лінія «заголовок / дані» — лише якщо заголовок є (на сторінках-продовженнях header_bottom=0)
    if (headerBottom > 0) {
      const hb = document.createElement('div')
      hb.className = 'ge-header-wrap'
      hb.style.top = toPx(headerBottom) + 'px'
      hb.innerHTML = `<div class="ge-header-line"></div><span class="ge-header-tag">заголовок / дані</span>`
      layer.appendChild(hb)
      dragY(hb, null, (imgY) => { headerBottom = Math.max(0, Math.min(H, imgY)); hb.style.top = toPx(headerBottom) + 'px' })
    }
  }

  function render() {
    renderLegend()
    renderLayer()
  }

  function dragX(handle, onMove) {
    handle.onmousedown = (e) => {
      e.preventDefault(); e.stopPropagation()
      const rect = stage.getBoundingClientRect()
      const move = (ev) => onMove(toImg(ev.clientX - rect.left))
      const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
      document.addEventListener('mousemove', move)
      document.addEventListener('mouseup', up)
    }
  }

  // el — елемент, за який тягнемо; skipEl — дочірній елемент (напр. ✕), за який тягнути не треба
  function dragY(el, skipEl, onMove, onEnd) {
    el.onmousedown = (e) => {
      if (skipEl && (e.target === skipEl)) return
      e.preventDefault(); e.stopPropagation()
      const rect = stage.getBoundingClientRect()
      const move = (ev) => onMove(toImg(ev.clientY - rect.top))
      const up = () => {
        document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up)
        if (onEnd) onEnd()
      }
      document.addEventListener('mousemove', move)
      document.addEventListener('mouseup', up)
    }
  }

  overlay.querySelector('#ge-add-col').onclick = () => {
    const field = overlay.querySelector('#ge-add-field').value
    // нова колонка в найширшому вільному проміжку
    const sorted = [...columns].sort((a, b) => a.x1 - b.x1)
    let bestX = Math.round(W * 0.4), bestW = Math.round(W * 0.12)
    let prev = 0
    for (const c of sorted) {
      const gap = c.x1 - prev
      if (gap > bestW) { bestW = Math.min(gap - 10, Math.round(W * 0.15)); bestX = prev + 5 }
      prev = Math.max(prev, c.x2)
    }
    if (W - prev > bestW) { bestW = Math.min(W - prev - 10, Math.round(W * 0.15)); bestX = prev + 5 }
    columns.push({ x1: bestX, x2: bestX + Math.max(40, bestW), field })
    columns.sort((a, b) => a.x1 - b.x1)
    render()
  }

  overlay.querySelector('#ge-add-row').onclick = () => {
    rowLines.push(Math.round(H / 2))
    rowLines.sort((a, b) => a - b)
    renderLayer()
  }

  const close = () => overlay.remove()
  overlay.querySelector('#ge-cancel').onclick = close
  overlay.querySelector('#ge-apply').onclick = () => {
    const out = {
      columns: columns.map(c => ({ x1: Math.round(c.x1), x2: Math.round(c.x2), field: c.field })),
      row_lines: [...new Set(rowLines.map(Math.round))].sort((a, b) => a - b),
      header_bottom: Math.round(headerBottom),
    }
    close()
    onApply(out)
  }
  overlay.onclick = (e) => { if (e.target === overlay) close() }

  render()
}