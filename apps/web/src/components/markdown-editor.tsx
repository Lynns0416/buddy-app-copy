'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Bold, Link as LinkIcon, List, ListOrdered } from 'lucide-react'
import { MarkdownText } from '@/components/markdown-text'
import { Textarea, type TextareaProps } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type Edit = { value: string; selectionStart: number; selectionEnd: number }

// Whitespace, punctuation and symbols (「」、。 included). CommonMark does not
// open `**` before one of these unless whitespace or punctuation precedes it,
// so `は**「重要」**です` stays literal while `は「**重要**」です` is bold.
const EDGE = /[\s\p{P}\p{S}]/u

// Moves the selection edges inward past EDGE characters so the markers sit
// against text. A selection that is nothing but EDGE characters is kept as is.
export function wrapBold(value: string, start: number, end: number): Edit {
  let from = start
  let to = end
  while (from < to && EDGE.test(value[from])) from++
  while (to > from && EDGE.test(value[to - 1])) to--
  if (from === to) {
    from = start
    to = end
  }
  const selected = value.slice(from, to)
  return {
    value: `${value.slice(0, from)}**${selected}**${value.slice(to)}`,
    selectionStart: from + 2,
    selectionEnd: to + 2,
  }
}

// Prefixes every line the selection touches, so selecting three lines and
// pressing the list button makes a three-item list.
export function prefixLines(value: string, start: number, end: number, ordered: boolean): Edit {
  // A selection of whole lines ends just past a newline; that next line is
  // not part of it.
  const last = end > start && value[end - 1] === '\n' ? end - 1 : end
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const nextBreak = value.indexOf('\n', last)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  const lines = value.slice(lineStart, lineEnd).split('\n')
  const block = lines.map((line, i) => `${ordered ? `${i + 1}.` : '-'} ${line}`).join('\n')
  return {
    value: value.slice(0, lineStart) + block + value.slice(lineEnd),
    selectionStart: lineStart,
    selectionEnd: lineStart + block.length,
  }
}

export function insertLink(value: string, start: number, end: number, url: string): Edit {
  const text = value.slice(start, end) || url
  const link = `[${text}](${url})`
  return {
    value: value.slice(0, start) + link + value.slice(end),
    selectionStart: start + link.length,
    selectionEnd: start + link.length,
  }
}

// Writes through the native setter and fires `input`, so both a
// react-hook-form `register` and an uncontrolled `<form>` see the change.
function applyEdit(el: HTMLTextAreaElement, edit: Edit) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  setValue?.call(el, edit.value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.focus()
  el.setSelectionRange(edit.selectionStart, edit.selectionEnd)
}

// A Textarea with a formatting toolbar and a preview. Stores Markdown as plain
// text; render it with `MarkdownText`.
export const MarkdownEditor = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    const t = useTranslations('markdownEditor')
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null)
    const [preview, setPreview] = React.useState<string | null>(null)

    const setRefs = React.useCallback(
      (el: HTMLTextAreaElement | null) => {
        innerRef.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      },
      [ref]
    )

    function run(edit: (value: string, start: number, end: number) => Edit | null) {
      const el = innerRef.current
      if (!el) return
      const result = edit(el.value, el.selectionStart, el.selectionEnd)
      if (result) applyEdit(el, result)
    }

    function handleLink() {
      const url = window.prompt(t('linkPrompt'), 'https://')
      if (!url) return
      run((value, start, end) => insertLink(value, start, end, url))
    }

    const tools = [
      { label: t('bold'), Icon: Bold, onClick: () => run(wrapBold) },
      { label: t('bulletList'), Icon: List, onClick: () => run((v, s, e) => prefixLines(v, s, e, false)) },
      { label: t('numberedList'), Icon: ListOrdered, onClick: () => run((v, s, e) => prefixLines(v, s, e, true)) },
      { label: t('link'), Icon: LinkIcon, onClick: handleLink },
    ]

    const tabClass = (active: boolean) =>
      cn('rounded px-2 py-1 text-xs', active ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent')

    return (
      <div className="rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
        <div className="flex items-center gap-1 border-b border-input px-1 py-1">
          {tools.map(({ label, Icon, onClick }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={label}
              disabled={preview !== null}
              onClick={onClick}
              className="rounded p-1.5 hover:bg-accent disabled:opacity-40"
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <div className="ml-auto flex gap-1">
            <button type="button" aria-pressed={preview === null} onClick={() => setPreview(null)} className={tabClass(preview === null)}>
              {t('write')}
            </button>
            <button
              type="button"
              aria-pressed={preview !== null}
              onClick={() => setPreview(innerRef.current?.value ?? '')}
              className={tabClass(preview !== null)}
            >
              {t('preview')}
            </button>
          </div>
        </div>
        <Textarea
          ref={setRefs}
          className={cn('rounded-none border-0 shadow-none focus-visible:ring-0', preview !== null && 'hidden', className)}
          {...props}
        />
        {preview !== null && (
          <div className="min-h-[80px] px-3 py-2 text-sm">
            {preview.trim() ? <MarkdownText>{preview}</MarkdownText> : <p className="text-muted-foreground">{t('previewEmpty')}</p>}
          </div>
        )}
        <p className="border-t border-input px-3 py-1.5 text-xs text-muted-foreground">{t('hint')}</p>
      </div>
    )
  }
)
MarkdownEditor.displayName = 'MarkdownEditor'
