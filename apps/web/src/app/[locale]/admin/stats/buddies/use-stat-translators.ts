import { useTranslations } from 'next-intl'
import type { StatTranslators } from './admin.buddy-stats'

export function useStatTranslators(): StatTranslators {
  const t = useTranslations('adminBuddyStats')
  const tEval = useTranslations('adminEvaluations')
  const tBuddies = useTranslations('adminBuddies')
  const tGroupType = useTranslations('groupType')
  const tStatus = useTranslations('buddyStatus')
  const tTier = useTranslations('buddyTier')
  return { t, tEval, tBuddies, tGroupType, tStatus, tTier }
}
