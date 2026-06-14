const BASE_URL = ''

const refreshToken = async () => {
  const refresh_token = localStorage.getItem('google_refresh_token')
  if (!refresh_token) return false

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  })
  const data = await res.json()
  if (data.access_token) {
    localStorage.setItem('google_access_token', data.access_token)
    return true
  }
  return false
}

const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('google_access_token')
  const res = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` }
  })

  if (res.status === 401) {
    const refreshed = await refreshToken()
    if (refreshed) {
      const newToken = localStorage.getItem('google_access_token')
      return fetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${newToken}` }
      })
    }
  }
  return res
}

export const driveApi = {
  getToken: () => localStorage.getItem('google_access_token'),
  isAuthorized: () => !!localStorage.getItem('google_access_token'),
  authorize: () => { window.location.href = `${BASE_URL}/auth/google` },

  getFiles: async (folderId = null) => {
		const params = new URLSearchParams()
		if (folderId) params.append('folder_id', folderId)
		const res = await fetchWithAuth(`${BASE_URL}/drive/files?${params}`)
		return res.json()
	},

	getFolders: async () => {
		const res = await fetch(`${BASE_URL}/drive/folders`)
		return res.json()
	},

	parseInvoice: async (fileId) => {
		const res = await fetchWithAuth(`${BASE_URL}/parse/invoice`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ file_id: fileId }),
		})
		return res.json()
  },
  parseManual: async ({ file_id, page, grid }) => {
    const res = await fetchWithAuth(`${BASE_URL}/parse/invoice/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id, page, grid }),
    })
    return res.json()
  },
}