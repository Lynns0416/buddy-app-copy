import { firebaseAuth } from './firebase'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export class ApiError extends Error {
  details?: { formErrors: string[]; fieldErrors: Record<string, string[]> }
  status: number
  constructor(message: string, status: number, details?: ApiError['details']) {
    super(message)
    this.status = status
    this.details = details
  }
}

async function getToken(): Promise<string | null> {
  const user = firebaseAuth.currentUser
  if (!user) return null
  return user.getIdToken()
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new ApiError(body.error ?? 'Request failed', res.status, body.details)
  }

  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { method: 'POST', body: formData, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new ApiError(body.error ?? 'Request failed', res.status, body.details)
  }

  return res.json() as Promise<T>
}

// For a file response (e.g. .ics), not JSON — a plain <a href> can't carry the
// bearer token, so the caller fetches the blob itself and hands it to the
// browser via triggerBlobDownload.
export async function apiDownload(path: string): Promise<Blob> {
  const token = await getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new ApiError(body.error ?? 'Request failed', res.status, body.details)
  }

  return res.blob()
}

// The blob URL must stay alive until the browser has finished reading it, and
// the read happens after the click task returns — revoking in the same tick
// can abort the save. The anchor is attached to the document for the same
// reason: a detached one is not reliably actionable outside Chromium. Both are
// cleaned up on a later task; the delay matches FileSaver.js's, which is the
// battle-tested value for "long enough that the download has certainly
// started".
const REVOKE_DELAY_MS = 40_000

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    link.remove()
    URL.revokeObjectURL(url)
  }, REVOKE_DELAY_MS)
}
