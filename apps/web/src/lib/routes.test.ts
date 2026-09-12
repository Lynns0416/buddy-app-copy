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
