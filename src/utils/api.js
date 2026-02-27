const BASE = '/.netlify/functions'

export async function apiPost(path, body, token) {
  const reqHeaders = { 'Content-Type': 'application/json' }
  if (token) reqHeaders['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify(body)
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export async function apiPatch(path, body, token) {
  const reqHeaders = { 'Content-Type': 'application/json' }
  if (token) reqHeaders['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}/${path}`, {
    method: 'PATCH',
    headers: reqHeaders,
    body: JSON.stringify(body)
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}
