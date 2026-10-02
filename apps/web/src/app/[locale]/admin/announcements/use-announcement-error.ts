import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import type { AppError } from '@peace-buddy/types'
import { AppErrorCodeSchema } from '@peace-buddy/types'

export function useAnnouncementErrorMessage(): (error: AppError) => string {
  const t = useTranslations('adminAnnouncements.error')
  return useCallback(
    (error: AppError) => {
      switch (error.code) {
        case AppErrorCodeSchema.enum.not_found:       return t('notFound')
        case AppErrorCodeSchema.enum.invalid_request: return t('invalid')
        case AppErrorCodeSchema.enum.conflict:        return t('conflict')
        case AppErrorCodeSchema.enum.network:         return t('network')
        default:                                      return t('unknown')
      }
    },
    [t],
  )
}
