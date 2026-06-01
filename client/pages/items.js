import { itemsApi } from '../api/items.js'
import { dictApi } from '../api/dict.js'
import { unitsApi } from '../api/units.js'
import { DrivePicker } from '../components/drive-picker.js'

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
              <th>Кількість</th>
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
                  <td>${item.total_quantity} (${item.available_quantity} в наявності)</td>
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

  const openUnitModal = (unitId, itemId, container) => {
    const modalContainer = document.getElementById('modal-container')
    const units = container.querySelectorAll('tbody tr')
    const row = container.querySelector(`tr[data-unit-id="${unitId}"]`)

    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h2>Редагувати одиницю</h2>
            <button class="btn-ghost modal-close">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Серійний номер</label>
              <input type="text" name="serial_number" value="${row?.cells[0].textContent === '—' ? '' : row?.cells[0].textContent || ''}" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Статус</label>
                <select name="status_id">
                  <option value="">—</option>
                  ${statuses.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Локація</label>
                <select name="location_id">
                  <option value="">—</option>
                  ${locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Рахується</label>
                <select name="counted">
                  <option value="true">Так</option>
                  <option value="false">Ні</option>
                </select>
              </div>
              <div class="form-group">
                <label>В наявності</label>
                <select name="available">
                  <option value="true">Так</option>
                  <option value="false">Ні</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Рапорт</label>
              <input type="text" name="report" value="" />
            </div>
            <div class="form-group">
              <label>Витяг з ЖБД</label>
              <input type="text" name="journal_entry" value="" />
            </div>
            <div class="form-group">
              <label>Примітка</label>
              <textarea name="note" rows="3"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-ghost modal-close">Скасувати</button>
            <button class="btn-primary" id="unit-modal-save">Зберегти</button>
          </div>
        </div>
      </div>
    `

    modalContainer.querySelectorAll('.modal-close').forEach(btn => {
      btn.onclick = () => { modalContainer.innerHTML = '' }
    })

    modalContainer.querySelector('#unit-modal-save').onclick = async () => {
      const data = {}
      modalContainer.querySelectorAll('[name]').forEach(input => {
        data[input.name] = input.value === '' ? null : input.value
      })
      data.counted = data.counted === 'true'
      data.available = data.available === 'true'

      await unitsApi.update(unitId, data)
      modalContainer.innerHTML = ''
      renderAccordion(itemId, container)
      load()
    }
  }

  const openModal = (id = null) => {
    const item = id ? items.find(i => i.id === id) : null
    const container = document.getElementById('modal-container')

    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h2>${item ? 'Редагувати' : 'Додати майно'}</h2>
            <button class="btn-ghost modal-close">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Найменування *</label>
              <input type="text" name="name" value="${item?.name || ''}" />
            </div>
            <div class="form-group">
              <label>Найменування згідно накладної</label>
              <input type="text" name="invoice_name" value="${item?.invoice_name || ''}" />
            </div>
						<div class="form-group">
							<label>Служба *</label>
							<select name="service_id">
								<option value="">- Оберіть службу</option>
								${services.map(s => `<option value="${s.id}" ${item?.service_id == s.id || serviceId == s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
							</select>
						</div>
						<div class="form-group">
							<label>Одиниця виміру *</label>
							<select name="unit_of_measure_id">
								<option value="">— Оберіть</option>
								${unitsOfMeasure.map(u => `<option value="${u.id}" ${item?.unit_of_measure_id == u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
							</select>
						</div>
          </div>
          <div class="modal-footer">
            <button class="btn-ghost modal-close">Скасувати</button>
            <button class="btn-primary" id="modal-save">Зберегти</button>
          </div>
        </div>
      </div>
    `

    container.querySelectorAll('.modal-close').forEach(btn => {
      btn.onclick = () => { container.innerHTML = '' }
    })

		container.querySelector('#modal-save').onclick = async () => {
			const data = {}
			container.querySelectorAll('[name]').forEach(input => {
				data[input.name] = input.value === '' ? null : input.value
			})

			if (!data.service_id) {
				alert('Оберіть службу')
				return
			}

			if (item) {
				await itemsApi.update(item.id, data)
			} else {
				await itemsApi.create(data)
			}

			container.innerHTML = ''
			load()
		}
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