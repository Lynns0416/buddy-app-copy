'use client'

import { useState } from 'react'
import type { BuddyProfileResponse, AppError } from '@peace-buddy/types'
import { uploadProfilePhoto, deleteProfilePhoto } from '../dashboard.profile'

type UploadState = 'idle' | 'uploading' | 'deleting'

export function usePhotoUpload(onSuccess: (profile: BuddyProfileResponse) => void) {
  const [state, setState] = useState<UploadState>('idle')
  const [error, setError] = useState<AppError | null>(null)

  async function upload(blob: Blob, filename: string) {
    setState('uploading')
    setError(null)
    const result = await uploadProfilePhoto(blob, filename)
    setState('idle')
    if (result.ok) {
      onSuccess(result.data)
    } else {
      setError(result.error)
    }
  }

  async function remove() {
    setState('deleting')
    setError(null)
    const result = await deleteProfilePhoto()
    setState('idle')
    if (result.ok) {
      onSuccess(result.data)
    } else {
      setError(result.error)
    }
  }

  return { upload, remove, state, error, busy: state !== 'idle' }
}
