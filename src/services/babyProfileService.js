import { IOT_API_BASE_URL as API_BASE } from '../config/iotApiBase'

const BABY_PROFILES_KEY = 'sbm_baby_profiles'
const ACTIVE_BABY_KEY = 'sbm_active_baby_id'

export const ACCENT_BY_GENDER = {
  boy: {
    accent: '#06b6d4',
    accentSoft: '#cffafe',
    accentText: '#0e7490',
  },
  girl: {
    accent: '#f472b6',
    accentSoft: '#fce7f3',
    accentText: '#be185d',
  },
}

function safeParse(raw, fallback) {
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function getToken() {
  return localStorage.getItem('sbm_jwt_token')
}

function authHeaders() {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

async function parseJsonOrThrow(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Request failed')
  return data
}

export function loadBabyProfiles() {
  const raw = localStorage.getItem(BABY_PROFILES_KEY)
  if (!raw) return []
  const parsed = safeParse(raw, [])
  if (!Array.isArray(parsed)) return []
  return parsed
}

export function saveBabyProfiles(profiles) {
  localStorage.setItem(BABY_PROFILES_KEY, JSON.stringify(profiles))
}

export function loadActiveBabyId() {
  return localStorage.getItem(ACTIVE_BABY_KEY)
}

export function saveActiveBabyId(id) {
  localStorage.setItem(ACTIVE_BABY_KEY, id)
}

export function addBabyProfile(existing, payload) {
  const next = [
    ...existing,
    {
      id: `b_${Date.now()}`,
      name: payload.name.trim(),
      gender: payload.gender === 'girl' ? 'girl' : 'boy',
      dob: payload.dob,
      twinLabel: payload.twinLabel || '',
    },
  ]
  saveBabyProfiles(next)
  return next
}

export function pickActiveBaby(profiles, activeId) {
  return profiles.find((b) => b.id === activeId) || profiles[0] || null
}

export async function getBabies() {
  const res = await fetch(`${API_BASE}/api/babies`, {
    headers: authHeaders(),
  })
  const data = await parseJsonOrThrow(res)
  const mapped = (data.babies || []).map((b) => ({
    id: b.id,
    name: b.babyName,
    gender: b.gender,
    dob: b.dob,
    twinLabel: b.twinLabel || '',
    isActive: Boolean(b.isActive),
  }))
  saveBabyProfiles(mapped)
  return mapped
}

export async function addBaby(payload) {
  const res = await fetch(`${API_BASE}/api/babies`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      babyName: payload.name,
      gender: payload.gender,
      dob: payload.dob,
      twinLabel: payload.twinLabel || '',
    }),
  })
  const data = await parseJsonOrThrow(res)
  return {
    id: data.baby.id,
    name: data.baby.babyName,
    gender: data.baby.gender,
    dob: data.baby.dob,
    twinLabel: data.baby.twinLabel || '',
    isActive: Boolean(data.baby.isActive),
  }
}

export async function switchBaby(id) {
  const res = await fetch(`${API_BASE}/api/babies/${id}/activate`, {
    method: 'PATCH',
    headers: authHeaders(),
  })
  const data = await parseJsonOrThrow(res)
  return {
    id: data.baby.id,
    name: data.baby.babyName,
    gender: data.baby.gender,
    dob: data.baby.dob,
    twinLabel: data.baby.twinLabel || '',
    isActive: Boolean(data.baby.isActive),
  }
}

