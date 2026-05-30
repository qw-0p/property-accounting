import { ItemsPage } from './pages/items.js'
import { DictPage } from './pages/dict.js'
import { dictApi } from './api/dict.js'

const servicesApi = dictApi('services')

const routes = {
  '#/items': () => ItemsPage({}),
  '#/statuses': () => DictPage({ resource: 'statuses', title: 'Статуси' }),
  '#/locations': () => DictPage({ resource: 'locations', title: 'Локації' }),
  '#/services': () => DictPage({ resource: 'services', title: 'Служби' }),
}

const main = document.getElementById('main')
const servicesList = document.getElementById('services-list')

async function loadServices() {
  const services = await servicesApi.getAll()
  servicesList.innerHTML = services.map(s =>
    `<a href="#/items/${s.id}">${s.name}</a>`
  ).join('')
  updateActive()
}

function navigate() {
  const hash = location.hash || '#/items'

  updateActive()

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
loadServices().then(navigate)