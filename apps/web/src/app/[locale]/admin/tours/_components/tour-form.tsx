'use client'

import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ApiError } from '@/lib/api'
import type { AdminTourDetailResponse, GroupResponse, PlaceResponse } from '@peace-buddy/types'
import { BookingStatusSchema } from '@peace-buddy/types'
import { useLocale } from 'next-intl'
import { placeName } from '@/lib/place-names'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MarkdownEditor } from '@/components/markdown-editor'
import { GroupCombobox } from './group-combobox'
import { GroupSummary } from './group-summary'

const timeRegex = /^\d{2}:\d{2}$/

const SessionFormSchema = z
  .object({
    label: z.string().optional(),
    meetingTime: z.string().regex(timeRegex),
    capacity: z.coerce.number().int().positive(),
    minBuddies: z.coerce
      .number({ invalid_type_error: 'minBuddiesRequired' })
      .int()
      .min(1, { message: 'minBuddiesRequired' }),
    participantCount: z.coerce.number().int().min(0),
    placeId: z.string().min(1, { message: 'placeRequired' }),
  })
  .refine(
    (d) => d.minBuddies <= d.capacity,
    { message: 'minBuddiesExceedsCapacity', path: ['minBuddies'] },
  )

const TourFormSchema = z
  .object({
    groupId: z.string().uuid({ message: 'groupRequired' }),
    tourDate: z.string().min(1),
    bookingOpen: z.boolean(),
    description: z.string().optional(),
    adminMemo: z.string().optional(),
    cancellationDeadline: z.string().min(1),
    maybeDeadline: z.string().optional(),
    notificationOffsets: z.string(),
    sessions: z.array(SessionFormSchema).min(1).max(2),
  })
  .refine(
    (d) => !d.maybeDeadline || d.maybeDeadline < d.cancellationDeadline,
    { message: 'maybeDeadlineError', path: ['maybeDeadline'] },
  )

type TourFormFields = z.infer<typeof TourFormSchema>

const emptySession: TourFormFields['sessions'][number] = {
  label: '',
  meetingTime: '',
  capacity: '' as unknown as number,
  minBuddies: '' as unknown as number,
  participantCount: 0,
  placeId: '',
}

export type SessionFormValues = {
  label?: string
  meetingTime: string
  capacity: number
  minBuddies: number
  participantCount: number
  placeId: string
}

export type TourFormValues = {
  groupId: string
  tourDate: string
  bookingOpen: boolean
  description: string | null
  adminMemo: string | null
  cancellationDeadline: string
  maybeDeadline: string | null
  notificationOffsets: number[]
  sessions: SessionFormValues[]
}

type Props = {
  defaultValues?: AdminTourDetailResponse
  /** Preselects the group when the form is opened from a group page. Ignored when `defaultValues` is given. */
  initialGroupId?: string
  groups: GroupResponse[]
  places: PlaceResponse[]
  cancelHref: string
  onSubmit: (values: TourFormValues) => Promise<void>
  /** Hides adding and removing sessions; every field of an existing session stays editable. */
  hideSessionManagement?: boolean
}

export function TourForm({ defaultValues, initialGroupId, groups, places, cancelHref, onSubmit, hideSessionManagement = false }: Props) {
  const t = useTranslations('adminTours')
  const locale = useLocale()
  // A place already on one of this tour's sessions stays pickable even if
  // since deactivated — otherwise its dropdown would have no option to show
  // the saved value, and saving would silently change it.
  const assignedPlaceIds = new Set(defaultValues?.sessions.map((s) => s.place.id) ?? [])
  const selectablePlaces = places.filter((p) => p.active || assignedPlaceIds.has(p.id))

  const firstSession = defaultValues?.sessions[0]
  const secondSession = defaultValues?.sessions[1]

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TourFormFields>({
    resolver: zodResolver(TourFormSchema),
    defaultValues: {
      groupId: defaultValues?.group.id ?? initialGroupId ?? '',
      tourDate: defaultValues?.tourDate.slice(0, 10) ?? '',
      bookingOpen: defaultValues?.bookingOpen ?? false,
      description: defaultValues?.description ?? '',
      adminMemo: defaultValues?.adminMemo ?? '',
      cancellationDeadline: defaultValues?.cancellationDeadline.slice(0, 10) ?? '',
      maybeDeadline: defaultValues?.maybeDeadline?.slice(0, 10) ?? '',
      notificationOffsets: defaultValues
        ? defaultValues.notificationOffsets.join(', ')
        : '3, 1',
      sessions: firstSession
        ? [
            {
              label: firstSession.label ?? '',
              meetingTime: firstSession.meetingTime.slice(11, 16),
              capacity: firstSession.capacity,
              minBuddies: firstSession.minBuddies,
              participantCount: firstSession.participantCount,
              placeId: firstSession.place.id,
            },
            ...(secondSession
              ? [{
                  label: secondSession.label ?? '',
                  meetingTime: secondSession.meetingTime.slice(11, 16),
                  capacity: secondSession.capacity,
                  minBuddies: secondSession.minBuddies,
                  participantCount: secondSession.participantCount,
                  placeId: secondSession.place.id,
                }]
              : []),
          ]
        : [emptySession],
    },
  })

  const { fields: sessionFields, append: appendSession, remove: removeSession } = useFieldArray({
    control,
    name: 'sessions',
  })

  const selectedGroupId = useWatch({ control, name: 'groupId' })
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null

  async function submit(fields: TourFormFields) {
    // Lowering capacity never un-confirms a booking, so the API rejects it;
    // catching it here puts the error on the field instead of the page.
    let capacityTooLow = false
    defaultValues?.sessions.forEach((session, idx) => {
      const confirmed = defaultValues.bookings.filter(
        (b) => b.sessionId === session.id && b.status === BookingStatusSchema.enum.confirmed,
      ).length
      const capacity = fields.sessions[idx]?.capacity
      if (capacity != null && capacity < confirmed) {
        setError(`sessions.${idx}.capacity`, { message: t('capacityBelowConfirmed', { count: confirmed }) })
        capacityTooLow = true
      }
    })
    if (capacityTooLow) return

    const values: TourFormValues = {
      groupId: fields.groupId,
      tourDate: fields.tourDate,
      bookingOpen: fields.bookingOpen,
      description: fields.description || null,
      adminMemo: fields.adminMemo || null,
      cancellationDeadline: fields.cancellationDeadline,
      maybeDeadline: fields.maybeDeadline || null,
      notificationOffsets: fields.notificationOffsets
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n)),
      sessions: fields.sessions.map((s) => ({
        label: s.label || undefined,
        meetingTime: s.meetingTime,
        capacity: s.capacity,
        minBuddies: s.minBuddies,
        participantCount: s.participantCount,
        placeId: s.placeId,
      })),
    }
    try {
      await onSubmit(values)
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        for (const [field, messages] of Object.entries(err.details.fieldErrors)) {
          setError(field as keyof TourFormFields, { message: messages[0] })
        }
        if (err.details.formErrors.length > 0) {
          setError('root', { message: err.details.formErrors.join(' / ') })
        }
      } else {
        setError('root', { message: err instanceof Error ? err.message : t('actionError') })
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="rounded-lg border bg-card p-6">
      {errors.root && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="groupId">{t('group')}</Label>
          <Controller
            control={control}
            name="groupId"
            render={({ field }) => (
              <GroupCombobox
                id="groupId"
                groups={groups}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                inputRef={field.ref}
              />
            )}
          />
          {errors.groupId && (
            <p className="text-xs text-destructive">
              {errors.groupId.message === 'groupRequired'
                ? t('groupRequired')
                : errors.groupId.message}
            </p>
          )}
          <GroupSummary group={selectedGroup} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tourDate">{t('tourDate')}</Label>
          <Input id="tourDate" type="date" {...register('tourDate')} />
          {errors.tourDate && <p className="text-xs text-destructive">{errors.tourDate.message}</p>}
        </div>

        {/* Sessions */}
        <div className="flex flex-col gap-3">
          {sessionFields.map((field, idx) => (
            <div key={field.id} className="rounded-md border p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {t(`session.defaultLabel.${idx + 1}`)}
                </p>
                {!hideSessionManagement && idx > 0 && (
                  <button
                    type="button"
                    className="text-xs text-destructive hover:underline"
                    onClick={() => removeSession(idx)}
                  >
                    {t('session.remove')}
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`sessions.${idx}.placeId`}>{t('location')}</Label>
                <select
                  id={`sessions.${idx}.placeId`}
                  {...register(`sessions.${idx}.placeId`)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="" disabled>{t('selectPlace')}</option>
                  {selectablePlaces.map((place) => (
                    <option key={place.id} value={place.id}>
                      {placeName(place, locale)}
                      {!place.active && ` (${t('inactivePlace')})`}
                    </option>
                  ))}
                </select>
                {errors.sessions?.[idx]?.placeId && (
                  <p className="text-xs text-destructive">
                    {errors.sessions[idx]?.placeId?.message === 'placeRequired'
                      ? t('placeRequired')
                      : errors.sessions[idx]?.placeId?.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`sessions.${idx}.label`}>{t('session.label')}</Label>
                <Input
                  id={`sessions.${idx}.label`}
                  placeholder={t(`session.defaultLabel.${idx + 1}`)}
                  {...register(`sessions.${idx}.label`)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`sessions.${idx}.meetingTime`}>{t('meetingTime')}</Label>
                <Input id={`sessions.${idx}.meetingTime`} type="time" {...register(`sessions.${idx}.meetingTime`)} />
                {errors.sessions?.[idx]?.meetingTime && <p className="text-xs text-destructive">{errors.sessions[idx]?.meetingTime?.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`sessions.${idx}.capacity`}>{t('capacity')}</Label>
                <Input id={`sessions.${idx}.capacity`} type="number" min={1} {...register(`sessions.${idx}.capacity`)} />
                {errors.sessions?.[idx]?.capacity && <p className="text-xs text-destructive">{errors.sessions[idx]?.capacity?.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`sessions.${idx}.minBuddies`}>{t('minBuddies')}</Label>
                <Input
                  id={`sessions.${idx}.minBuddies`}
                  type="number"
                  min={1}
                  // Empty must fail as missing; coercing '' would read 0.
                  {...register(`sessions.${idx}.minBuddies`, { setValueAs: (v) => (v === '' ? undefined : v) })}
                />
                {errors.sessions?.[idx]?.minBuddies && (
                  <p className="text-xs text-destructive">
                    {errors.sessions[idx]?.minBuddies?.message === 'minBuddiesExceedsCapacity'
                      ? t('minBuddiesExceedsCapacity')
                      : t('minBuddiesRequired')}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`sessions.${idx}.participantCount`}>{t('participantCount')}</Label>
                <Input id={`sessions.${idx}.participantCount`} type="number" min={0} {...register(`sessions.${idx}.participantCount`)} />
              </div>
            </div>
          ))}
          {!hideSessionManagement && sessionFields.length < 2 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendSession(emptySession)}
            >
              {t('session.add')}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            id="bookingOpen"
            type="checkbox"
            {...register('bookingOpen')}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <Label htmlFor="bookingOpen">{t('bookingOpenDescription')}</Label>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cancellationDeadline">{t('cancellationDeadline')}</Label>
          <Input id="cancellationDeadline" type="date" {...register('cancellationDeadline')} />
          {errors.cancellationDeadline && <p className="text-xs text-destructive">{errors.cancellationDeadline.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maybeDeadline">{t('maybeDeadline')}</Label>
          <Input id="maybeDeadline" type="date" {...register('maybeDeadline')} />
          {errors.maybeDeadline && (
            <p className="text-xs text-destructive">
              {errors.maybeDeadline.message === 'maybeDeadlineError'
                ? t('maybeDeadlineError')
                : errors.maybeDeadline.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notificationOffsets">{t('notificationOffsets')}</Label>
          <Input id="notificationOffsets" {...register('notificationOffsets')} />
          <p className="text-xs text-muted-foreground">{t('notificationOffsetsHelp')}</p>
          {errors.notificationOffsets && <p className="text-xs text-destructive">{errors.notificationOffsets.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">{t('description')}</Label>
          <MarkdownEditor id="description" rows={3} {...register('description')} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="adminMemo">{t('adminMemo')}</Label>
          <MarkdownEditor id="adminMemo" rows={3} {...register('adminMemo')} />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>{t('save')}</Button>
        <Button asChild variant="ghost">
          <Link href={cancelHref}>{t('cancel')}</Link>
        </Button>
      </div>
    </form>
  )
}
