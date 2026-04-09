'use client'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">⚙️ Settings</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Configure your profile and organization settings
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Settings features coming soon...
        </p>
      </div>
    </div>
  )
}
