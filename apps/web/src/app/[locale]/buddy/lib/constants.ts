import type { CancellationCategory } from '@peace-buddy/types'
import { CancellationCategorySchema } from '@peace-buddy/types'

export const CANCEL_CATEGORIES: CancellationCategory[] = [
  CancellationCategorySchema.enum.health,
  CancellationCategorySchema.enum.emergency,
  CancellationCategorySchema.enum.personal,
  CancellationCategorySchema.enum.work,
  CancellationCategorySchema.enum.other,
]

// Reference links at the bottom of Home. Kept here by the developers, not
// edited by PLAB members (#265). `labelKey` is under `home.links`.
export const BUDDY_LINKS: { labelKey: string; href: string }[] = [
  {
    labelKey: 'manualPdf',
    href: 'https://drive.google.com/file/d/1BYYIdpIIYm-fBlggYAKY1xUmWseilMxo/view?usp=drive_link',
  },
  {
    labelKey: 'manualDoc',
    href: 'https://docs.google.com/document/d/1v1q0BX-yNhk3egN6ZDXD8H5OtoCYyHgZUCtXLnsDc5c/edit?tab=t.afbi2irbn61k#heading=h.vnvej5w3dzff',
  },
]
