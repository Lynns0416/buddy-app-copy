export const routes = {
  home: (locale: string) => `/${locale}`,
  login: (locale: string) => `/${locale}/login`,
  pending: (locale: string) => `/${locale}/pending`,
  dashboard: (locale: string) => `/${locale}/dashboard`,
  admin: (locale: string) => `/${locale}/admin`,
  adminBuddies: (locale: string) => `/${locale}/admin/buddies`,
  adminGroups: (locale: string) => `/${locale}/admin/groups`,
  adminGroupNew: (locale: string) => `/${locale}/admin/groups/new`,
  adminGroupDetail: (locale: string, id: string) => `/${locale}/admin/groups/${id}`,
  adminGroupEdit: (locale: string, id: string) => `/${locale}/admin/groups/${id}/edit`,
}
