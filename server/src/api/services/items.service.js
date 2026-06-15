const dal = require('../dal/items.dal')

const getAll = async (query) => {
  const limit = parseInt(query.limit) || 50
  const page = parseInt(query.page) || 1
  const offset = (page - 1) * limit

  return dal.getAll({
    search: query.search,
    service_id: query.service_id,
    limit,
    offset,
  })
}

const getById = async (id) => {
  const item = await dal.getById(id)
  if (!item) throw { status: 404, message: 'Item not found' }
  return item
}

const toNum = (v) => (v === null || v === undefined || v === '') ? null : Number(v)

const LAT_MAP = { a: 'а', c: 'с', e: 'е', i: 'і', o: 'о', p: 'р', x: 'х', h: 'н', b: 'в', k: 'к', m: 'м', t: 'т' }
const normName = (s) => (s || '').trim().toLowerCase().replace(/[aceioprxhbkmt]/g, ch => LAT_MAP[ch] ?? ch)

// Ціна — частина ідентичності item. Різна ціна = різний item.
const priceEq = (a, b) => {
  const x = toNum(a), y = toNum(b)
  if (x === null && y === null) return true
  if (x === null || y === null) return false
  return Math.abs(x - y) < 1e-9
}

// Повертає { exact, conflicts }.
// Ключ ідентичності item = назва + КН + ціна.
//  - ціна задана: exact лише при збігу всіх трьох; та сама назва+КН з іншою ціною → інший item (нове)
//  - ціна порожня: розрізнити за ціною не можна →
//       один збіг назва+КН  → exact (доливаємо)
//       кілька (різні ціни) → conflict (обрати варіант або створити нове)
//  - частковий збіг (лише назва АБО лише код) → conflict (matchedOn: 'name' | 'code')
const lookup = async ({ name, nomenclature_code, price }) => {
  const candidates = await dal.findMatches(name, nomenclature_code)
  const nm = normName(name)
  const cd = (nomenclature_code || '').trim()
  const pin = toNum(price)

  let exact = null
  const conflicts = []
  const strongMatches = [] // збіг назва+КН (для випадку порожньої ціни)

  for (const it of candidates) {
    const inm = normName(it.name)
    const icd = (it.nomenclature_code || '').trim()
    const nameEq = !!nm && inm === nm
    const codeEq = !!cd && icd === cd
    const bothNoCode = !cd && !icd
    const strong = nameEq && (codeEq || bothNoCode)

    if (strong) {
      if (pin === null) { strongMatches.push(it); continue }
      if (priceEq(pin, it.price)) { exact = it; break }
      continue // ціна задана й інша → інший item
    }
    if (nameEq || codeEq) conflicts.push({ ...it, matchedOn: nameEq ? 'name' : 'code' })
  }

  if (exact) return { exact, conflicts: [] }

  // Порожня ціна: вирішуємо за кількістю збігів назва+КН
  if (pin === null && strongMatches.length) {
    if (strongMatches.length === 1) return { exact: strongMatches[0], conflicts: [] }
    return { exact: null, conflicts: strongMatches.map(it => ({ ...it, matchedOn: 'price' })) }
  }

  return { exact: null, conflicts }
}

const create = async (data) => {
  if (!data.name) throw { status: 400, message: 'Name is required' }
  if (!data.unit_of_measure_id) throw { status: 400, message: 'Unit of measure is required' }
  return dal.create(data)
}

const update = async (id, data) => {
  const item = await dal.update(id, data)
  if (!item) throw { status: 404, message: 'Item not found' }
  return item
}

const merge = async (id, targetId) => {
  if (String(id) === String(targetId)) throw { status: 400, message: 'Cannot merge item with itself' }
  await dal.reassignUnits(id, targetId)
  await dal.remove(id)
  return dal.getById(targetId)
}

const remove = async (id) => {
  const item = await dal.remove(id)
  if (!item) throw { status: 404, message: 'Item not found' }
  return item
}

module.exports = { getAll, getById, lookup, create, update, remove, merge }