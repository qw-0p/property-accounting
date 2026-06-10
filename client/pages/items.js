import { itemsApi } from '../api/items.js'
import { dictApi } from '../api/dict.js'
import { unitsApi } from '../api/units.js'
import { DrivePicker } from '../components/drive-picker.js'
import { driveApi } from '../api/drive.js'

export function ItemsPage({ serviceId } = {}) {
  const el = document.createElement('div')
  const statusesApi = dictApi('statuses')
	const locationsApi = dictApi('locations')
	const servicesApi = dictApi('services')

	let services = []
	let unitsOfMeasure = []
	const unitsOfMeasureApi = dictApi('units-of-measure')
  let items = []
  let total = 0
  let statuses = []
  let locations = []
  let filters = { search: '', service_id: serviceId || '', page: 1, limit: 50 }
  const openAccordions = new Set()

  const render = () => {
    el.innerHTML = `
      <div class="page-header">
        <h1>Майно</h1>
        <button class="btn-primary" id="add-item-btn">+ Додати</button>
      </div>

      <div class="filters">
        <input type="text" id="search" placeholder="Пошук..." value="${filters.search}" />
        <button class="btn-ghost" id="reset-filters">Скинути</button>
      </div>

      <div class="table-meta">Знайдено: ${total}</div>

      <div class="table-wrap">
        <table class="items-table">
          <thead>
            <tr>
              <th></th>
              <th>Найменування</th>
              <th>Згідно накладної</th>
              <th>Од. виміру</th>
							<th>КН</th>
              <th>Кількість</th>
							<th>Ціна</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${items.length === 0
              ? `<tr><td colspan="6" class="empty">Немає записів</td></tr>`
              : items.map(item => `
                <tr class="item-row" data-id="${item.id}">
                  <td class="accordion-trigger" data-id="${item.id}">
                    ${openAccordions.has(item.id) ? '▼' : '▶'}
                  </td>
                  <td>${item.name}</td>
                  <td>${item.invoice_name || '—'}</td>
                  <td>${item.unit_name}</td>
									<td>${item.nomenclature_code || '—'}</td>
                  <td>${item.total_quantity} (${item.available_quantity} в наявності)</td>
									<td>${item.price || '—'}</td>
                  <td class="row-actions">
                    <button class="btn-ghost edit-btn" data-id="${item.id}">Ред.</button>
                    <button class="btn-danger delete-btn" data-id="${item.id}">Вид.</button>
                  </td>
                </tr>
                <tr class="accordion-row" id="accordion-${item.id}" style="display:${openAccordions.has(item.id) ? '' : 'none'}">
                  <td colspan="6">
                    <div class="accordion-content" id="accordion-content-${item.id}"></div>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <button class="btn-ghost" id="prev-page" ${filters.page <= 1 ? 'disabled' : ''}>← Назад</button>
        <span>Сторінка ${filters.page}</span>
        <button class="btn-ghost" id="next-page" ${items.length < filters.limit ? 'disabled' : ''}>Вперед →</button>
      </div>

      <div id="modal-container"></div>
    `

    openAccordions.forEach(itemId => {
      const content = el.querySelector(`#accordion-content-${itemId}`)
      if (content) renderAccordion(itemId, content)
    })

    bindEvents()
  }

  const bindEvents = () => {
    let searchTimer

    el.querySelector('#search').oninput = (e) => {
      clearTimeout(searchTimer)
      searchTimer = setTimeout(() => {
        filters.search = e.target.value
        filters.page = 1
        load()
      }, 300)
    }

    el.querySelector('#reset-filters').onclick = () => {
      filters = { search: '', service_id: serviceId || '', page: 1, limit: 50 }
      load()
    }

    el.querySelector('#prev-page').onclick = () => { filters.page--; load() }
    el.querySelector('#next-page').onclick = () => { filters.page++; load() }
    el.querySelector('#add-item-btn').onclick = () => openModal()

    el.querySelectorAll('.accordion-trigger').forEach(td => {
      td.onclick = () => toggleAccordion(parseInt(td.dataset.id))
    })

    el.querySelectorAll('.edit-btn').forEach(btn => {
      btn.onclick = () => openModal(parseInt(btn.dataset.id))
    })

    el.querySelectorAll('.delete-btn').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Видалити?')) return
        await itemsApi.remove(btn.dataset.id)
        load()
      }
    })
  }

  const toggleAccordion = async (itemId) => {
    const row = el.querySelector(`#accordion-${itemId}`)
    const content = el.querySelector(`#accordion-content-${itemId}`)
    const trigger = el.querySelector(`.accordion-trigger[data-id="${itemId}"]`)

    if (openAccordions.has(itemId)) {
      openAccordions.delete(itemId)
      row.style.display = 'none'
      trigger.textContent = '▶'
      return
    }

    openAccordions.add(itemId)
    row.style.display = ''
    trigger.textContent = '▼'
    renderAccordion(itemId, content)
  }

const renderAccordion = async (itemId, container) => {
  container.innerHTML = '<span style="color:#999;padding:12px;display:block">Завантаження...</span>'
  const units = await unitsApi.getByItemId(itemId)

  const renderRows = (editingId = null) => {
    const tbody = container.querySelector('.units-tbody')
    if (!tbody) return

    tbody.innerHTML = units.length === 0
      ? `<tr><td colspan="9" class="empty">Немає одиниць</td></tr>`
      : units.map(u => {
        if (editingId === u.id) {
          return `
            <tr data-unit-id="${u.id}">
              <td><input class="unit-inline-input" name="serial_number" value="${u.serial_number || ''}" placeholder="Серійний номер" /></td>
              <td>
                <select class="unit-inline-select" name="status_id">
                  <option value="">—</option>
                  ${statuses.map(s => `<option value="${s.id}" ${u.status_id == s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                </select>
              </td>
              <td>
                <select class="unit-inline-select" name="location_id">
                  <option value="">—</option>
                  ${locations.map(l => `<option value="${l.id}" ${u.location_id == l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
                </select>
              </td>
              <td>
                <select class="unit-inline-select" name="counted">
                  <option value="true" ${u.counted ? 'selected' : ''}>Так</option>
                  <option value="false" ${!u.counted ? 'selected' : ''}>Ні</option>
                </select>
              </td>
              <td>
                <select class="unit-inline-select" name="available">
                  <option value="true" ${u.available ? 'selected' : ''}>Так</option>
                  <option value="false" ${!u.available ? 'selected' : ''}>Ні</option>
                </select>
              </td>
							<td>
								<div class="drive-field">
									<input class="unit-inline-input" name="invoice" value="${u.invoice || ''}" placeholder="Посилання..." readonly />
									<button class="btn-ghost drive-pick-btn" data-field="invoice" style="padding:4px 8px;font-size:11px">📁</button>
								</div>
							</td>
              <td>
								<div class="drive-field">
									<input class="unit-inline-input" name="report" value="${u.report || ''}" placeholder="Посилання..." readonly />
									<button class="btn-ghost drive-pick-btn" data-field="report" style="padding:4px 8px;font-size:11px">📁</button>
								</div>
							</td>
							<td>
								<div class="drive-field">
									<input class="unit-inline-input" name="journal_entry" value="${u.journal_entry || ''}" placeholder="Посилання..." readonly />
									<button class="btn-ghost drive-pick-btn" data-field="journal_entry" style="padding:4px 8px;font-size:11px">📁</button>
								</div>
							</td>
              <td><input class="unit-inline-input" name="note" value="${u.note || ''}" /></td>
              <td class="row-actions">
                <button class="btn-primary unit-save-btn" data-id="${u.id}" data-item-id="${itemId}">Зберегти</button>
                <button class="btn-ghost unit-cancel-btn">Скасувати</button>
              </td>
            </tr>
          `
        }

        return `
          <tr data-unit-id="${u.id}">
            <td>${u.serial_number || '—'}</td>
            <td>${u.status_name || '—'}</td>
            <td>${u.location_name || '—'}</td>
            <td>${u.counted ? '✓' : '✗'}</td>
            <td>${u.available ? '✓' : '✗'}</td>
						<td>${u.invoice ? `<a href="${u.invoice}" target="_blank" style="color:#2563eb;font-size:12px">Відкрити</a>` : '—'}</td>
						<td>${u.report ? `<a href="${u.report}" target="_blank" style="color:#2563eb;font-size:12px">Відкрити</a>` : '—'}</td>
						<td>${u.journal_entry ? `<a href="${u.journal_entry}" target="_blank" style="color:#2563eb;font-size:12px">Відкрити</a>` : '—'}</td>
            <td>${u.note || '—'}</td>
            <td class="row-actions">
              <button class="btn-ghost unit-edit-btn" data-id="${u.id}">Ред.</button>
              <button class="btn-danger unit-delete-btn" data-id="${u.id}" data-item-id="${itemId}">Вид.</button>
            </td>
          </tr>
        `
      }).join('')

    tbody.querySelectorAll('.unit-edit-btn').forEach(btn => {
      btn.onclick = () => renderRows(parseInt(btn.dataset.id))
    })

    tbody.querySelectorAll('.unit-cancel-btn').forEach(btn => {
      btn.onclick = () => renderRows(null)
		})

		tbody.querySelectorAll('.drive-pick-btn').forEach(btn => {
			btn.onclick = async () => {
				const field = btn.dataset.field
				const input = btn.closest('td').querySelector('input')
				await DrivePicker({
					field,
					onSelect: ({ link }) => { input.value = link },
					onClose: () => {}
				})
			}
		})

    tbody.querySelectorAll('.unit-save-btn').forEach(btn => {
      btn.onclick = async () => {
        const row = tbody.querySelector(`tr[data-unit-id="${btn.dataset.id}"]`)
        const data = {}
        row.querySelectorAll('[name]').forEach(input => {
          data[input.name] = input.value === '' ? null : input.value
        })
        data.counted = data.counted === 'true'
        data.available = data.available === 'true'

        await unitsApi.update(btn.dataset.id, data)
        const updated = await unitsApi.getByItemId(itemId)
        units.length = 0
        units.push(...updated)
        renderRows(null)
        load()
      }
    })

    tbody.querySelectorAll('.unit-delete-btn').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Видалити?')) return
        await unitsApi.remove(btn.dataset.itemId, btn.dataset.id)
        const updated = await unitsApi.getByItemId(itemId)
        units.length = 0
        units.push(...updated)
        renderRows(null)
        load()
      }
    })
  }

  container.innerHTML = `
    <div class="accordion-inner">
      <div class="accordion-add">
        <input type="text" class="unit-serial-input" placeholder="Серійний номер (необов'язково)" />
        <select class="unit-status-select">
          <option value="">— Статус</option>
          ${statuses.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
        <select class="unit-location-select">
          <option value="">— Локація</option>
          ${locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
        </select>
        <button class="btn-primary unit-add-btn" data-item-id="${itemId}">+ Додати</button>
      </div>
      <table class="units-table">
        <thead>
          <tr>
            <th>Серійний номер</th>
            <th>Статус</th>
            <th>Локація</th>
            <th>Рахується</th>
            <th>В наявності</th>
						<th>Накладна</th>
            <th>Рапорт</th>
            <th>Витяг з ЖБД</th>
            <th>Примітка</th>
            <th></th>
          </tr>
        </thead>
        <tbody class="units-tbody"></tbody>
      </table>
    </div>
  `

  container.querySelector('.unit-add-btn').onclick = async () => {
    const data = {
      serial_number: container.querySelector('.unit-serial-input').value || null,
      status_id: container.querySelector('.unit-status-select').value || null,
      location_id: container.querySelector('.unit-location-select').value || null,
    }
    await unitsApi.create(itemId, data)
    const updated = await unitsApi.getByItemId(itemId)
    units.length = 0
    units.push(...updated)
    renderRows(null)
    load()
  }

  renderRows(null)
}

const openModal = (id = null) => {
  const item = id ? items.find(i => i.id === id) : null
  const container = document.getElementById('modal-container')
  let parsedRows = []
  let mode = 'form' // 'form' | 'import'

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

  // ── СТАН 1: звичайна форма ──────────────────────────────────────────────────
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
          <div>
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

  // ── СТАН 2: імпорт з PDF ───────────────────────────────────────────────────
  const renderImportMode = () => `
    <div class="modal-import-top">
      <div class="form-group" style="min-width:220px">

        <select name="service_id">
          <option value="">— Оберіть службу</option>
          ${services.map(s => `<option value="${s.id}" ${serviceId == s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
      </div>
      <button class="btn-ghost" id="pick-invoice-btn" style="align-self:flex-end">📁 Вибрати PDF</button>
    </div>

    <div class="modal-body--split" style="flex:1;overflow:hidden">
      <!-- Ліво: PDF preview -->
      <div class="modal-pdf-panel" id="pdf-panel">
        <div class="pdf-placeholder" id="pdf-placeholder">
          <span>📄</span>
          <p>PDF preview з'явиться тут після вибору файлу</p>
        </div>
        <iframe id="pdf-iframe" style="display:none;width:100%;height:100%;border:none"></iframe>
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

  // ── bind events ─────────────────────────────────────────────────────────────
  const bindEvents = () => {
    container.querySelectorAll('.modal-close').forEach(btn => {
      btn.onclick = () => { container.innerHTML = '' }
    })

    // Перемикання в режим імпорту
    const switchBtn = container.querySelector('#btn-switch-import')
    if (switchBtn) {
      switchBtn.onclick = () => { mode = 'import'; renderModal() }
    }

    // Назад до форми
    const backBtn = container.querySelector('#btn-back-form')
    if (backBtn) {
      backBtn.onclick = () => { mode = 'form'; parsedRows = []; renderModal() }
    }

    // Зберегти один item (форма)
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

    // PDF picker
    const pickBtn = container.querySelector('#pick-invoice-btn')
    if (pickBtn) {
      pickBtn.onclick = async () => {
        await DrivePicker({
          field: 'invoice',
          onSelect: async ({ id: fileId, name }) => {
            // PDF preview
            const iframe = container.querySelector('#pdf-iframe')
            const placeholder = container.querySelector('#pdf-placeholder')
            if (iframe && placeholder) {
              iframe.src = `https://drive.google.com/file/d/${fileId}/preview`
              iframe.style.display = 'block'
              placeholder.style.display = 'none'
            }

            const statusEl = container.querySelector('#import-status')
            if (statusEl) statusEl.textContent = `⏳ Парсинг ${name}...`
            pickBtn.disabled = true

            const resultContainer = container.querySelector('#parsed-result')
            resultContainer.innerHTML = '<span style="color:#64748b;font-size:13px">⏳ Розпізнаю рядки...</span>'

            try {
              const { rows } = await driveApi.parseInvoice(fileId)
              parsedRows = rows.map(r => ({ ...r, _selected: true, quantity: r.qty_sent || 1 }))
              if (statusEl) statusEl.textContent = `📄 ${name}`
              renderParsedRows(resultContainer)
            } catch (e) {
              console.error('parse error:', e)
              resultContainer.innerHTML = '<span style="color:#ef4444;font-size:13px">Помилка парсингу</span>'
              if (statusEl) statusEl.textContent = 'Помилка'
            } finally {
              pickBtn.disabled = false
            }
          },
          onClose: () => {}
        })
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

        // Перевіряємо одиниці виміру
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
          for (let i = 0; i < qty; i++) {
            await unitsApi.create(newItem.id, {
              serial_number: null,
              status_id: null,
              location_id: null,
            })
          }
        }

        container.innerHTML = ''
        load()
      }
    }
  }

  // ── рендер таблиці розпізнаних рядків ───────────────────────────────────────
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
                <td><input class="unit-inline-input" data-idx="${idx}" data-field="name" value="${row.name || ''}" style="width:180px" /></td>
                <td><input class="unit-inline-input" data-idx="${idx}" data-field="nomenclature_code" value="${row.nomenclature_code || ''}" style="width:110px" /></td>
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

    // select all
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
 

  const load = async () => {
		const params = {}
		if (filters.search) params.search = filters.search
		if (filters.service_id) params.service_id = filters.service_id
		params.page = filters.page
		params.limit = filters.limit

		const result = await itemsApi.getAll(params)
		items = result.items
		total = result.total
		render()

		const searchInput = el.querySelector('#search')
		if (filters.search && searchInput) {
			searchInput.focus()
			searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length)
		}

		if (filters.search) {
			for (const item of items) {
				openAccordions.add(item.id)
				const row = el.querySelector(`#accordion-${item.id}`)
				const content = el.querySelector(`#accordion-content-${item.id}`)
				const trigger = el.querySelector(`.accordion-trigger[data-id="${item.id}"]`)
				if (row) row.style.display = ''
				if (trigger) trigger.textContent = '▼'
				if (content) await renderAccordion(item.id, content)
			}
		}
	}

  const init = async () => {
		;[statuses, locations, services, unitsOfMeasure] = await Promise.all([
			statusesApi.getAll(),
			locationsApi.getAll(),
			servicesApi.getAll(),
			unitsOfMeasureApi.getAll(),
		])
		load()
	}

  init()
  return el
}