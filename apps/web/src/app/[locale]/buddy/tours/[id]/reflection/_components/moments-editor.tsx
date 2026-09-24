'use client'

import { useTranslations } from 'next-intl'
import type { TourPlaceWithSpots } from '@peace-buddy/types'
import { placeName } from '@/lib/place-names'
import { emptyMoment, type MomentState } from '../reflection-form-state'

type Props = {
  place: TourPlaceWithSpots
  // The spot an added row starts on — an active one, even when `place` also
  // carries a retired spot an existing moment is still tagged with.
  newMomentSpotId: string | null
  // From usesSingleMoment: the no-spot textarea rather than the picker.
  singleMoment: boolean
  moments: MomentState[]
  onChange: (moments: MomentState[]) => void
  disabled: boolean
  locale: string
  idPrefix: string
}

const OTHER = 'other'

// Two shapes, chosen by what the session's place actually offers:
// - any spot → the full add/remove/reorder picker (rule 2/3)
// - no spots → a single textarea, placeNote auto-filled
// - no spots, but saved moments the textarea cannot hold → the full picker
// The auto-filled placeNote is the place's nameJa whatever the buddy's UI
// language, so one place is stored under one name.
export function MomentsEditor({ place, newMomentSpotId, singleMoment, moments, onChange, disabled, locale, idPrefix }: Props) {
  const t = useTranslations('reflections')

  if (singleMoment) {
    return (
      <SinglePlaceMoment
        place={place}
        moment={moments[0] ?? null}
        onChange={(m) => onChange(m ? [m] : [])}
        disabled={disabled}
        locale={locale}
        idPrefix={idPrefix}
      />
    )
  }

  function updateMoment(index: number, next: Partial<MomentState>) {
    onChange(moments.map((m, i) => (i === index ? { ...m, ...next } : m)))
  }

  function removeMoment(index: number) {
    onChange(moments.filter((_, i) => i !== index))
  }

  function moveMoment(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= moments.length) return
    const next = [...moments]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t('moments.heading')}</p>
      {moments.map((moment, idx) => {
        // A moment's spotId is null exactly when Other is the chosen state —
        // a new row starts on an active spot, so null is an explicit Other
        // pick (however blank its free text still is), or the only choice
        // left once every spot has been retired.
        const selectValue = moment.spotId ?? OTHER
        return (
          <div key={idx} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={`${idPrefix}-moment-${idx}-spot`} className="text-xs font-medium text-muted-foreground">
                {t('moments.spotLabel')}
              </label>
              <div className="flex items-center gap-1">
                {moments.length > 1 && (
                  <>
                    <button
                      type="button"
                      disabled={disabled || idx === 0}
                      onClick={() => moveMoment(idx, -1)}
                      className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      {t('moments.moveUp')}
                    </button>
                    <button
                      type="button"
                      disabled={disabled || idx === moments.length - 1}
                      onClick={() => moveMoment(idx, 1)}
                      className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      {t('moments.moveDown')}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeMoment(idx)}
                  className="rounded px-1.5 py-0.5 text-xs text-destructive hover:underline"
                >
                  {t('moments.remove')}
                </button>
              </div>
            </div>

            <select
              id={`${idPrefix}-moment-${idx}-spot`}
              value={selectValue}
              disabled={disabled}
              onChange={(e) => {
                const value = e.target.value
                updateMoment(idx, value === OTHER ? { spotId: null, placeNote: moment.placeNote || '' } : { spotId: value, placeNote: '' })
              }}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              {place.spots.map((spot) => (
                <option key={spot.id} value={spot.id}>{placeName(spot, locale)}</option>
              ))}
              <option value={OTHER}>{t('moments.otherOption')}</option>
            </select>

            {selectValue === OTHER && (
              <input
                type="text"
                value={moment.placeNote}
                disabled={disabled}
                placeholder={t('moments.placeNoteLabel')}
                onChange={(e) => updateMoment(idx, { placeNote: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            )}

            <textarea
              value={moment.description}
              disabled={disabled}
              placeholder={t('moments.descriptionLabel')}
              onChange={(e) => updateMoment(idx, { description: e.target.value })}
              rows={2}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>
        )
      })}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...moments, { ...emptyMoment(), spotId: newMomentSpotId }])}
        className="text-sm text-primary hover:underline disabled:opacity-50"
      >
        {t('moments.addMoment')}
      </button>
    </div>
  )
}

function SinglePlaceMoment({
  place,
  moment,
  onChange,
  disabled,
  locale,
  idPrefix,
}: {
  place: TourPlaceWithSpots
  moment: MomentState | null
  onChange: (moment: MomentState | null) => void
  disabled: boolean
  locale: string
  idPrefix: string
}) {
  const t = useTranslations('reflections')
  const description = moment?.description ?? ''

  function setDescription(next: string) {
    onChange(next ? { spotId: null, placeNote: place.nameJa, description: next } : null)
  }

  return (
    <div className="space-y-2">
      <label htmlFor={`${idPrefix}-single-moment`} className="block text-sm font-medium">
        {t('moments.singlePlaceDescription', { place: placeName(place, locale) })}
      </label>
      <textarea
        id={`${idPrefix}-single-moment`}
        value={description}
        disabled={disabled}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      />
    </div>
  )
}
