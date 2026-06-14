// client/api/units.js
const BASE_URL = ''

export const unitsApi = {
  getByItemId: async (itemId) => {
    const res = await fetch(`${BASE_URL}/items/${itemId}/units`)
    return res.json()
  },
  create: async (itemId, data) => {
    const res = await fetch(`${BASE_URL}/items/${itemId}/units`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return res.json()
  },
  update: async (unitId, data) => {
    const res = await fetch(`${BASE_URL}/units/${unitId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return res.json()
  },
  remove: async (itemId, id) => {
    const res = await fetch(`${BASE_URL}/items/${itemId}/units/${id}`, {
      method: 'DELETE',
    })
    return res.json()
  },
}