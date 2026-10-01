'use client'

import { LoadingState, Notice, PageBody, PageHeader } from '@/components/brand/layout'
import { SegmentedToggle } from '@/components/brand/ui'
import { useSettings } from './use-settings'
import { OrganizationTab, PreferencesTab, ProfileTab } from './settings-tabs'

/* Settings: Profile, Preferences, Organisation. The page lays out the header
   and tabs; state lives in useSettings(), each tab in settings-tabs.tsx. */
export default function SettingsPage() {
  const s = useSettings()
  const { tab, error, loading, message, setError, setMessage, setTab, tr } = s

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <LoadingState label={tr('Loading settings…')} />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <PageBody>
        <PageHeader
          eyebrow={tr('Account')}
          title={tr('Settings')}
          subtitle={tr('Your profile, your preferences and your organisation.')}
        />

        <SegmentedToggle
          className="mb-5"
          ariaLabel={tr('Settings sections')}
          value={tab}
          onChange={(value) => {
            setMessage(null)
            setError(null)
            setTab(value)
          }}
          options={[
            { value: 'profile', label: tr('Profile') },
            { value: 'preferences', label: tr('Preferences') },
            { value: 'organization', label: tr('Organisation') },
          ]}
        />

        {(message || error) && (
          <div className="mb-4 space-y-2" aria-live="polite">
            {message && <Notice tone="good">{message}</Notice>}
            {error && <Notice tone="critical">{error}</Notice>}
          </div>
        )}

        {tab === 'profile' && <ProfileTab s={s} />}

        {tab === 'preferences' && <PreferencesTab s={s} />}

        {tab === 'organization' && <OrganizationTab s={s} />}
      </PageBody>
    </div>
  )
}
