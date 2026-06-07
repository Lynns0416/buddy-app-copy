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
