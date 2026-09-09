'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { BuddyProfileResponse } from '@peace-buddy/types'
import { AppErrorCodeSchema } from '@peace-buddy/types'
import { AvatarPlaceholder } from '@/components/avatar-placeholder'
import { Button } from '@/components/ui/button'
import { PhotoCropModal } from './photo-crop-modal'
import { usePhotoUpload } from '../hooks/use-photo-upload'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 2 * 1024 * 1024

interface ProfilePhotoProps {
  photoUrl: string | null
  displayName: string
  readOnly?: boolean
  onUploaded?: (profile: BuddyProfileResponse) => void
}

export function ProfilePhoto({ photoUrl, displayName, readOnly = false, onUploaded }: ProfilePhotoProps) {
  const t = useTranslations('profile')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cropSrc, setCropSrc] = useState<{ src: string; mime: string; filename: string } | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const { upload, remove, state, busy, error: uploadError } = usePhotoUpload((profile) => {
    onUploaded?.(profile)
  })

  function errorMessage() {
    if (localError) return localError
    if (!uploadError) return null
    switch (uploadError.code) {
      case AppErrorCodeSchema.enum.payload_too_large: return t('photo.error.tooLarge')
      case AppErrorCodeSchema.enum.invalid_request:   return t('photo.error.wrongFormat')
      case AppErrorCodeSchema.enum.network:           return t('photo.error.network')
      default:                                        return t('photo.error.unknown')
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLocalError(null)
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_MIME.includes(file.type)) {
      setLocalError(t('photo.error.wrongFormat'))
      e.target.value = ''
      return
    }
    if (file.size > MAX_BYTES) {
      setLocalError(t('photo.error.tooLarge'))
      e.target.value = ''
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setCropSrc({ src: objectUrl, mime: file.type, filename: file.name })
    e.target.value = ''
  }

  async function handleCropConfirm(blob: Blob, filename: string) {
    if (cropSrc) URL.revokeObjectURL(cropSrc.src)
    setCropSrc(null)
    await upload(blob, filename)
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc.src)
    setCropSrc(null)
  }

  function handleCropError() {
    if (cropSrc) URL.revokeObjectURL(cropSrc.src)
    setCropSrc(null)
    setLocalError(t('photo.error.unknown'))
  }

  const msg = errorMessage()

  return (
    <div className="flex items-start gap-4">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border bg-muted">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={t('photo.altText', { name: displayName })}
            fill
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <AvatarPlaceholder
            displayName={displayName}
            label={t('photo.altText', { name: displayName })}
            size={80}
          />
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {state === 'uploading' ? t('photo.uploading') : t('photo.uploadButton')}
            </Button>
            {photoUrl && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void remove()}
                className="text-destructive hover:text-destructive"
              >
                {t('photo.removeButton')}
              </Button>
            )}
          </div>
          {msg && <p className="text-xs text-destructive">{msg}</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_MIME.join(',')}
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {cropSrc && (
        <PhotoCropModal
          imageSrc={cropSrc.src}
          mimeType={cropSrc.mime}
          filename={cropSrc.filename}
          onConfirm={(blob, filename) => void handleCropConfirm(blob, filename)}
          onCancel={handleCropCancel}
          onError={handleCropError}
        />
      )}
    </div>
  )
}
