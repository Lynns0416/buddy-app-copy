import { useTranslations } from 'next-intl'

export default function HomePage() {
  const t = useTranslations('app')
  return <main><h1>{t('name')}</h1></main>
}
