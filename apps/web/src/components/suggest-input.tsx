'use client'

import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Props = {
  id?: string
  value: string
  onChange: (value: string) => void
  // Offered as the user types; any other text is still accepted.
  suggestions: string[]
  placeholder?: string
  'aria-label'?: string
  className?: string
}

/**
 * A text filter that lists the values it can match — a buddy's name, a group
 * name — and still takes free text. Looks and behaves like `GroupCombobox`
 * on the tour form; unlike it, the typed text itself is the value.
 */
export function SuggestInput({ id, value, onChange, suggestions, placeholder, className, ...aria }: Props) {
  const listboxId = useId()
  const optionId = (index: number) => `${listboxId}-option-${index}`

  const [open, setOpen] = useState(false)
  // -1 = nothing highlighted, so Enter keeps the free text as typed.
  const [highlight, setHighlight] = useState(-1)
  const composing = useRef(false)

  const term = value.trim().toLowerCase()
  const options = [...new Set(suggestions)].sort((a, b) => a.localeCompare(b))
  const matches = term ? options.filter((o) => o.toLowerCase().includes(term)) : options
  const showList = open && matches.length > 0

  function openList() {
    setOpen(true)
    setHighlight(-1)
  }

  function close() {
    setOpen(false)
    setHighlight(-1)
  }

  function select(option: string) {
    onChange(option)
    close()
  }

  function isComposing(event: KeyboardEvent<HTMLInputElement>) {
    return composing.current || event.nativeEvent.isComposing
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter never reaches an enclosing form, composing or not.
    if (event.key === 'Enter') {
      event.preventDefault()
      if (isComposing(event)) return
      if (showList && highlight >= 0) select(matches[highlight])
      return
    }
    // Arrow keys belong to the IME candidate window while composing.
    if (isComposing(event)) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) return openList()
      setHighlight((h) => (matches.length === 0 ? -1 : (h + 1) % matches.length))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) return openList()
      setHighlight((h) => (matches.length === 0 ? -1 : (h <= 0 ? matches.length : h) - 1))
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key === 'Tab') close()
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        id={id}
        role="combobox"
        autoComplete="off"
        aria-label={aria['aria-label']}
        aria-expanded={showList}
        aria-controls={showList ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={showList && highlight >= 0 ? optionId(highlight) : undefined}
        className="pr-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          openList()
        }}
        onCompositionStart={() => { composing.current = true }}
        onCompositionEnd={() => { composing.current = false }}
        onKeyDown={handleKeyDown}
        onClick={openList}
        onBlur={close}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />

      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-card py-1 shadow-md"
        >
          {matches.map((option, index) => (
            <li
              key={option}
              id={optionId(index)}
              role="option"
              aria-selected={option === value}
              className={cn('cursor-pointer px-3 py-2 text-sm', index === highlight && 'bg-muted')}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => select(option)}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
