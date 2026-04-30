'use client'

import { BatteryCharging, Bolt, Gauge, LineChart, Zap } from 'lucide-react'

export function EnergyIntelligenceWorkspace() {
  return (
    <div className="space-y-6 p-6 pt-20 text-foreground">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_0_0_1px_rgba(7,248,128,0.08),0_24px_60px_rgba(0,0,0,0.32)]">
        <p className="text-xs uppercase tracking-[0.22em] text-primary">Energy Intelligence</p>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold text-foreground">
          <Bolt className="h-7 w-7 text-primary" />
          Energy Intelligence Command
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Side-map operational workspace for monitoring farm energy performance, loads, and efficiency trends.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card/80 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Total Energy</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">98,420 kWh</p>
        </div>
        <div className="rounded-xl border border-border bg-card/80 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Average / Farm</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">2,187 kWh</p>
        </div>
        <div className="rounded-xl border border-border bg-card/80 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Peak Load</p>
          <p className="mt-2 text-2xl font-semibold text-amber-300">142 kW</p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-primary/90">Efficiency Index</p>
          <p className="mt-2 text-2xl font-semibold text-primary">84.2 / 100</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 xl:col-span-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <LineChart className="h-5 w-5 text-primary" />
            Farm Energy Signals
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This panel keeps the same lateral-map interaction model and can be connected to energy telemetry APIs.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
            Placeholder: time-series load curve, energy-per-crop overlays, and anomaly alerts.
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <BatteryCharging className="h-4 w-4 text-primary" />
              Active Monitoring
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              17 farms with live energy telemetry streams connected.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Gauge className="h-4 w-4 text-primary" />
              Load Alert Window
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              3 sites currently near threshold and requiring balancing action.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Zap className="h-4 w-4 text-primary" />
              Next Step
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect energy API endpoints to replace placeholder cards and summaries.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
