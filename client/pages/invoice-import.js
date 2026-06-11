import { itemsApi } from '../api/items.js'
import { unitsApi } from '../api/units.js'
import { dictApi } from '../api/dict.js'
import { driveApi } from '../api/drive.js'
import { DrivePicker } from '../components/drive-picker.js'

const esc = (s) => String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export function InvoiceImportPage() {
  const el = document.createElement('div')

  const servicesApi = dictApi('services')
  const unitsOfMeasureApi = dictApi('units-of-measure')

  let services = []
  let unitsOfMeasure = []
  let parsedRows = []
  let vizBase64 = null
  let fileId = null

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
            const { rows, viz } = await driveApi.parseInvoice(id)
            parsedRows = rows.map(r => ({ ...r, _selected: true, quantity: r.qty_sent || 1 }))
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

      // Одиниця виміру обовʼязкова лише для рядків, що створять НОВИЙ item
      const willCreate = (r) => r._status === 'new' || (r._status === 'conflict' && r._resolution === 'new')
      const missingUnit = selected.filter(r => willCreate(r) && !r.unit)
      if (missingUnit.length) {
        alert(`Оберіть одиницю виміру для нових позицій:\n${missingUnit.map(r => r.name || '(без назви)').join('\n')}`)
        return
      }
      if (selected.some(willCreate) && !serviceId) {
        alert('Оберіть службу для нових позицій')
        return
      }

      importBtn.disabled = true
      importBtn.textContent = 'Імпортую...'

      const invoiceLink = `https://drive.google.com/file/d/${fileId}/view`

      for (const row of selected) {
        const uom = unitsOfMeasure.find(u => u.name === row.unit)

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
        } else {
          // Дописуємо відсутні дані в наявний item
          const patch = {}
          if (!target.nomenclature_code && row.nomenclature_code) patch.nomenclature_code = row.nomenclature_code
          if ((target.price === null || target.price === '' || target.price === undefined) && row.price) patch.price = row.price
          if (!target.unit_of_measure_id && uom) patch.unit_of_measure_id = uom.id
          if (Object.keys(patch).length) await itemsApi.update(target.id, patch)
        }

        const qty = parseInt(row.quantity) || 1
        for (let i = 0; i < qty; i++) {
          await unitsApi.create(target.id, {
            serial_number: null,
            status_id: null,
            location_id: null,
            invoice: invoiceLink,
          })
        }
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

  const renderParsedRows = (resultContainer) => {
    if (!parsedRows.length) {
      resultContainer.innerHTML = '<span style="color:#ef4444;font-size:13px">Не вдалось знайти рядки в PDF</span>'
      return
    }

    updateImportBtn()

    resultContainer.innerHTML = `
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
                <td><input class="unit-inline-input" data-idx="${idx}" data-field="quantity" value="${row.quantity || 1}" style="width:56px" type="number" min="1" /></td>
                <td id="status-cell-${idx}">${statusCellHtml(row, idx)}</td>
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