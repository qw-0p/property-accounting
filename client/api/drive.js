const BASE_URL = 'http://localhost:3000'

export const driveApi = {
  getToken: () => localStorage.getItem('google_access_token'),
  isAuthorized: () => !!localStorage.getItem('google_access_token'),
  authorize: () => { window.location.href = `${BASE_URL}/auth/google` },

  getFiles: async (folderId = null) => {
    const token = localStorage.getItem('google_access_token')
    const params = new URLSearchParams()
    if (folderId) params.append('folder_id', folderId)

    const res = await fetch(`${BASE_URL}/drive/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.json()
	},

	getFolders: async () => {
		const res = await fetch(`${BASE_URL}/drive/folders`)
		return res.json()
	},
}