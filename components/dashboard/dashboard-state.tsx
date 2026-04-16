'use client'

import type { ReactNode } from 'react'
import { AlertCircle, FileSearch, Info } from 'lucide-react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

type DashboardStateVariant = 'loading' | 'error' | 'empty' | 'notice'

interface DashboardStateProps {
  variant: DashboardStateVariant
  title?: string
  description: string
  className?: string
  action?: ReactNode
}

export function DashboardState({
  variant,
  title,
  description,
  className,
  action,
}: DashboardStateProps) {
  const resolvedTitle =
    title ||
    (variant === 'loading'
      ? 'Loading'
      : variant === 'error'
        ? 'Unable to continue'
        : variant === 'empty'
          ? 'Nothing to show'
          : 'Notice')

  const media =
    variant === 'loading' ? (
      <Spinner className="size-5 text-[#07f880]" />
    ) : variant === 'error' ? (
      <AlertCircle className="size-5 text-red-300" />
    ) : variant === 'empty' ? (
      <FileSearch className="size-5 text-muted-foreground" />
    ) : (
      <Info className="size-5 text-sky-300" />
    )

  return (
    <Empty className={cn('border border-white/10 bg-white/[0.02] py-10', className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">{media}</EmptyMedia>
        <EmptyTitle>{resolvedTitle}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action}
    </Empty>
  )
}
