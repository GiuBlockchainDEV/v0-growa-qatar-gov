'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { MouseEvent, ReactNode } from 'react'

/** Same-page query changes must push. Next.js 16 Link/replace can leave the previous module on screen. */
export function DashboardQueryLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string
  className?: string
  children: ReactNode
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  const router = useRouter()

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    event.preventDefault()
    router.push(href, { scroll: false })
  }

  return (
    <Link href={href} scroll={false} prefetch={false} className={className} onClick={handleClick}>
      {children}
    </Link>
  )
}
