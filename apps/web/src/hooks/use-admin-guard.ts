import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { UserRoleSchema } from '@peace-buddy/types'

export function useAdminGuard() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()

  const isAdmin =
    !loading &&
    !!dbUser &&
    (dbUser.role === UserRoleSchema.enum.admin || dbUser.role === UserRoleSchema.enum.super_admin)

  useEffect(() => {
    if (loading) return
    if (!firebaseUser) {
      router.replace(routes.login(locale))
    } else if (dbUser && !isAdmin) {
      router.replace(routes.home(locale))
    }
  }, [loading, firebaseUser, dbUser, isAdmin, locale, router])

  return { ready: isAdmin, locale }
}
