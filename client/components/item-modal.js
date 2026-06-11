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
          <button class="btn-primary" id="modal-save">Зберегти</button>
        </div>
      </div>
    </div>
  `

  const close = () => { container.innerHTML = '' }
  container.querySelectorAll('.modal-close').forEach(btn => { btn.onclick = close })

  container.querySelector('#modal-save').onclick = async () => {
    const data = {}
    container.querySelectorAll('[name]').forEach(input => {
      data[input.name] = input.value === '' ? null : input.value
    })
    if (!data.name) { alert('Введіть найменування'); return }
    if (!data.service_id) { alert('Оберіть службу'); return }

    if (item) await itemsApi.update(item.id, data)
    else await itemsApi.create(data)

    close()
    load()
  }
}