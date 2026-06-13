import { itemsApi } from '../api/items.js'
import { unitsApi } from '../api/units.js'
import { dictApi } from '../api/dict.js'
import { driveApi } from '../api/drive.js'
import { DrivePicker } from '../components/drive-picker.js'
import { openGridEditor } from '../components/grid-editor.js'

const esc = (s) => String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;')

const rowFromRecord = (r, page) => {
  const serials = (r.note || '').split(/[\s,;]+/).map(s => s.trim()).filter(Boolean)
  const qty = serials.length || r.qty_received || r.qty_sent || 1
  return { ...r, _page: page, _selected: true, quantity: qty, _serials: serials.join('\n') }
}

export function InvoiceImportPage() {
  const el = document.createElement('div')

  const servicesApi = dictApi('services')
  const unitsOfMeasureApi = dictApi('units-of-measure')

  let services = []
  let unitsOfMeasure = []
  let parsedRows = []
  let vizBase64 = null
  let fileId = null
  let pages = [] // [{ page, records, grid }]

  // Статус рядка після lookup:
  //   _status: 'new' | 'exact' | 'conflict'
  //   _lookup: { exact, conflicts }
  //   _resolution: для конфлікту — 'new' | <item id> | null
  const lookupRow = async (row) => {
    try {
      const res = await itemsApi.lookup({
        name: row.name || null,
        nomenclature_code: row.nomenclature_code || null,
        price: row.price ?? null,
      })
      row._lookup = res
      if (res.exact) { row._status = 'exact'; row._resolution = null }
      else if (res.conflicts?.length) { row._status = 'conflict'; row._resolution = null }
      else { row._status = 'new'; row._resolution = null }
    } catch (e) {
      console.error('lookup error:', e)
      row._lookup = { exact: null, conflicts: [] }
      row._status = 'new'
      row._resolution = null
    }
  }

  const importableCount = () =>
    parsedRows.filter(r => r._selected).length

  // Серійні номери рядка (по одному в рядок текстарії)
  const serialList = (row) =>
    (row._serials || '').split('\n').map(s => s.trim()).filter(Boolean)

  // Скільки юнітів створиться: за серійниками, інакше за полем «К-ть»
  const unitCount = (row) => {
    const s = serialList(row)
    return s.length || (parseInt(row.quantity) || 1)
  }

  const updateImportBtn = () => {
    const btn = el.querySelector('#import-btn')
    if (!btn) return
    btn.style.display = parsedRows.length ? '' : 'none'
    btn.textContent = `Імпортувати (${importableCount()})`
  }

  const render = () => {
    el.innerHTML = `
      <div class="page-header">
        <h1>Імпорт з накладної</h1>
        <a href="#/items" class="btn-ghost">← До списку</a>
      </div>

      <div class="import-top">
        <div class="form-group" style="min-width:220px">
          <label>Служба * <span style="font-weight:400;color:#94a3b8">(для нових позицій)</span></label>
          <select name="service_id">
            <option value="">— Оберіть службу</option>
            ${services.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
          </select>
        </div>
        <button class="btn-ghost" id="pick-invoice-btn" style="align-self:flex-end">📁 Вибрати PDF</button>
        <button class="btn-primary" id="import-btn" style="align-self:flex-end;display:none">Імпортувати (0)</button>
      </div>

      <div class="import-split">
        <div class="import-pdf-panel">
          <div class="pdf-placeholder" id="pdf-placeholder">
            <span>📄</span>
            <p>PDF preview з'явиться тут після вибору файлу</p>
          </div>
          <div id="pdf-tabs-container" style="display:none;flex-direction:column;height:100%;width:100%">
            <div class="pdf-tabs">
              <button class="pdf-tab active" id="tab-preview">📄 Preview</button>
              <button class="pdf-tab" id="tab-viz">🔍 Парсинг</button>
            </div>
            <div style="flex:1;overflow:hidden;position:relative">
              <iframe id="pdf-iframe" style="width:100%;height:100%;border:none"></iframe>
              <img id="pdf-viz-img" style="display:none;width:100%;height:100%;object-fit:contain;background:#f8fafc" />
            </div>
          </div>
        </div>

        <div class="import-rows-panel">
          <div id="parsed-result" style="padding:16px;color:#94a3b8;font-size:13px">
            Після вибору PDF тут з'являться розпізнані рядки
          </div>
        </div>
      </div>
    `
    bindEvents()
  }

  const bindEvents = () => {
    const tabPreview = el.querySelector('#tab-preview')
    const tabViz = el.querySelector('#tab-viz')
    tabPreview.onclick = () => {
      el.querySelector('#pdf-iframe').style.display = 'block'
      el.querySelector('#pdf-viz-img').style.display = 'none'
      tabPreview.classList.add('active')
      tabViz.classList.remove('active')
    }
    tabViz.onclick = () => {
      el.querySelector('#pdf-iframe').style.display = 'none'
      el.querySelector('#pdf-viz-img').style.display = 'block'
      tabViz.classList.add('active')
      tabPreview.classList.remove('active')
    }

    el.querySelector('#pick-invoice-btn').onclick = async () => {
      const pickBtn = el.querySelector('#pick-invoice-btn')
      await DrivePicker({
        field: 'invoice',
        onSelect: async ({ id, name }) => {
          fileId = id
          el.querySelector('#pdf-placeholder').style.display = 'none'
          el.querySelector('#pdf-tabs-container').style.display = 'flex'
          el.querySelector('#pdf-iframe').src = `https://drive.google.com/file/d/${id}/preview`

          pickBtn.disabled = true
          pickBtn.textContent = `⏳ ${name}`

          const resultContainer = el.querySelector('#parsed-result')
          resultContainer.innerHTML = '<span style="color:#64748b;font-size:13px">⏳ Розпізнаю рядки...</span>'

          try {
            const resp = await driveApi.parseInvoice(id)
            const { rows, viz } = resp
            pages = resp.pages || []
            parsedRows = rows.map(r => rowFromRecord(r, r._page))
            vizBase64 = viz || null

            if (vizBase64) {
              el.querySelector('#pdf-viz-img').src = `data:image/png;base64,${vizBase64}`
            } else {
              el.querySelector('#tab-viz').style.display = 'none'
            }

            pickBtn.textContent = `📄 ${name}`

            resultContainer.innerHTML = '<span style="color:#64748b;font-size:13px">🔎 Перевіряю збіги...</span>'
            await Promise.all(parsedRows.map(lookupRow))
            renderParsedRows(resultContainer)
          } catch (e) {
            console.error('parse error:', e)
            resultContainer.innerHTML = '<span style="color:#ef4444;font-size:13px">Помилка парсингу</span>'
            pickBtn.textContent = '📁 Вибрати PDF'
          } finally {
            pickBtn.disabled = false
          }
        },
        onClose: () => {}
      })
    }

    el.querySelector('#import-btn').onclick = async () => {
      const importBtn = el.querySelector('#import-btn')
      const selected = parsedRows.filter(r => r._selected)
      if (!selected.length) return

      const serviceId = el.querySelector('[name="service_id"]').value

      // Невирішені конфлікти блокують імпорт
      const unresolved = selected.filter(r => r._status === 'conflict' && !r._resolution)
      if (unresolved.length) {
        alert(`Вирішіть конфлікти у виділених рядках (${unresolved.length})`)
        return
      }

      // Одиниця виміру обовʼязкова для нових позицій — і має бути зі списку (інакше сервер відхилить)
      const willCreate = (r) => r._status === 'new' || (r._status === 'conflict' && r._resolution === 'new')
      const resolveUom = (r) => unitsOfMeasure.find(u => u.name === r.unit)
      const missingUnit = selected.filter(r => willCreate(r) && !resolveUom(r))
      if (missingUnit.length) {
        alert(`Оберіть одиницю виміру зі списку для нових позицій:\n${missingUnit.map(r => `${r.name || '(без назви)'}${r.unit ? ` (зараз: «${r.unit}» — нема в довіднику)` : ''}`).join('\n')}`)
        return
      }
      if (selected.some(willCreate) && !serviceId) {
        alert('Оберіть службу для нових позицій')
        return
      }

      importBtn.disabled = true
      importBtn.textContent = 'Імпортую...'

      const invoiceLink = `https://drive.google.com/file/d/${fileId}/view`

      try {
        for (const row of selected) {
          const uom = resolveUom(row)

          // Визначаємо item, у який лити units
          let target = null
          if (row._status === 'exact') target = row._lookup.exact
          else if (row._status === 'conflict' && row._resolution !== 'new') {
            target = row._lookup.conflicts.find(c => c.id === row._resolution)
          }

          if (!target) {
            target = await itemsApi.create({
              name: row.name || '—',
              invoice_name: row.name || null,
              nomenclature_code: row.nomenclature_code || null,
              unit_of_measure_id: uom?.id || null,
              price: row.price || null,
              service_id: serviceId,
            })
            if (!target || !target.id) throw new Error(target?.message || 'Не вдалося створити позицію')
          } else {
            // Дописуємо відсутні дані в наявний item
            const patch = {}
            if (!target.nomenclature_code && row.nomenclature_code) patch.nomenclature_code = row.nomenclature_code
            if ((target.price === null || target.price === '' || target.price === undefined) && row.price) patch.price = row.price
            if (!target.unit_of_measure_id && uom) patch.unit_of_measure_id = uom.id
            if (Object.keys(patch).length) await itemsApi.update(target.id, patch)
          }

          const serials = serialList(row)
          const count = serials.length || (parseInt(row.quantity) || 1)
          for (let i = 0; i < count; i++) {
            const u = await unitsApi.create(target.id, {
              serial_number: serials[i] || null,
              status_id: null,
              location_id: null,
              invoice: invoiceLink,
            })
            if (!u || !u.id) throw new Error(u?.message || 'Не вдалося створити одиницю')
          }
        }
      } catch (e) {
        console.error('import error:', e)
        alert('Помилка імпорту: ' + (e?.message || e))
        importBtn.disabled = false
        importBtn.textContent = `Імпортувати (${importableCount()})`
        return
      }

      location.hash = '#/items'
    }
  }

  const statusCellHtml = (row, idx) => {
    if (row._status === 'exact') {
      const it = row._lookup.exact
      return `<span style="color:#0d9488;white-space:nowrap" title="${esc(it.name)} / ${esc(it.nomenclature_code || '—')}">➕ до наявного</span>`
    }
    if (row._status === 'new') {
      return `<span style="color:#2563eb;white-space:nowrap">✅ нове</span>`
    }
    // conflict
    const opts = row._lookup.conflicts.map(c => {
      const why = c.matchedOn === 'name' ? 'та сама назва'
        : c.matchedOn === 'code' ? 'той самий КН'
        : 'назва+КН, інша ціна'
      const label = `до: ${c.name} / КН ${c.nomenclature_code || '—'} / ${c.price ?? '—'} (${why})`
      return `<option value="${c.id}" ${row._resolution === c.id ? 'selected' : ''}>${esc(label)}</option>`
    }).join('')
    return `
      <select class="unit-inline-select conflict-resolve" data-idx="${idx}" style="border-color:#f59e0b">
        <option value="" ${!row._resolution ? 'selected' : ''}>⚠️ оберіть…</option>
        <option value="new" ${row._resolution === 'new' ? 'selected' : ''}>створити нове</option>
        ${opts}
      </select>
    `
  }

  const refreshStatusCell = (idx) => {
    const cell = el.querySelector(`#status-cell-${idx}`)
    if (!cell) return
    cell.innerHTML = statusCellHtml(parsedRows[idx], idx)
    bindStatusCell(idx)
  }

  const bindStatusCell = (idx) => {
    const sel = el.querySelector(`#status-cell-${idx} .conflict-resolve`)
    if (!sel) return
    sel.onchange = () => {
      const v = sel.value
      parsedRows[idx]._resolution = v === 'new' ? 'new' : (v ? parseInt(v) : null)
    }
  }

  // Відкрити редактор сітки для сторінки й перечитати її за новою розміткою
  const reparsePage = (p) => {
    if (!p || !p.grid || !p.grid.image) return
    openGridEditor({
      image: p.grid.image,
      grid: p.grid,
      onApply: async (newGrid) => {
        p.grid = { ...p.grid, ...newGrid }
        const resultContainer = el.querySelector('#parsed-result')
        resultContainer.innerHTML = '<span style="color:#64748b;font-size:13px">⏳ Перечитую за новою розміткою...</span>'
        try {
          const resp = await driveApi.parseManual({ file_id: fileId, page: p.page, grid: newGrid })
          const newRows = (resp.rows || []).map(r => rowFromRecord(r, p.page))
          parsedRows = parsedRows.filter(r => r._page !== p.page).concat(newRows)
          parsedRows.sort((a, b) => (a._page ?? 1e9) - (b._page ?? 1e9))
          await Promise.all(newRows.map(lookupRow))
          renderParsedRows(resultContainer)
        } catch (e) {
          console.error('manual reparse error:', e)
          renderParsedRows(resultContainer)
        }
      },
    })
  }

  const addManualRow = () => {
    parsedRows.push({
      name: '', nomenclature_code: '', unit: '', price: '', quantity: 1,
      _serials: '', _selected: true, _page: null,
      _status: 'new', _lookup: { exact: null, conflicts: [] }, _resolution: null,
    })
    renderParsedRows(el.querySelector('#parsed-result'))
  }

  const toolbarHtml = () => {
    const reparse = pages.filter(p => p.grid && p.grid.image)
      .map(p => `<button type="button" class="btn-ghost ge-open" data-page="${p.page}" style="padding:4px 8px;font-size:12px">✏️ Розмітка${pages.length > 1 ? ` (стор. ${p.page})` : ''}</button>`)
      .join('')
    return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center">
      ${reparse ? `<span style="font-size:11px;color:#64748b">Не так розпізналось?</span>${reparse}` : ''}
      <button type="button" class="btn-ghost" id="add-row-btn" style="padding:4px 8px;font-size:12px">+ Додати рядок вручну</button>
    </div>`
  }

  const bindToolbar = (resultContainer) => {
    resultContainer.querySelectorAll('.ge-open').forEach(btn => {
      btn.onclick = () => reparsePage(pages.find(p => p.page === +btn.dataset.page))
    })
    const add = resultContainer.querySelector('#add-row-btn')
    if (add) add.onclick = addManualRow
  }

  const renderParsedRows = (resultContainer) => {
    updateImportBtn()

    if (!parsedRows.length) {
      resultContainer.innerHTML = toolbarHtml() +
        '<div style="color:#94a3b8;font-size:13px">Рядків не знайдено. Можна додати вручну.</div>'
      bindToolbar(resultContainer)
      return
    }

    const reparseBar = toolbarHtml()

    resultContainer.innerHTML = reparseBar + `
      <div class="parsed-table-wrap">
        <table class="parsed-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-parsed" checked /></th>
              <th>Назва</th>
              <th>КН</th>
              <th>Од. виміру</th>
              <th>Ціна</th>
              <th>К-ть</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            ${parsedRows.map((row, idx) => `
              <tr>
                <td><input type="checkbox" class="parsed-row-check" data-idx="${idx}" ${row._selected ? 'checked' : ''} /></td>
                <td><input class="unit-inline-input" data-idx="${idx}" data-field="name" value="${esc(row.name || '')}" style="width:170px" /></td>
                <td><input class="unit-inline-input" data-idx="${idx}" data-field="nomenclature_code" value="${esc(row.nomenclature_code || '')}" style="width:100px" /></td>
                <td>
                  <select class="unit-inline-select" data-idx="${idx}" data-field="unit">
                    <option value="">—</option>
                    ${unitsOfMeasure.map(u => `<option value="${esc(u.name)}" ${row.unit === u.name ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
                  </select>
                </td>
                <td><input class="unit-inline-input" data-idx="${idx}" data-field="price" value="${row.price || ''}" style="width:80px" type="number" step="0.01" /></td>
                <td style="white-space:nowrap">
                  <input class="unit-inline-input" data-idx="${idx}" data-field="quantity" value="${row.quantity || 1}" style="width:48px" type="number" min="1" />
                  <button type="button" class="btn-ghost sn-toggle" data-idx="${idx}" style="padding:3px 6px;font-size:11px" title="Серійні номери">S/N</button>
                </td>
                <td id="status-cell-${idx}">${statusCellHtml(row, idx)}</td>
              </tr>
              <tr class="sn-editor-row" id="sn-editor-${idx}" style="display:none">
                <td></td>
                <td colspan="6" style="background:#f8fafc">
                  <div style="padding:8px 4px">
                    <div style="font-size:11px;color:#64748b;margin-bottom:4px">Серійні номери — по одному в рядок. Скільки рядків, стільки одиниць (порожньо → за полем «К-ть»).</div>
                    <textarea class="sn-textarea" data-idx="${idx}" rows="6" style="width:100%;box-sizing:border-box;font-size:12px;font-family:ui-monospace,monospace;border:1px solid #e2e8f0;border-radius:4px;padding:6px">${esc(row._serials || '')}</textarea>
                    <div style="font-size:11px;color:#64748b;margin-top:4px">Одиниць: <span class="sn-count" data-idx="${idx}">${unitCount(row)}</span></div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `

    resultContainer.querySelector('#select-all-parsed').onchange = (e) => {
      parsedRows.forEach(r => r._selected = e.target.checked)
      resultContainer.querySelectorAll('.parsed-row-check').forEach(cb => cb.checked = e.target.checked)
      updateImportBtn()
    }

    resultContainer.querySelectorAll('.parsed-row-check').forEach(cb => {
      cb.onchange = () => {
        parsedRows[parseInt(cb.dataset.idx)]._selected = cb.checked
        updateImportBtn()
      }
    })

    resultContainer.querySelectorAll('[data-field]').forEach(input => {
      const idx = parseInt(input.dataset.idx)
      const field = input.dataset.field

      input.oninput = () => { parsedRows[idx][field] = input.value }

      // Зміна назви, КН або ціни → перевіряємо збіги заново
      if (field === 'name' || field === 'nomenclature_code' || field === 'price') {
        input.onchange = async () => {
          const cell = el.querySelector(`#status-cell-${idx}`)
          if (cell) cell.innerHTML = '<span style="color:#94a3b8">…</span>'
          await lookupRow(parsedRows[idx])
          refreshStatusCell(idx)
        }
      }
    })

    parsedRows.forEach((_, idx) => bindStatusCell(idx))

    bindToolbar(resultContainer)

    resultContainer.querySelectorAll('.sn-toggle').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx)
        const editor = resultContainer.querySelector(`#sn-editor-${idx}`)
        editor.style.display = editor.style.display === 'none' ? '' : 'none'
      }
    })

    resultContainer.querySelectorAll('.sn-textarea').forEach(ta => {
      ta.oninput = () => {
        const idx = parseInt(ta.dataset.idx)
        parsedRows[idx]._serials = ta.value
        const cnt = resultContainer.querySelector(`.sn-count[data-idx="${idx}"]`)
        if (cnt) cnt.textContent = unitCount(parsedRows[idx])
        // Якщо є серійники — вони задають кількість юнітів
        const serials = serialList(parsedRows[idx])
        if (serials.length) {
          parsedRows[idx].quantity = serials.length
          const q = resultContainer.querySelector(`input[data-field="quantity"][data-idx="${idx}"]`)
          if (q) q.value = serials.length
        }
      }
    })
  }

  const init = async () => {
    ;[services, unitsOfMeasure] = await Promise.all([
      servicesApi.getAll(),
      unitsOfMeasureApi.getAll(),
    ])
    render()
  }

  init()
  return el
}