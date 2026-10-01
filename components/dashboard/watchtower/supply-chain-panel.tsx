'use client'

import Link from 'next/link'
import type { SupplySummary } from '@/lib/domain/types'
import { ArrowRight, Link2 } from 'lucide-react'
import { Card } from '@/components/brand/layout'
import { StatusDot } from '@/components/brand/ui'
import { useI18n } from '@/lib/i18n'

interface SupplyChainPanelProps {
  supply: SupplySummary
}

function fmt(value: number | null | undefined, unit: string, insufficient: string) {
  if (value === null || value === undefined) return { text: insufficient, muted: true }
  return { text: `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${unit}`, muted: false }
}

export function SupplyChainPanel({ supply }: SupplyChainPanelProps) {
  const { tr } = useI18n()
  const insufficient = tr('Insufficient data')
  const volume = fmt(supply.availableVolume?.value, supply.availableVolume?.unit || 't', insufficient)
  const atRisk = fmt(supply.atRiskDeliveries?.value, tr('lots'), insufficient)
  const coverage = fmt(supply.coverage?.value, '%', insufficient)

  const steps = [
    { label: tr('Crop production'), status: 'partial', detail: tr('From operational insights') },
    { label: tr('Expected harvest'), status: 'partial', detail: tr('Harvest API when configured') },
    { label: tr('Domestic supply'), status: volume.muted ? 'missing' : 'available', detail: volume.text },
    { label: tr('Demand / target'), status: 'missing', detail: insufficient },
    { label: tr('Coverage'), status: coverage.muted ? 'missing' : 'partial', detail: coverage.text },
    { label: tr('Projected gap'), status: 'missing', detail: insufficient },
  ]

  /* The chain as a column of squares joined by a hairline: sage where the
     data is there, ochre where it is partial, unlit where it is missing. */
  const statusTone = {
    available: 'var(--status-good)',
    partial: 'var(--warning)',
    missing: 'var(--growa-stone-300)',
  } as const

  return (
    <Card
      icon={Link2}
      title={tr('Food security chain')}
    >
      <ol>
        {steps.map((step, index) => (
          <li key={step.label} className="flex items-stretch gap-3">
            <div className="flex flex-col items-center w-3 shrink-0">
              <StatusDot tone={statusTone[step.status as keyof typeof statusTone]} size={8} className="mt-1" />
              {index < steps.length - 1 && <div className="w-px flex-1 bg-line-strong my-1" />}
            </div>
            <div className="pb-3 flex-1 min-w-0">
              <p className="text-[13px] text-content">{step.label}</p>
              <p className={`text-[12px] mt-0.5 ${step.status === 'missing' ? 'text-stone-500' : 'text-content-soft'}`}>
                {step.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {!atRisk.muted && (
        <p className="flex items-center gap-2 text-[12px] text-content border-t border-dotted border-line-strong pt-3">
          <StatusDot tone="warning" size={6} />
          {tr('{amount} at risk in supply flows', { amount: atRisk.text })}
        </p>
      )}
      <Link
        href="/dashboard/supply-overview"
        className="inline-flex items-center gap-1 text-[12px] text-sage-700 hover:text-ink transition-colors"
      >
        {tr('Supply overview')}
        <ArrowRight strokeWidth={1.5} className="h-3.5 w-3.5 rtl:-scale-x-100" />
      </Link>
    </Card>
  )
}
