import { itemsApi } from '../api/items.js'
import { unitsApi } from '../api/units.js'
import { dictApi } from '../api/dict.js'
import { driveApi } from '../api/drive.js'
import { DrivePicker } from '../components/drive-picker.js'

export function InvoiceImportPage() {
  const el = document.createElement('div')

  const servicesApi = dictApi('services')
  const unitsOfMeasureApi = dictApi('units-of-measure')

  let services = []
  let unitsOfMeasure = []
  let parsedRows = []
  let vizBase64 = null
  let fileId = null

  const updateImportBtn = () => {
    const btn = el.querySelector('#import-btn')
    if (!btn) return
    const n = parsedRows.filter(r => r._selected).length
    btn.style.display = parsedRows.length ? '' : 'none'
    btn.textContent = `Імпортувати (${n})`
  }

  const render = () => {
    el.innerHTML = `
      <div class="page-header">
        <h1>Імпорт з накладної</h1>
        <a href="#/items" class="btn-ghost">← До списку</a>
      </div>

      <div class="import-top">
        <div class="form-group" style="min-width:220px">
          <label>Служба *</label>
          <select name="service_id">
            <option value="">— Оберіть службу</option>
            ${services.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
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
    // Таби preview / парсинг
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

    // Вибір PDF з Drive
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

    // Імпортувати вибрані
    el.querySelector('#import-btn').onclick = async () => {
      const importBtn = el.querySelector('#import-btn')
      const selected = parsedRows.filter(r => r._selected)
      if (!selected.length) return

      const serviceId = el.querySelector('[name="service_id"]').value
      if (!serviceId) { alert('Оберіть службу'); return }

      const missingUnit = selected.filter(r => !r.unit)
      if (missingUnit.length) {
        alert(`Оберіть одиницю виміру для рядків:\n${missingUnit.map(r => r.name || '(без назви)').join('\n')}`)
        return
      }

      importBtn.disabled = true
      importBtn.textContent = 'Імпортую...'

      for (const row of selected) {
        const uom = unitsOfMeasure.find(u => u.name === row.unit)
        const newItem = await itemsApi.create({
          name: row.name || '—',
          invoice_name: row.name || null,
          nomenclature_code: row.nomenclature_code || null,
          unit_of_measure_id: uom?.id || null,
          price: row.price || null,
          service_id: serviceId,
        })

        const qty = parseInt(row.quantity) || 1
        const invoiceLink = `https://drive.google.com/file/d/${fileId}/view`
        for (let i = 0; i < qty; i++) {
          await unitsApi.create(newItem.id, {
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
            </tr>
          </thead>
          <tbody>
            ${parsedRows.map((row, idx) => `
              <tr>
                <td><input type="checkbox" class="parsed-row-check" data-idx="${idx}" ${row._selected ? 'checked' : ''} /></td>
                <td><input class="unit-inline-input" data-idx="${idx}" data-field="name" value="${(row.name || '').replace(/"/g, '&quot;')}" style="width:180px" /></td>
                <td><input class="unit-inline-input" data-idx="${idx}" data-field="nomenclature_code" value="${(row.nomenclature_code || '').replace(/"/g, '&quot;')}" style="width:110px" /></td>
                <td>
                  <select class="unit-inline-select" data-idx="${idx}" data-field="unit">
                    <option value="">—</option>
                    ${unitsOfMeasure.map(u => `<option value="${u.name}" ${row.unit === u.name ? 'selected' : ''}>${u.name}</option>`).join('')}
                  </select>
                </td>
                <td><input class="unit-inline-input" data-idx="${idx}" data-field="price" value="${row.price || ''}" style="width:80px" type="number" step="0.01" /></td>
                <td><input class="unit-inline-input" data-idx="${idx}" data-field="quantity" value="${row.quantity || 1}" style="width:60px" type="number" min="1" /></td>
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
      input.oninput = () => {
        parsedRows[parseInt(input.dataset.idx)][input.dataset.field] = input.value
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