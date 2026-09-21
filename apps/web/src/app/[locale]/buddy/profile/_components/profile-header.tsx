'use client'

import { useTranslations } from 'next-intl'
import type { BuddyProfileResponse } from '@peace-buddy/types'
import { Badge } from '@/components/ui/badge'
import { getBuddyStatusLabel, getBuddyTierLabel, buddyStatusBadgeVariant } from '@/lib/status-display'
import { formatDate } from '@/lib/format-date'
import { ProfilePhoto } from './profile-photo'

interface ProfileHeaderProps {
  profile: BuddyProfileResponse
  onPhotoSaved: (profile: BuddyProfileResponse) => void
}

export function ProfileHeader({ profile, onPhotoSaved }: ProfileHeaderProps) {
  const t = useTranslations('profile')
  const tBuddyStatus = useTranslations('buddyStatus')
  const tBuddyTier = useTranslations('buddyTier')

  const memberSince = formatDate(profile.createdAt)

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
        {profile.tier && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('tierLabel')}</span>
            <Badge variant="secondary">{getBuddyTierLabel(tBuddyTier, profile.tier)}</Badge>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{t('memberSince')}</span>
          <span className="font-medium">{memberSince}</span>
        </div>
      </div>
    </div>
  )
}
