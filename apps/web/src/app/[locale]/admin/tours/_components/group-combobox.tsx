'use client'

import { useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import type { GroupResponse } from '@peace-buddy/types'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Props = {
  id: string
  groups: GroupResponse[]
  value: string
  onChange: (groupId: string) => void
  onBlur?: () => void
  inputRef?: React.Ref<HTMLInputElement>
}

/**
 * Filterable group picker. `query === null` means the field is showing the current
 * selection rather than a search term, so clearing the text never loses the selection.
 */
export function GroupCombobox({ id, groups, value, onChange, onBlur, inputRef }: Props) {
  const t = useTranslations('adminTours')
  const listboxId = useId()
  const optionId = (index: number) => `${listboxId}-option-${index}`

  const [query, setQuery] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const composing = useRef(false)

  const selected = groups.find((g) => g.id === value) ?? null
  const term = (query ?? '').trim().toLowerCase()
  const matches = term ? groups.filter((g) => g.name.toLowerCase().includes(term)) : groups
  const displayValue = query ?? selected?.name ?? ''
  // Opening on the first option would let a bare Enter replace the current
  // selection, so the list opens on whatever is already selected.
  const selectedIndex = matches.findIndex((g) => g.id === value)

  function openList(nextHighlight = 0) {
    setOpen(true)
    setHighlight(nextHighlight)
  }

  function restoreSelection() {
    setOpen(false)
    setQuery(null)
  }

  function select(group: GroupResponse) {
    onChange(group.id)
    setQuery(null)
    setOpen(false)
    setHighlight(0)
  }

  function isComposing(event: React.KeyboardEvent<HTMLInputElement>) {
    return composing.current || event.nativeEvent.isComposing
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Enter never reaches the enclosing form, composing or not.
    if (event.key === 'Enter') {
      event.preventDefault()
      if (isComposing(event)) return
      const group = matches[highlight]
      if (open && group) select(group)
      return
    }
    // Arrow keys belong to the IME candidate window while composing.
    if (isComposing(event)) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) return openList(selectedIndex >= 0 ? selectedIndex : 0)
      setHighlight((h) => (matches.length === 0 ? 0 : (h + 1) % matches.length))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) return openList(selectedIndex >= 0 ? selectedIndex : matches.length - 1)
      setHighlight((h) => (matches.length === 0 ? 0 : (h - 1 + matches.length) % matches.length))
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      restoreSelection()
      return
    }
    if (event.key === 'Tab') restoreSelection()
  }

  return (
    <div className="relative">
      <Input
        id={id}
        ref={inputRef}
        role="combobox"
        autoComplete="off"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[highlight] ? optionId(highlight) : undefined}
        placeholder={t('groupPicker.placeholder')}
        value={displayValue}
        onChange={(e) => {
          setQuery(e.target.value)
          openList(0)
        }}
        onCompositionStart={() => { composing.current = true }}
        onCompositionEnd={() => { composing.current = false }}
        onKeyDown={handleKeyDown}
        onClick={() => openList(selectedIndex >= 0 ? selectedIndex : 0)}
        onBlur={() => { restoreSelection(); onBlur?.() }}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-card py-1 shadow-md"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {groups.length === 0 ? t('groupPicker.noGroups') : t('groupPicker.noResults')}
            </li>
          ) : (
            matches.map((group, index) => (
              <li
                key={group.id}
                id={optionId(index)}
                role="option"
                aria-selected={group.id === value}
                className={cn(
                  'cursor-pointer px-3 py-2 text-sm',
                  index === highlight && 'bg-muted',
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => select(group)}
              >
                {group.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
