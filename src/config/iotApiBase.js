/** Express iot-api origin. Must match `npm run dev` in `iot-api` (see `.env` PORT). */
export const IOT_API_BASE_URL = import.meta.env.VITE_IOT_API_BASE_URL || 'http://127.0.0.1:4000'

/** Must match `API_KEY` in `iot-api/.env` — required for `/api/readings/*` from the browser. */
export const IOT_API_KEY = import.meta.env.VITE_IOT_API_KEY || 'my_secret_api_key_123'

/** GET/POST to iot-api routes under `/api/readings` (sensor + ML proxy). */
export function readingsApiFetch(path, init = {}) {
  const headers = new Headers(init.headers ?? undefined)
  if (!headers.has('X-API-Key')) headers.set('X-API-Key', IOT_API_KEY)
  return fetch(`${IOT_API_BASE_URL}${path}`, { ...init, headers })
}

/**
 * ML + sensor readings from the browser.
 * - **Dev:** same-origin `/api/readings/...` so Vite can proxy and attach `X-API-Key` (see `vite.config.js`).
 * - **Prod / preview:** full URL + `X-API-Key` (set `VITE_IOT_API_*` before `npm run build`).
 */
export function mlReadingsFetch(path) {
  const rel = path.startsWith('/') ? path : `/${path}`
  if (import.meta.env.DEV) {
    return fetch(rel)
  }
  return readingsApiFetch(rel)
}
