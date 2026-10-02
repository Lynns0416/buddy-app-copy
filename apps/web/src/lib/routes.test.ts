import { describe, it, expect } from 'vitest'
import { routes } from './routes'

describe('routes', () => {
  describe('adminEvaluationDetail', () => {
    it('returns correct path', () => {
      expect(routes.adminEvaluationDetail('en', 'eval-abc')).toBe('/en/admin/evaluations/eval-abc')
    })

    it('uses locale', () => {
      expect(routes.adminEvaluationDetail('ja', 'eval-abc')).toBe('/ja/admin/evaluations/eval-abc')
    })
  })

  describe('adminAttendance', () => {
    it('returns the bare path when no month is given', () => {
      expect(routes.adminAttendance('ja')).toBe('/ja/admin/attendance')
    })

    it('appends the month when given', () => {
      expect(routes.adminAttendance('en', '2026-06')).toBe('/en/admin/attendance?month=2026-06')
    })
  })

  describe('adminTourNew', () => {
    it('returns the bare path when no group is given', () => {
      expect(routes.adminTourNew('en')).toBe('/en/admin/tours/new')
    })

    it('appends the group id when given', () => {
      expect(routes.adminTourNew('ja', 'group-123')).toBe('/ja/admin/tours/new?groupId=group-123')
    })

    it('encodes the group id', () => {
      expect(routes.adminTourNew('en', 'a b&c')).toBe('/en/admin/tours/new?groupId=a%20b%26c')
    })
  })

  describe('buddyTourReflection', () => {
    it('nests the reflection page under the tour', () => {
      expect(routes.buddyTourReflection('en', 'tour-123')).toBe('/en/buddy/tours/tour-123/reflection')
    })

    it('uses locale', () => {
      expect(routes.buddyTourReflection('ja', 'tour-123')).toBe('/ja/buddy/tours/tour-123/reflection')
    })
  })

  describe('adminBuddyProfileEvaluation', () => {
    it('returns correct path', () => {
      expect(routes.adminBuddyProfileEvaluation('en', 'buddy-123')).toBe(
        '/en/admin/buddies/buddy-123/profile-evaluation',
      )
    })

    it('uses locale', () => {
      expect(routes.adminBuddyProfileEvaluation('ja', 'buddy-123')).toBe(
        '/ja/admin/buddies/buddy-123/profile-evaluation',
      )
    })
  })
})
