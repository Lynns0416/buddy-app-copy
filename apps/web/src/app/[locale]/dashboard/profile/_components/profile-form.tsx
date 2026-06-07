'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import type { BuddyProfileResponse } from '@peace-buddy/types'
import { LanguageSchema, type Language } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { routes } from '@/lib/routes'
import { updateMyProfile } from '../dashboard.profile'

interface ProfileFormProps {
  profile: BuddyProfileResponse
  onSaved: () => void
}

export function ProfileForm({ profile, onSaved }: ProfileFormProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('profile')
  const tLang = useTranslations('languages')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [realName, setRealName] = useState(profile.realName)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [contactInfo, setContactInfo] = useState(profile.contactInfo ?? '')
  const [availability, setAvailability] = useState(profile.availability ?? '')
  const [skillsText, setSkillsText] = useState(profile.skills.join('\n'))
  const [selectedLanguages, setSelectedLanguages] = useState<Set<Language>>(
    new Set(profile.languages)
  )

  function toggleLanguage(lang: Language) {
    setSuccess(false)
    setSelectedLanguages((prev) => {
      const next = new Set(prev)
      if (next.has(lang)) next.delete(lang)
      else next.add(lang)
      return next
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setIsSubmitting(true)

    const skills = skillsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    const result = await updateMyProfile({
      displayName: displayName || undefined,
      realName: realName || undefined,
      bio: bio || null,
      contactInfo: contactInfo || null,
      availability: availability || null,
      skills,
      languages: Array.from(selectedLanguages),
    })

    setIsSubmitting(false)

    if (result.ok) {
      setSuccess(true)
      onSaved()
    } else {
      const code = result.error.code
      if (code === 'not_found') setError(t('error.notFound'))
      else if (code === 'forbidden') setError(t('error.forbidden'))
      else if (code === 'network') setError(t('error.network'))
      else setError(t('error.unknown'))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {success && (
        <p className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          {t('saveSuccess')}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div>
        <Label htmlFor="displayName">{t('displayName')}</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => { setSuccess(false); setDisplayName(e.target.value) }}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="realName">{t('realName')}</Label>
        <Input
          id="realName"
          value={realName}
          onChange={(e) => { setSuccess(false); setRealName(e.target.value) }}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="bio">{t('bio')}</Label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => { setSuccess(false); setBio(e.target.value) }}
          rows={4}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="contactInfo">{t('contactInfo')}</Label>
        <Input
          id="contactInfo"
          value={contactInfo}
          onChange={(e) => { setSuccess(false); setContactInfo(e.target.value) }}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="availability">{t('availability')}</Label>
        <Input
          id="availability"
          value={availability}
          onChange={(e) => { setSuccess(false); setAvailability(e.target.value) }}
          className="mt-1"
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium leading-none">{t('languages')}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LanguageSchema.options.map((lang: Language) => (
            <label key={lang} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedLanguages.has(lang)}
                onChange={() => toggleLanguage(lang)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              {tLang(lang)}
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="skills">{t('skills')}</Label>
        <Textarea
          id="skills"
          value={skillsText}
          onChange={(e) => { setSuccess(false); setSkillsText(e.target.value) }}
          rows={4}
          className="mt-1"
          placeholder={t('skillsHelp')}
        />
        <p className="mt-1 text-xs text-muted-foreground">{t('skillsHelp')}</p>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {t('save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(routes.dashboard(locale))}
          disabled={isSubmitting}
        >
          {t('cancel')}
        </Button>
      </div>
    </form>
  )
}
