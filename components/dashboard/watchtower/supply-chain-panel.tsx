'use client'

import Link from 'next/link'
import type { SupplySummary } from '@/lib/domain/types'
import { ArrowRight } from 'lucide-react'

interface SupplyChainPanelProps {
  supply: SupplySummary
}

function fmt(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined) return { text: 'Insufficient data', muted: true }
  return { text: `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${unit}`, muted: false }
}

export function SupplyChainPanel({ supply }: SupplyChainPanelProps) {
  const volume = fmt(supply.availableVolume?.value, supply.availableVolume?.unit || 't')
  const atRisk = fmt(supply.atRiskDeliveries?.value, 'lots')
  const coverage = fmt(supply.coverage?.value, '%')

  const steps = [
    { label: 'Crop production', status: 'partial', detail: 'From operational insights' },
    { label: 'Expected harvest', status: 'partial', detail: 'Harvest API when configured' },
    { label: 'Domestic supply', status: volume.muted ? 'missing' : 'available', detail: volume.text },
    { label: 'Demand / target', status: 'missing', detail: 'Insufficient data' },
    { label: 'Coverage', status: coverage.muted ? 'missing' : 'partial', detail: coverage.text },
    { label: 'Projected gap', status: 'missing', detail: 'Insufficient data' },
  ]

  const statusColor = {
    available: 'text-[#07f880]',
    partial: 'text-amber-300',
    missing: 'text-white/35',
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0d12] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">Food security chain</h3>
        <Link
          href="/dashboard/supply-overview"
          className="inline-flex items-center gap-1 text-[10px] text-[#07f880] hover:underline"
        >
          Supply Overview
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-0">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-stretch gap-3">
            <div className="flex flex-col items-center w-4 shrink-0">
              <div className={`h-2 w-2 rounded-full mt-1.5 ${
                step.status === 'available' ? 'bg-[#07f880]' :
                step.status === 'partial' ? 'bg-amber-400' : 'bg-white/20'
              }`} />
              {index < steps.length - 1 && <div className="w-px flex-1 bg-white/10 my-0.5" />}
            </div>
            <div className="pb-3 flex-1 min-w-0">
              <p className="text-xs text-white/80">{step.label}</p>
              <p className={`text-[10px] mt-0.5 ${statusColor[step.status as keyof typeof statusColor]}`}>
                {step.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      {!atRisk.muted && (
        <p className="mt-1 text-[10px] text-amber-300 border-t border-white/5 pt-2">
          {atRisk.text} at risk in supply flows
        </p>
      )}
    </div>
  )
}
