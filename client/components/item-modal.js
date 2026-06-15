const esc = (s) => String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export const openModal = (id = null, ctx = {}) => {
  const { items = [], unitsOfMeasure = [], services = [], serviceId, itemsApi, load } = ctx
  const item = id ? items.find(i => i.id === id) : null
  const container = document.getElementById('modal-container')

  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal modal--form" style="width:760px;height:auto;max-height:90vh">
        <div class="modal-header">
          <h2>${item ? 'Редагувати майно' : 'Додати майно'}</h2>
          <button class="btn-ghost modal-close">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>Найменування *</label>
            <input type="text" name="name" value="${esc(item?.name || '')}" />
          </div>
          <div class="form-group">
            <label>Найменування згідно накладної</label>
            <input type="text" name="invoice_name" value="${esc(item?.invoice_name || '')}" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Одиниця виміру *</label>
              <select name="unit_of_measure_id">
                <option value="">— Оберіть</option>
                ${unitsOfMeasure.map(u => `<option value="${u.id}" ${item?.unit_of_measure_id == u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Код номенклатури (КН)</label>
              <input type="text" name="nomenclature_code" value="${esc(item?.nomenclature_code || '')}" placeholder="наприклад: 6/42" />
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
                ${services.map(s => `<option value="${s.id}" ${item?.service_id == s.id || serviceId == s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div id="dup-warning" style="display:none"></div>
        </div>

        <div class="modal-footer">
          <button class="btn-ghost modal-close">Скасувати</button>
          <button class="btn-primary" id="modal-save">Зберегти</button>
        </div>
      </div>
    </div>
  `

  const close = () => { container.innerHTML = '' }
  container.querySelectorAll('.modal-close').forEach(btn => { btn.onclick = close })

  const collect = () => {
    const data = {}
    container.querySelectorAll('[name]').forEach(input => {
      data[input.name] = input.value === '' ? null : input.value
    })
    if (!data.name) { alert('Введіть найменування'); return null }
    if (!data.unit_of_measure_id) { alert('Оберіть одиницю виміру'); return null }
    if (!data.service_id) { alert('Оберіть службу'); return null }
    return data
  }

  const showDupWarning = (matches) => {
    const box = container.querySelector('#dup-warning')
    box.style.display = ''
    box.innerHTML = `
      <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:12px;font-size:13px;color:#9a3412">
        <div style="font-weight:600;margin-bottom:6px">⚠️ Можливий дубль</div>
        <div>Уже є схоже майно:</div>
        <ul style="margin:6px 0 10px 18px">
          ${matches.map((m, i) => `<li data-idx="${i}">${esc(m.name)} / КН: ${esc(m.nomenclature_code || '—')} / ${m.price ?? '—'}${m.service_name ? ` (${esc(m.service_name)})` : ''}${item ? ` <button class="btn-ghost dup-merge-btn" data-idx="${i}" style="padding:2px 8px;font-size:12px;color:#b45309">Об'єднати →</button>` : ''}</li>`).join('')}
        </ul>
        <div style="display:flex;gap:8px">
          <button class="btn-ghost" id="dup-cancel">Скасувати</button>
          <button class="btn-primary" id="dup-force">Все одно зберегти</button>
        </div>
      </div>
    `
    box.querySelector('#dup-cancel').onclick = () => { box.style.display = 'none'; box.innerHTML = '' }
    box.querySelector('#dup-force').onclick = () => doSave(true)
    box.querySelectorAll('.dup-merge-btn').forEach(btn => {
      btn.onclick = async () => {
        const target = matches[parseInt(btn.dataset.idx)]
        if (!confirm(`Перемістити всі одиниці з «${item.name}» до «${target.name}» і видалити поточний?`)) return
        await itemsApi.merge(item.id, target.id)
        close()
        load()
      }
    })
  }

  const doSave = async (skipDupCheck = false) => {
    const data = collect()
    if (!data) return

    if (!skipDupCheck) {
      const { exact, conflicts } = await itemsApi.lookup({
        name: data.name,
        nomenclature_code: data.nomenclature_code,
        price: data.price,
      })
      const matches = [exact, ...(conflicts || [])]
        .filter(Boolean)
        .filter(m => !item || m.id !== item.id)
      if (matches.length) { showDupWarning(matches); return }
    }

    if (item) await itemsApi.update(item.id, data)
    else await itemsApi.create(data)

    close()
    load()
  }

  container.querySelector('#modal-save').onclick = () => doSave(false)
}