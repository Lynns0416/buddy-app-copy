import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { cn } from '@/lib/utils'

// What the editor toolbar produces, plus `em` for a hand-typed `*text*`.
// Anything else in the source (headings, images, tables) renders as its text
// content. Raw HTML is never rendered — react-markdown escapes it by default.
const ALLOWED_ELEMENTS = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a']

// remark-breaks keeps single newlines as line breaks, so most plain-text rows
// written before formatting existed render as they were typed. Lines that
// happen to be Markdown syntax (`---`, a leading `#` or `>`, `*a*`) do not.
export function MarkdownText({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        'space-y-2 break-words [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-5',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
