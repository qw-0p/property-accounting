import { driveApi } from '../api/drive.js'

export async function DrivePicker({ field, onSelect, onClose }) {
  const el = document.createElement('div')
  let folderStack = []

  const folders = await driveApi.getFolders()
  const rootFolderId = folders[field] || null

  if (rootFolderId) {
    folderStack = [{ id: rootFolderId, name: 'Папка' }]
  }

  const render = async () => {
    const currentFolder = folderStack[folderStack.length - 1] || null

    el.innerHTML = `
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h2>Вибрати файл</h2>
            <button class="btn-ghost modal-close">✕</button>
          </div>
          <div class="modal-body" style="padding:0">
            <div class="drive-toolbar">
              ${folderStack.length > (rootFolderId ? 1 : 0)
        ? `<button class="btn-ghost drive-back-btn">← Назад</button>`
        : ''
      }
              <span class="drive-path">${folderStack.map(f => f.name).join(' / ') || 'Мій диск'}</span>
            </div>
            <div id="drive-files" style="padding:16px;min-height:200px">
              <span style="color:#999">Завантаження...</span>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-ghost modal-close">Скасувати</button>
          </div>
        </div>
      </div>
    `

    el.querySelectorAll('.modal-close').forEach(btn => {
      btn.onclick = () => { el.remove(); onClose && onClose() }
    })

    const backBtn = el.querySelector('.drive-back-btn')
    if (backBtn) {
      backBtn.onclick = () => {
        folderStack.pop()
        render()
      }
    }

    await loadFiles(currentFolder?.id || null)
  }

  const loadFiles = async (folderId) => {
    const container = el.querySelector('#drive-files')
    try {
      const files = await driveApi.getFiles(folderId)

      if (!files || files.length === 0) {
        container.innerHTML = '<span style="color:#999;font-size:13px">Немає файлів</span>'
        return
      }

      container.innerHTML = `
        <div class="drive-files-list">
          ${files.map(f => `
            <div class="drive-file-item" 
              data-id="${f.id}" 
              data-name="${f.name}" 
              data-link="${f.webViewLink || ''}" 
              data-mime="${f.mimeType}">
              <span class="drive-file-icon">${f.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄'}</span>
              <span class="drive-file-name">${f.name}</span>
            </div>
          `).join('')}
        </div>
      `

      container.querySelectorAll('.drive-file-item').forEach(item => {
        item.onclick = () => {
          const mime = item.dataset.mime
          if (mime === 'application/vnd.google-apps.folder') {
            folderStack.push({ id: item.dataset.id, name: item.dataset.name })
            render()
          } else {
            onSelect({ id: item.dataset.id, name: item.dataset.name, link: item.dataset.link })
            el.remove()
          }
        }
      })
    } catch (e) {
      container.innerHTML = '<span style="color:#ef4444;font-size:13px">Помилка завантаження</span>'
    }
  }

  document.body.appendChild(el)
  render()
  return el
}