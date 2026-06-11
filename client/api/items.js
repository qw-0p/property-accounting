const BASE_URL = 'http://localhost:3000'

export const itemsApi = {
  getAll: async (params = {}) => {
    const query = new URLSearchParams(params).toString()
    const res = await fetch(`${BASE_URL}/items?${query}`)
    return res.json()
  },
  getById: async (id) => {
    const res = await fetch(`${BASE_URL}/items/${id}`)
    return res.json()
  },
  lookup: async (data) => {
    const res = await fetch(`${BASE_URL}/items/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return res.json()
  },
  create: async (data) => {
    const res = await fetch(`${BASE_URL}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return res.json()
  },
  update: async (id, data) => {
    const res = await fetch(`${BASE_URL}/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return res.json()
  },
  remove: async (id) => {
    const res = await fetch(`${BASE_URL}/items/${id}`, {
      method: 'DELETE',
    })
    return res.json()
  },
}