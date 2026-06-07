'use client'

import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { getCroppedBlob } from '../_lib/crop-image'

interface PhotoCropModalProps {
  imageSrc: string
  mimeType: string
  filename: string
  onConfirm: (blob: Blob, filename: string) => void
  onCancel: () => void
  onError: () => void
}

export function PhotoCropModal({ imageSrc, mimeType, filename, onConfirm, onCancel, onError }: PhotoCropModalProps) {
  const t = useTranslations('profile')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [processing, setProcessing] = useState(false)

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  async function handleConfirm() {
    if (!croppedAreaPixels) return
    setProcessing(true)
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, mimeType)
      onConfirm(blob, filename)
    } catch {
      onError()
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="flex w-full max-w-md flex-col rounded-lg border bg-card shadow-lg">
        <div className="relative h-80 w-full overflow-hidden rounded-t-lg bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="p-4">
          <div className="mb-4">
            <label className="mb-1 block text-sm text-muted-foreground">{t('photo.zoom')}</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void handleConfirm()} disabled={processing}>
              {t('photo.cropConfirm')}
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={processing}>
              {t('photo.cropCancel')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
