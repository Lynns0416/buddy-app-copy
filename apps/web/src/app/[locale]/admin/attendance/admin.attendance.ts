import type { AttendanceMonthResponse, SetAttendanceBreak, TourAttendanceResponse, UpdateAttendance } from '@peace-buddy/types'
import { apiClient } from '@/lib/api-client'
import type { ActionResult } from '@/lib/action'
import { classifyApiError } from '@/lib/api-error'

async function run<T>(call: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await call() }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export const fetchTourAttendance = (tourId: string): Promise<ActionResult<TourAttendanceResponse>> =>
  run(() => apiClient.getTourAttendance(tourId))

export const saveAttendance = (tourId: string, buddyId: string, data: UpdateAttendance): Promise<ActionResult<TourAttendanceResponse>> =>
  run(() => apiClient.updateAttendance(tourId, buddyId, data))

export const saveBreak = (tourId: string, data: SetAttendanceBreak): Promise<ActionResult<TourAttendanceResponse>> =>
  run(() => apiClient.setAttendanceBreak(tourId, data))

export const saveFinishTime = (date: string, finishTime: string): Promise<ActionResult<{ date: string; finishTime: string }>> =>
  run(() => apiClient.setFinishTime(date, finishTime))

export const fetchAttendanceMonth = (month: string): Promise<ActionResult<AttendanceMonthResponse>> =>
  run(() => apiClient.getAttendanceMonth(month))

export const lockMonth = (month: string): Promise<ActionResult<{ month: string }>> =>
  run(() => apiClient.lockAttendanceMonth(month))

export const unlockMonth = (month: string): Promise<ActionResult<void>> =>
  run(() => apiClient.unlockAttendanceMonth(month))

export const resolveFlag = (id: string): Promise<ActionResult<void>> =>
  run(() => apiClient.resolveAttendanceFlag(id))
