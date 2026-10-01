'use client'

/* The three Settings tabs. State and actions come from useSettings(). */

import { type Locale } from '@/lib/i18n'
import { Bell, Building2, Globe2, Mail, Save, ShieldCheck, UserPlus, UserRound, Users } from 'lucide-react'
import { Card, Notice } from '@/components/brand/layout'
import { Button, Field, SegmentedToggle, Select, Switch } from '@/components/brand/ui'
import { StatusTag, humanize } from '@/components/brand/status'
import { ORGANIZATION_TYPE_OPTIONS, ROLE_OPTIONS, type AssignableRole, type OrganizationType } from './settings-model'
import type { SettingsState } from './use-settings'

export function ProfileTab({ s }: { s: SettingsState }) {
  const { currentRole, firstName, handleSaveProfile, initials, lastName, organization, roleLabel, savingProfile, setFirstName, setLastName, tr, user } = s
  return (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card icon={UserRound} title={tr('Personal details')}>
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div className="flex items-center gap-4">
                  <div
                    aria-hidden="true"
                    className="h-14 w-14 shrink-0 bg-ink text-cream flex items-center justify-center text-[20px]"
                    style={{ borderRadius: 14, fontWeight: 500 }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[16px] text-content truncate" style={{ fontWeight: 500 }}>
                      {[firstName, lastName].filter(Boolean).join(' ') || tr('Add your name')}
                    </p>
                    <p className="text-[13px] text-content-soft truncate">{user?.email}</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={tr('First name')}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                  <Field
                    label={tr('Last name')}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
                <Field
                  label={tr('Email')}
                  value={user?.email ?? ''}
                  readOnly
                  disabled
                  prefix={<Mail strokeWidth={1.5} className="h-4 w-4" />}
                  hint={tr('The sign-in email cannot be changed here.')}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingProfile}>
                    <Save strokeWidth={1.5} className="h-4 w-4" />
                    {savingProfile ? tr('Saving…') : tr('Save profile')}
                  </Button>
                </div>
              </form>
            </Card>

            <Card icon={ShieldCheck} title={tr('Access')}>
              <dl className="divide-y divide-dotted divide-line-strong -my-1 text-[14px]">
                <div className="flex items-start justify-between gap-3 py-2.5">
                  <dt className="text-content-soft">{tr('Organisation')}</dt>
                  <dd className="text-content text-end">{organization?.name || tr('Not assigned')}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 py-2.5">
                  <dt className="text-content-soft">{tr('Role')}</dt>
                  <dd className="text-content text-end">{currentRole ? roleLabel(currentRole) : tr('No role assigned')}</dd>
                </div>
              </dl>
            </Card>
          </div>
  )
}

export function PreferencesTab({ s }: { s: SettingsState }) {
  const { handleLanguageChange, handleSavePreferences, languageChoice, notificationCriticalOnly, notificationEmail, notificationInApp, savingPreferences, setNotificationCriticalOnly, setNotificationEmail, setNotificationInApp, tr } = s
  return (
          <div className="grid gap-4 md:grid-cols-2">
            <Card icon={Globe2} title={tr('Language')} subtitle={tr('Applied at once to the whole platform.')}>
              <SegmentedToggle
                ariaLabel={tr('Interface language')}
                value={languageChoice}
                onChange={(value) => void handleLanguageChange(value as Locale)}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'ar', label: 'العربية' },
                ]}
              />
              <p className="text-[12px] text-content-soft">
                {tr('Arabic also mirrors the layout from right to left.')}
              </p>
            </Card>

            <Card icon={Bell} title={tr('Notifications')}>
              <div className="divide-y divide-dotted divide-line-strong -my-1">
                {[
                  { label: tr('Email notifications'), checked: notificationEmail, set: setNotificationEmail },
                  { label: tr('In-app notifications'), checked: notificationInApp, set: setNotificationInApp },
                  { label: tr('Critical alerts only'), checked: notificationCriticalOnly, set: setNotificationCriticalOnly },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 py-2.5 text-[14px] text-content">
                    <span>{row.label}</span>
                    <Switch checked={row.checked} onChange={row.set} label={row.label} />
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleSavePreferences} disabled={savingPreferences}>
                  <Save strokeWidth={1.5} className="h-4 w-4" />
                  {savingPreferences ? tr('Saving…') : tr('Save notifications')}
                </Button>
              </div>
            </Card>
          </div>
  )
}

export function OrganizationTab({ s }: { s: SettingsState }) {
  const { availableFarms, availableOrganizations, canManageUsers, createOrgDescription, createOrgName, createOrgSlug, createOrgType, dateLocale, farmNameById, handleCreateOrganization, handleDeleteInviteRequest, handleInvite, handleInviteRequest, handleRemove, handleRoleChange, hasPendingInviteRequest, inviteEmail, inviteRequestFarmId, inviteRequestMessage, inviteRequestOrgId, inviteRequiresFarmSelection, inviteRole, isCreatingOrganization, isDeletingRequest, members, orgTypeLabel, organization, organizationNameById, roleLabel, saving, selectedInviteOrganization, sentInviteRequests, setCreateOrgDescription, setCreateOrgName, setCreateOrgSlug, setCreateOrgType, setInviteEmail, setInviteRequestFarmId, setInviteRequestMessage, setInviteRequestOrgId, setInviteRole, tr } = s
  return (
          <div className="space-y-4">
            <Card
              icon={Users}
              title={tr('Members')}
              subtitle={organization?.name || tr('No organisation assigned')}
              flush
            >
              <div className="p-4 space-y-3">
                {canManageUsers ? (
                  /* Stacks on narrow cards; the button keeps its size instead of
                     squeezing its label into an `auto` grid column. */
                  <form onSubmit={handleInvite} className="flex flex-col gap-3 md:flex-row md:items-end">
                    <Field
                      className="md:flex-1"
                      label={tr('Email')}
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="user@domain.com"
                      required
                    />
                    <Select
                      className="md:w-44"
                      label={tr('Role')}
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as AssignableRole)}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role.value} value={role.value}>
                          {roleLabel(role.value)}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" disabled={saving} className="md:self-end">
                      <UserPlus strokeWidth={1.5} className="h-4 w-4" />
                      {tr('Add member')}
                    </Button>
                  </form>
                ) : (
                  <p className="text-[14px] text-content-soft">
                    {tr('You do not have permission to manage members.')}
                  </p>
                )}
              </div>

              <div className="overflow-x-auto border-t border-line">
                <table className="g-table g-table--pad w-full">
                  <thead>
                    <tr>
                      <th>{tr('User')}</th>
                      <th>{tr('Role')}</th>
                      <th className="text-end"><span className="sr-only">{tr('Actions')}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id}>
                        <td className="text-content">{member.email || member.user_id}</td>
                        <td>
                          {canManageUsers ? (
                            <select
                              aria-label={tr('Role')}
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.id, e.target.value as AssignableRole)}
                              className="h-9 rounded-md border border-line-strong bg-card px-3 text-[13px] text-content focus:border-sage focus:outline-none"
                            >
                              {!ROLE_OPTIONS.some((role) => role.value === member.role) && (
                                <option value={member.role}>{roleLabel(String(member.role))}</option>
                              )}
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role.value} value={role.value}>
                                  {roleLabel(role.value)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span>{roleLabel(String(member.role))}</span>
                          )}
                        </td>
                        <td className="text-end">
                          {canManageUsers && (
                            <Button size="sm" variant="ghost" className="text-critical" onClick={() => handleRemove(member.id)}>
                              {tr('Remove')}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {members.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-content-soft">
                          {tr('No members found.')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card
                family="comando"
                icon={Building2}
                title={tr('Create an organisation')}
                subtitle={tr('You become its owner.')}
              >
                <form onSubmit={handleCreateOrganization} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label={tr('Name')}
                      value={createOrgName}
                      onChange={(e) => setCreateOrgName(e.target.value)}
                      required
                    />
                    <Field
                      label={tr('Short address')}
                      hint={tr('Lowercase, no spaces.')}
                      value={createOrgSlug}
                      onChange={(e) => setCreateOrgSlug(e.target.value)}
                      placeholder="organisation-name"
                      dir="ltr"
                      required
                    />
                    <Select
                      label={tr('Type')}
                      value={createOrgType}
                      onChange={(e) => setCreateOrgType(e.target.value as OrganizationType)}
                    >
                      {ORGANIZATION_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {orgTypeLabel(option.value)}
                        </option>
                      ))}
                    </Select>
                    <Field
                      label={tr('Description')}
                      hint={tr('Optional.')}
                      value={createOrgDescription}
                      onChange={(e) => setCreateOrgDescription(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isCreatingOrganization}>
                      {isCreatingOrganization ? tr('Creating…') : tr('Create organisation')}
                    </Button>
                  </div>
                </form>
              </Card>

              <Card
                icon={Mail}
                title={tr('Request an invitation')}
                subtitle={tr('Ask to join an existing organisation; its administrators approve it.')}
              >
                <form onSubmit={handleInviteRequest} className="space-y-4">
                  <Select
                    label={tr('Organisation')}
                    value={inviteRequestOrgId}
                    onChange={(e) => {
                      setInviteRequestOrgId(e.target.value)
                      setInviteRequestFarmId('')
                    }}
                    required
                    hint={
                      !inviteRequiresFarmSelection && selectedInviteOrganization
                        ? `${tr('Type')}: ${orgTypeLabel(selectedInviteOrganization.organizationType)}`
                        : undefined
                    }
                  >
                    <option value="">{tr('Select an organisation')}</option>
                    {availableOrganizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </Select>
                  {inviteRequiresFarmSelection && (
                    <Select
                      label={tr('Farm')}
                      value={inviteRequestFarmId}
                      onChange={(e) => setInviteRequestFarmId(e.target.value)}
                      required
                      error={
                        availableFarms.length === 0
                          ? tr('This farm company has no farms yet: a farm is required.')
                          : undefined
                      }
                    >
                      <option value="">{tr('Select a farm')}</option>
                      {availableFarms.map((farm) => (
                        <option key={farm.id} value={farm.id}>
                          {farm.name}
                        </option>
                      ))}
                    </Select>
                  )}
                  <Field
                    label={tr('Note')}
                    hint={tr('Optional.')}
                    value={inviteRequestMessage}
                    onChange={(e) => setInviteRequestMessage(e.target.value)}
                  />
                  {hasPendingInviteRequest && (
                    <Notice tone="warning">
                      {tr('You already have a pending request: only one at a time.')}
                    </Notice>
                  )}
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={saving || hasPendingInviteRequest || (inviteRequiresFarmSelection && !inviteRequestFarmId)}
                    >
                      {tr('Send request')}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>

            <Card icon={Mail} title={tr('Your invitation requests')} flush>
              <div className="overflow-x-auto">
                <table className="g-table g-table--pad w-full">
                  <thead>
                    <tr>
                      <th>{tr('Organisation')}</th>
                      <th>{tr('Role')}</th>
                      <th>{tr('Farm')}</th>
                      <th>{tr('Status')}</th>
                      <th>{tr('Sent')}</th>
                      <th className="text-end"><span className="sr-only">{tr('Actions')}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentInviteRequests.map((request) => (
                      <tr key={request.id}>
                        <td>{organizationNameById.get(request.organizationId) || request.organizationId}</td>
                        <td>{roleLabel(request.requestedRole)}</td>
                        <td>
                          {request.requestedFarmId ? farmNameById.get(request.requestedFarmId) || request.requestedFarmId : '—'}
                        </td>
                        <td>
                          <StatusTag
                            level={request.status === 'approved' ? 'good' : request.status === 'rejected' ? 'critical' : 'unknown'}
                            label={
                              ({
                                approved: tr('Approved'),
                                rejected: tr('Rejected'),
                                pending: tr('Pending'),
                                cancelled: tr('Cancelled'),
                              } as Record<string, string>)[request.status] ?? humanize(request.status)
                            }
                          />
                        </td>
                        <td className="text-content-soft tabular-nums">
                          {request.createdAt ? new Date(request.createdAt).toLocaleDateString(dateLocale) : '—'}
                        </td>
                        <td className="text-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-critical"
                            onClick={() => handleDeleteInviteRequest(request.id)}
                            disabled={isDeletingRequest}
                          >
                            {tr('Delete')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {sentInviteRequests.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-content-soft">
                          {tr('No requests sent yet.')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
  )
}
