'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { BuddyProfileResponse } from '@peace-buddy/types'
import { Badge } from '@/components/ui/badge'
import { getBuddyStatusLabel, buddyStatusBadgeVariant } from '@/lib/status-display'
import { ProfilePhoto } from './profile-photo'

interface ProfileHeaderProps {
  profile: BuddyProfileResponse
  onPhotoSaved: (profile: BuddyProfileResponse) => void
}

export function ProfileHeader({ profile, onPhotoSaved }: ProfileHeaderProps) {
  const t = useTranslations('profile')
  const tBuddyStatus = useTranslations('buddyStatus')
  const locale = useLocale()

  const memberSince = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(profile.createdAt))

  return (
    <div className="mb-6 rounded-lg border bg-card p-4">
      <div className="mb-4">
        <ProfilePhoto
          photoUrl={profile.photoUrl}
          displayName={profile.displayName}
          onUploaded={onPhotoSaved}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{t('statusLabel')}</span>
          <Badge variant={buddyStatusBadgeVariant[profile.status]}>
            {getBuddyStatusLabel(tBuddyStatus, profile.status)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{t('memberSince')}</span>
          <span className="font-medium">{memberSince}</span>
        </div>
      </div>
    </div>
  )
}
