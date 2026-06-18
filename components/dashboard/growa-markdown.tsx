'use client'

import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="mb-3 mt-1 text-lg font-semibold text-foreground">{children}</h1>,
  h2: ({ children }) => (
    <h2 className="mb-2 mt-5 border-b border-border/60 pb-1 text-sm font-semibold uppercase tracking-[0.12em] text-primary">
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="mb-2 mt-4 text-sm font-semibold text-foreground">{children}</h3>,
  p: ({ children }) => <p className="mb-3 text-sm leading-6 text-foreground/90">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm text-foreground/90">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-sm text-foreground/90">{children}</ol>,
  li: ({ children }) => <li className="leading-6">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="text-foreground/85">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-xs text-primary">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg border border-border bg-secondary/40 p-3 text-xs text-foreground">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-4 border-border/70" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
}

interface GrowaMarkdownProps {
  content: string
}

export function GrowaMarkdown({ content }: GrowaMarkdownProps) {
  return (
    <div className="growa-markdown">
      <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
    </div>
  )
}
