import { ItemsPage } from './pages/items.js'
import { DictPage } from './pages/dict.js'
import { InvoiceImportPage } from './pages/invoice-import.js'
import { dictApi } from './api/dict.js'
import { driveApi } from './api/drive.js'

const servicesApi = dictApi('services')

const routes = {
  '#/items': () => ItemsPage({}),
  '#/statuses': () => DictPage({ resource: 'statuses', title: 'Статуси' }),
  '#/locations': () => DictPage({ resource: 'locations', title: 'Локації' }),
  '#/services': () => DictPage({ resource: 'services', title: 'Служби' }),
  '#/units-of-measure': () => DictPage({ resource: 'units-of-measure', title: 'Одиниці виміру' }),
  '#/items/import': () => InvoiceImportPage(),
}

const main = document.getElementById('main')
const servicesList = document.getElementById('services-list')
const authContainer = document.getElementById('auth-btn-container')

const navToggle = document.getElementById('nav-toggle')
const navOverlay = document.getElementById('nav-overlay')
const nav = document.querySelector('nav')

const closeNav = () => document.body.classList.remove('nav-open')
navToggle.onclick = () => document.body.classList.toggle('nav-open')
navOverlay.onclick = closeNav
nav.addEventListener('click', (e) => { if (e.target.closest('a')) closeNav() })

function renderAuthBtn() {
  if (driveApi.isAuthorized()) {
    authContainer.innerHTML = `<button class="nav-auth nav-auth-logout" id="logout-btn">⬡ Вийти з Google</button>`
    authContainer.querySelector('#logout-btn').onclick = () => {
      localStorage.removeItem('google_access_token')
      localStorage.removeItem('google_refresh_token')
      renderAuthBtn()
      navigate()
    }
  } else {
    authContainer.innerHTML = `<button class="nav-auth nav-auth-login" id="login-btn">↗ Увійти через Google</button>`
    authContainer.querySelector('#login-btn').onclick = () => driveApi.authorize()
  }
}

async function loadServices() {
  const services = await servicesApi.getAll()
  servicesList.innerHTML = services.map(s =>
    `<a href="#/items/${s.id}">${s.name}</a>`
  ).join('')
  updateActive()
}

function renderLoginRequired() {
  main.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:16px;color:#64748b">
      <div style="font-size:48px">🔒</div>
      <div style="font-size:18px;font-weight:500;color:#1a1a1a">Потрібна авторизація</div>
      <div style="font-size:14px">Увійдіть через Google щоб продовжити</div>
      <button class="btn-primary" onclick="document.getElementById('login-btn').click()">Увійти через Google</button>
    </div>
  `
}

function navigate() {
  const hash = location.hash || '#/items'

  if (hash.startsWith('#/auth/callback')) {
    const params = new URLSearchParams(location.hash.split('?')[1])
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (access_token) {
      localStorage.setItem('google_access_token', access_token)
      if (refresh_token) localStorage.setItem('google_refresh_token', refresh_token)
    }
    renderAuthBtn()
    location.hash = '#/items'
    return
  }

  updateActive()

  if (!driveApi.isAuthorized()) {
    renderLoginRequired()
    return
  }

  const serviceMatch = hash.match(/^#\/items\/(\d+)$/)
  if (serviceMatch) {
    main.innerHTML = ''
    main.appendChild(ItemsPage({ serviceId: parseInt(serviceMatch[1]) }))
    return
  }

  const page = routes[hash]
  if (page) {
    main.innerHTML = ''
    main.appendChild(page())
  }
}

function updateActive() {
  const hash = location.hash || '#/items'
  document.querySelectorAll('nav a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === hash)
  })
}

window.addEventListener('hashchange', navigate)
loadServices().then(() => {
  renderAuthBtn()
  navigate()
})