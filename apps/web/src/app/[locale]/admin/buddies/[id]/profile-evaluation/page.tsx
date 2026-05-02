'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import { AppShell } from '@/components/app-shell'
import { AdminProfileEvaluationForm } from '../../_components/admin-profile-evaluation-form'

export default function AdminBuddyProfileEvaluationPage() {
  const { ready, locale } = useAdminGuard()
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('adminEvaluations')

  if (!ready) return null

  return (
    <AppShell variant="admin">
      <div className="mb-6">
        <Link
          href={routes.adminBuddyDetail(locale, id)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t('detail.back')}
        </Link>
      </div>
      <h1 className="mb-6 text-xl font-semibold">{t('detail.profileEvalTitle')}</h1>
      <div className="max-w-2xl">
        <AdminProfileEvaluationForm buddyId={id} />
      </div>
    </AppShell>
  )
}
