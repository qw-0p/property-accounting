import { dictApi } from '../api/dict.js'

export function DictPage({ resource, title }) {
  const api = dictApi(resource)
  const el = document.createElement('div')

  let items = []
  let editingId = null

  const render = () => {
    el.innerHTML = `
      <h1>${title}</h1>
      <div class="dict-add">
        <input type="text" id="dict-input" placeholder="Назва..." />
        <button class="btn-primary" id="dict-add-btn">Додати</button>
      </div>
      <ul class="dict-list">
        ${items.map(item => `
          <li class="dict-item" data-id="${item.id}">
            ${editingId === item.id
              ? `<input type="text" class="dict-edit-input" value="${item.name}" data-id="${item.id}" />`
              : `<span>${item.name}</span>`
            }
            <div class="dict-actions">
              ${editingId === item.id
                ? `<button class="btn-primary dict-save-btn" data-id="${item.id}">Зберегти</button>
                   <button class="btn-ghost dict-cancel-btn">Скасувати</button>`
                : `<button class="btn-ghost dict-edit-btn" data-id="${item.id}">Редагувати</button>
                   <button class="btn-danger dict-delete-btn" data-id="${item.id}">Видалити</button>`
              }
            </div>
          </li>
        `).join('')}
      </ul>
    `
    bindEvents()
  }

  const bindEvents = () => {
    el.querySelector('#dict-add-btn').onclick = async () => {
      const input = el.querySelector('#dict-input')
      const name = input.value.trim()
      if (!name) return
      await api.create(name)
      input.value = ''
      await load()
    }

    el.querySelectorAll('.dict-edit-btn').forEach(btn => {
      btn.onclick = () => {
        editingId = parseInt(btn.dataset.id)
        render()
      }
    })

    el.querySelectorAll('.dict-save-btn').forEach(btn => {
      btn.onclick = async () => {
        const input = el.querySelector('.dict-edit-input')
        const name = input.value.trim()
        if (!name) return
        await api.update(btn.dataset.id, name)
        editingId = null
        await load()
      }
    })

    el.querySelectorAll('.dict-cancel-btn').forEach(btn => {
      btn.onclick = () => {
        editingId = null
        render()
      }
    })

    el.querySelectorAll('.dict-delete-btn').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Видалити?')) return
        await api.remove(btn.dataset.id)
        await load()
      }
    })
  }

  const load = async () => {
    items = await api.getAll()
    render()
  }

  load()
  return el
}