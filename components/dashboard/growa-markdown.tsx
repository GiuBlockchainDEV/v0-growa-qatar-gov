'use client'

import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="mb-3 mt-1 text-[18px] font-medium text-content">{children}</h1>,
  h2: ({ children }) => (
    <h2 className="mb-2 mt-5 border-b border-dotted border-line-strong pb-1.5 text-[14px] font-medium text-content">
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="mb-2 mt-4 text-[14px] font-medium text-content">{children}</h3>,
  p: ({ children }) => <p className="mb-3 text-[14px] leading-[1.5] text-content">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-[square] marker:text-sage space-y-1.5 ps-5 text-[14px] text-content">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal marker:text-content-soft space-y-1.5 ps-5 text-[14px] text-content">{children}</ol>,
  li: ({ children }) => <li className="leading-[1.5]">{children}</li>,
  strong: ({ children }) => <strong className="font-medium text-sage-700">{children}</strong>,
  em: ({ children }) => <em className="text-content-soft">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-s-2 border-sage ps-3 text-[14px] text-content-soft">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded-xs bg-muted px-1.5 py-0.5 font-mono text-[12px] text-content">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg border border-line bg-muted p-3 text-[12px] text-content">
      {children}
    </pre>
  ),
  hr: () => <hr className="growa-dotted-rule my-4" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-sage-700 underline underline-offset-2 hover:text-ink"
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
