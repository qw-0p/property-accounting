export const openModal = (id = null, ctx = {}) => {
  const { items = [], unitsOfMeasure = [], services = [], serviceId, load, itemsApi, unitsApi, driveApi, DrivePicker } = ctx
  const item = id ? items.find(i => i.id === id) : null
	const container = document.getElementById('modal-container')
  let parsedRows = []
  let vizBase64 = null
  let mode = 'form'

  const renderModal = () => {
    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal ${mode === 'import' ? 'modal--wide' : ''}"
             style="${mode === 'import' ? 'width:95vw;max-width:1400px;height:90vh' : 'width:760px'}">
          <div class="modal-header">
            <h2>${item ? 'Редагувати майно' : 'Додати майно'}</h2>
            <button class="btn-ghost modal-close">✕</button>
          </div>
          ${mode === 'form' ? renderFormMode() : renderImportMode()}
        </div>
      </div>
    `
    bindEvents()
  }

  const renderFormMode = () => `
    <div class="modal-body">
      <div class="form-group">
        <label>Найменування *</label>
        <input type="text" name="name" value="${item?.name || ''}" />
      </div>
      <div class="form-group">
        <label>Найменування згідно накладної</label>
        <input type="text" name="invoice_name" value="${item?.invoice_name || ''}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Одиниця виміру *</label>
          <select name="unit_of_measure_id">
            <option value="">— Оберіть</option>
            ${unitsOfMeasure.map(u => `<option value="${u.id}" ${item?.unit_of_measure_id == u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Код номенклатури (КН)</label>
          <input type="text" name="nomenclature_code" value="${item?.nomenclature_code || ''}" placeholder="наприклад: 6/42" />
        </div>
        <div class="form-group">
          <label>Ціна за одиницю</label>
          <input type="number" name="price" value="${item?.price || ''}" step="0.01" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Служба *</label>
          <select name="service_id">
            <option value="">— Оберіть службу</option>
            ${services.map(s => `<option value="${s.id}" ${item?.service_id == s.id || serviceId == s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost modal-close">Скасувати</button>
      ${!item ? `<button class="btn-ghost" id="btn-switch-import">📁 Завантажити з накладної</button>` : ''}
      <button class="btn-primary" id="modal-save">Зберегти</button>
    </div>
  `

  const renderImportMode = () => `
    <div class="modal-import-top">
      <div class="form-group" style="min-width:220px">
        <label>Служба *</label>
        <select name="service_id">
          <option value="">— Оберіть службу</option>
          ${services.map(s => `<option value="${s.id}" ${serviceId == s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
      </div>
      <button class="btn-ghost" id="pick-invoice-btn" style="align-self:flex-end">📁 Вибрати PDF</button>
    </div>

    <div class="modal-body--split" style="flex:1;overflow:hidden">
      <!-- Ліво: PDF preview + візуалізація -->
      <div class="modal-pdf-panel" id="pdf-panel">
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

      <!-- Право: таблиця рядків -->
      <div class="modal-import-panel">
        <div id="parsed-result" style="padding:16px;color:#94a3b8;font-size:13px">
          Після вибору PDF тут з'являться розпізнані рядки
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn-ghost" id="btn-back-form">← Назад до форми</button>
      <button class="btn-ghost modal-close">Скасувати</button>
      <button class="btn-primary" id="modal-save-parsed" style="display:none">Імпортувати (0)</button>
    </div>
  `

  const bindEvents = () => {
    container.querySelectorAll('.modal-close').forEach(btn => {
      btn.onclick = () => { container.innerHTML = '' }
    })

    const switchBtn = container.querySelector('#btn-switch-import')
    if (switchBtn) {
      switchBtn.onclick = () => { mode = 'import'; renderModal() }
    }

    const backBtn = container.querySelector('#btn-back-form')
    if (backBtn) {
      backBtn.onclick = () => { mode = 'form'; parsedRows = []; vizBase64 = null; renderModal() }
    }

    const saveBtn = container.querySelector('#modal-save')
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const data = {}
        container.querySelectorAll('[name]').forEach(input => {
          data[input.name] = input.value === '' ? null : input.value
        })
        if (!data.name) { alert('Введіть найменування'); return }
        if (!data.service_id) { alert('Оберіть службу'); return }
        if (item) {
          await itemsApi.update(item.id, data)
        } else {
          await itemsApi.create(data)
        }
        container.innerHTML = ''
        load()
      }
    }

    const pickBtn = container.querySelector('#pick-invoice-btn')
    if (pickBtn) {
      pickBtn.onclick = async () => {
        await DrivePicker({
          field: 'invoice',
          onSelect: async ({ id: fileId, name }) => {
            // Показуємо tabs
            const placeholder = container.querySelector('#pdf-placeholder')
            const tabsContainer = container.querySelector('#pdf-tabs-container')
            placeholder.style.display = 'none'
            tabsContainer.style.display = 'flex'

            // Вмикаємо preview
            const iframe = container.querySelector('#pdf-iframe')
            iframe.src = `https://drive.google.com/file/d/${fileId}/preview`

            pickBtn.disabled = true
            pickBtn.textContent = `⏳ ${name}`

            const resultContainer = container.querySelector('#parsed-result')
            resultContainer.innerHTML = '<span style="color:#64748b;font-size:13px">⏳ Розпізнаю рядки...</span>'

            try {
              const { rows, viz } = await driveApi.parseInvoice(fileId)
              parsedRows = rows.map(r => ({ ...r, _selected: true, quantity: r.qty_sent || 1 }))
              vizBase64 = viz || null

              // Якщо є візуалізація — показуємо її
              if (vizBase64) {
                const vizImg = container.querySelector('#pdf-viz-img')
                vizImg.src = `data:image/png;base64,${vizBase64}`
              } else {
                // Ховаємо таб парсингу якщо немає візуалізації
                const tabViz = container.querySelector('#tab-viz')
                if (tabViz) tabViz.style.display = 'none'
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
    }

    // Таби preview / парсинг
    const tabPreview = container.querySelector('#tab-preview')
    const tabViz = container.querySelector('#tab-viz')
    if (tabPreview && tabViz) {
      tabPreview.onclick = () => {
        container.querySelector('#pdf-iframe').style.display = 'block'
        container.querySelector('#pdf-viz-img').style.display = 'none'
        tabPreview.classList.add('active')
        tabViz.classList.remove('active')
      }
      tabViz.onclick = () => {
        container.querySelector('#pdf-iframe').style.display = 'none'
        container.querySelector('#pdf-viz-img').style.display = 'block'
        tabViz.classList.add('active')
        tabPreview.classList.remove('active')
      }
    }

    // Імпортувати вибрані
    const saveAllBtn = container.querySelector('#modal-save-parsed')
    if (saveAllBtn) {
      saveAllBtn.onclick = async () => {
        const selected = parsedRows.filter(r => r._selected)
        if (!selected.length) return

        const currentServiceId = container.querySelector('[name="service_id"]')?.value
        if (!currentServiceId) { alert('Оберіть службу'); return }

        const missingUnit = selected.filter(r => !r.unit)
        if (missingUnit.length) {
          alert(`Оберіть одиницю виміру для рядків:\n${missingUnit.map(r => r.name || '(без назви)').join('\n')}`)
          return
        }

        saveAllBtn.disabled = true
        saveAllBtn.textContent = 'Імпортую...'

        for (const row of selected) {
          const uom = unitsOfMeasure.find(u => u.name === row.unit)
          const newItem = await itemsApi.create({
            name: row.name || '—',
            invoice_name: row.name || null,
            nomenclature_code: row.nomenclature_code || null,
            unit_of_measure_id: uom?.id || null,
            price: row.price || null,
            service_id: currentServiceId,
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

        container.innerHTML = ''
        load()
      }
    }
  }

  const renderParsedRows = (resultContainer) => {
    if (!parsedRows.length) {
      resultContainer.innerHTML = '<span style="color:#ef4444;font-size:13px">Не вдалось знайти рядки в PDF</span>'
      return
    }

    const saveAllBtn = container.querySelector('#modal-save-parsed')
    if (saveAllBtn) {
      saveAllBtn.style.display = ''
      saveAllBtn.textContent = `Імпортувати (${parsedRows.filter(r => r._selected).length})`
    }

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
      const btn = container.querySelector('#modal-save-parsed')
      if (btn) btn.textContent = `Імпортувати (${parsedRows.filter(r => r._selected).length})`
    }

    resultContainer.querySelectorAll('.parsed-row-check').forEach(cb => {
      cb.onchange = () => {
        parsedRows[parseInt(cb.dataset.idx)]._selected = cb.checked
        const btn = container.querySelector('#modal-save-parsed')
        if (btn) btn.textContent = `Імпортувати (${parsedRows.filter(r => r._selected).length})`
      }
    })

    resultContainer.querySelectorAll('[data-field]').forEach(input => {
      input.oninput = () => {
        parsedRows[parseInt(input.dataset.idx)][input.dataset.field] = input.value
      }
    })
  }

  renderModal()
}