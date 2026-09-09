import Image from 'next/image'
import { AvatarPlaceholder } from './avatar-placeholder'

const SIZES = {
  sm: 32,
  md: 48,
  lg: 64,
}

interface BuddyAvatarProps {
  photoUrl: string | null
  displayName: string
  size?: 'sm' | 'md' | 'lg'
}

export function BuddyAvatar({ photoUrl, displayName, size = 'sm' }: BuddyAvatarProps) {
  const px = SIZES[size]
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full border bg-muted"
      style={{ width: px, height: px }}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={displayName}
          width={px}
          height={px}
          className="object-cover"
        />
      ) : (
        <AvatarPlaceholder displayName={displayName} label={displayName} size={px} />
      )}
    </div>
  )
}
