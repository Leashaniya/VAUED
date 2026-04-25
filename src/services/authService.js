import { IOT_API_BASE_URL as API_BASE } from '../config/iotApiBase'
const TOKEN_KEY = 'sbm_jwt_token'
const USER_KEY = 'sbm_auth_user'

function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

async function parseJsonOrThrow(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const base = data?.error || 'Request failed'
    if (res.status === 409) return Promise.reject(new Error(base || 'This email is already registered.'))
    if (res.status === 401) return Promise.reject(new Error(base || 'Invalid email or password.'))
    return Promise.reject(new Error(base))
  }
  return data
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function isAuthenticated() {
  return Boolean(getToken())
}

export function getSessionUser() {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await parseJsonOrThrow(res)
  setSession(data.token, data.user)
  return data.user
}

export async function register({ name, email, password }) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  })
  const data = await parseJsonOrThrow(res)
  setSession(data.token, data.user)
  return data.user
}

export async function getCurrentUser() {
  const token = getToken()
  if (!token) return null
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await parseJsonOrThrow(res)
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  return data.user
}

export function logoutSession() {
  clearSession()
}

