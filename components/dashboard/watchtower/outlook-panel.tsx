'use client'

import type { OutlookSummary } from '@/lib/domain/types'

interface OutlookPanelProps {
  outlook?: OutlookSummary
}

export function WatchtowerOutlookPanel({ outlook }: OutlookPanelProps) {
  if (!outlook) {
    return <p className="text-sm text-white/50">Outlook data unavailable.</p>
  }

  const sevenDayItems = [
    { label: 'Climate', value: outlook.sevenDay?.climate },
    { label: 'Irrigation demand', value: outlook.sevenDay?.irrigationDemand },
    { label: 'Crop stress', value: outlook.sevenDay?.cropStress },
    { label: 'Operational risk', value: outlook.sevenDay?.operationalRisk },
  ]

  const thirtyDayItems = [
    { label: 'Harvest', value: outlook.thirtyDay?.harvest },
    { label: 'Production', value: outlook.thirtyDay?.production },
    { label: 'Water requirement', value: outlook.thirtyDay?.waterRequirement },
    { label: 'Supply implications', value: outlook.thirtyDay?.supplyImplications },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">7-day outlook</h4>
        <div className="space-y-2">
          {sevenDayItems.map((item) => (
            <div key={item.label} className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-white/40">{item.label}</p>
              <p className="mt-1 text-xs text-white/70 leading-relaxed">
                {item.value || 'Insufficient data'}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">30-day outlook</h4>
        <div className="space-y-2">
          {thirtyDayItems.map((item) => (
            <div key={item.label} className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-white/40">{item.label}</p>
              <p className="mt-1 text-xs text-white/70 leading-relaxed">
                {item.value || 'Insufficient data'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
