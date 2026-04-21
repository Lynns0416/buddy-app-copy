import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export type SortDir = 'asc' | 'desc'

export function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="ml-1 inline h-3.5 w-3.5 opacity-40" />
  return dir === 'asc'
    ? <ChevronUp className="ml-1 inline h-3.5 w-3.5" />
    : <ChevronDown className="ml-1 inline h-3.5 w-3.5" />
}
