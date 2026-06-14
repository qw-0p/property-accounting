const BASE_URL = ''

export const dictApi = (resource) => ({
  getAll: async () => {
    const res = await fetch(`${BASE_URL}/${resource}`)
    return res.json()
  },
  create: async (name) => {
    const res = await fetch(`${BASE_URL}/${resource}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    return res.json()
  },
  update: async (id, name) => {
    const res = await fetch(`${BASE_URL}/${resource}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    return res.json()
  },
  remove: async (id) => {
    const res = await fetch(`${BASE_URL}/${resource}/${id}`, {
      method: 'DELETE',
    })
    return res.json()
  },
})