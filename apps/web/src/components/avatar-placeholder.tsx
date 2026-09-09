interface AvatarPlaceholderProps {
  displayName: string
  label: string
  size: number
}

/** First letter of the first and last word, or the first letter alone for a single word. */
export function getInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const first = Array.from(words[0])[0]
  if (words.length === 1) return first.toUpperCase()
  const last = Array.from(words[words.length - 1])[0]
  return (first + last).toUpperCase()
}

export function AvatarPlaceholder({ displayName, label, size }: AvatarPlaceholderProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className="flex h-full w-full select-none items-center justify-center bg-muted font-medium text-muted-foreground"
      style={{ fontSize: Math.round(size * 0.4) }}
    >
      {getInitials(displayName)}
    </div>
  )
}
