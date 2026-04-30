'use client'

import { Droplets, Gauge, Leaf, Waves } from 'lucide-react'

export function WaterIntelligenceWorkspace() {
  return (
    <div className="space-y-6 p-6 pt-20 text-foreground">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_0_0_1px_rgba(7,248,128,0.08),0_20px_50px_rgba(0,0,0,0.35)]">
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <Droplets className="h-6 w-6 text-primary" />
          Water Intelligence
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Lateral intelligence view focused on water allocation, irrigation pressure, and consumption efficiency.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card/80 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Irrigation Pressure</p>
          <p className="mt-2 text-2xl font-semibold text-primary">74.8%</p>
        </div>
        <div className="rounded-xl border border-border bg-card/80 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Water Intensity</p>
          <p className="mt-2 text-2xl font-semibold">12.4 m³/t</p>
        </div>
        <div className="rounded-xl border border-border bg-card/80 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Reuse Ratio</p>
          <p className="mt-2 text-2xl font-semibold text-sky-300">31%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Waves className="h-4 w-4 text-primary" />
            Basin Monitoring
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Module scaffold ready for basin-level telemetry and anomaly detection streams.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Gauge className="h-4 w-4 text-primary" />
            Efficiency Signals
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect this panel to crop-level water productivity and forecasted stress indicators.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Leaf className="h-4 w-4 text-primary" />
          Recommendations
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Prioritize variable-rate irrigation where polygon scores drop below 60.</li>
          <li>Shift high-consumption blocks to night windows for lower evapotranspiration.</li>
          <li>Increase reuse blending on sectors with stable salinity readings.</li>
        </ul>
      </div>
    </div>
  )
}
