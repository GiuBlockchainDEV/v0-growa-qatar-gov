'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpenCheck, PencilLine, Plus, RefreshCw, Save, X } from 'lucide-react'
import { useOrganization } from '@/hooks/use-organization'
import { DashboardState } from '@/components/dashboard/dashboard-state'

type FarmOption = {
  id: string
  name: string
}

type LogbookEntry = {
  id: string
  organization_id: string
  farm_id: string | null
  entry_date: string
  activity_category: string
  operation_title: string
  crop_name: string | null
  product_name: string | null
  active_substance: string | null
  quantity: number | null
  unit: string | null
  treated_area: number | null
  area_unit: string | null
  weather_conditions: string | null
  operator_name: string | null
  notes: string | null
  status: 'draft' | 'completed'
  created_at: string
}

type FormState = {
  entry_date: string
  farm_id: string
  activity_category: string
  operation_title: string
  crop_name: string
  product_name: string
  active_substance: string
  quantity: string
  unit: string
  treated_area: string
  area_unit: string
  weather_conditions: string
  operator_name: string
  notes: string
  status: 'draft' | 'completed'
}

const CATEGORY_OPTIONS = [
  'Planting',
  'Fertilization',
  'Irrigation',
  'Plant Protection',
  'Harvest',
  'Soil Work',
  'Monitoring',
  'Other',
]

const STATUS_OPTIONS: Array<{ value: 'draft' | 'completed'; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'completed', label: 'Completed' },
]

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function createEmptyFormState(): FormState {
  return {
    entry_date: todayIsoDate(),
    farm_id: '',
    activity_category: 'Monitoring',
    operation_title: '',
    crop_name: '',
    product_name: '',
    active_substance: '',
    quantity: '',
    unit: 'kg',
    treated_area: '',
    area_unit: 'ha',
    weather_conditions: '',
    operator_name: '',
    notes: '',
    status: 'draft',
  }
}

export default function FieldLogbookPage() {
  const { organization } = useOrganization()
  const [farms, setFarms] = useState<FarmOption[]>([])
  const [entries, setEntries] = useState<LogbookEntry[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [formState, setFormState] = useState<FormState>(createEmptyFormState())
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const farmNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const farm of farms) map.set(farm.id, farm.name)
    return map
  }, [farms])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const farmMatches = !selectedFarmId || entry.farm_id === selectedFarmId
      const categoryMatches = !selectedCategory || entry.activity_category === selectedCategory
      return farmMatches && categoryMatches
    })
  }, [entries, selectedCategory, selectedFarmId])

  const fetchFarms = useCallback(async () => {
    const response = await fetch('/api/operations/farms', { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.error || 'Unable to load farms.')
    }

    const farmRows = Array.isArray(payload) ? payload : []
    const mapped: FarmOption[] = farmRows.map((farm: Record<string, unknown>) => ({
      id: String(farm.id),
      name:
        (typeof farm.name_en === 'string' && farm.name_en) ||
        (typeof farm.name === 'string' && farm.name) ||
        (typeof farm.code === 'string' && farm.code) ||
        String(farm.id),
    }))

    setFarms(mapped)
  }, [])

  const fetchEntries = useCallback(async () => {
    if (!organization?.id) {
      setEntries([])
      return
    }

    const params = new URLSearchParams({ organizationId: organization.id })
    if (selectedFarmId) params.set('farmId', selectedFarmId)
    const response = await fetch(`/api/operations/field-logbook?${params.toString()}`, {
      cache: 'no-store',
    })
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.error || 'Unable to load logbook entries.')
    }

    setEntries(Array.isArray(payload) ? (payload as LogbookEntry[]) : [])
  }, [organization?.id, selectedFarmId])

  const loadPageData = useCallback(async () => {
    if (!organization?.id) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      await fetchFarms()
      await fetchEntries()
    } catch (loadError) {
      console.error('[field-logbook] load failed', loadError)
      setError(loadError instanceof Error ? loadError.message : 'Unable to load field logbook.')
    } finally {
      setIsLoading(false)
    }
  }, [organization?.id, fetchEntries, fetchFarms])

  useEffect(() => {
    loadPageData()
  }, [loadPageData])

  const openCreateForm = () => {
    setEditingEntryId(null)
    setSuccessMessage(null)
    setError(null)
    const next = createEmptyFormState()
    next.farm_id = selectedFarmId || farms[0]?.id || ''
    setFormState(next)
    setIsFormOpen(true)
  }

  const openEditForm = (entry: LogbookEntry) => {
    setEditingEntryId(entry.id)
    setSuccessMessage(null)
    setError(null)
    setFormState({
      entry_date: entry.entry_date || todayIsoDate(),
      farm_id: entry.farm_id || '',
      activity_category: entry.activity_category || 'Monitoring',
      operation_title: entry.operation_title || '',
      crop_name: entry.crop_name || '',
      product_name: entry.product_name || '',
      active_substance: entry.active_substance || '',
      quantity: entry.quantity?.toString() || '',
      unit: entry.unit || 'kg',
      treated_area: entry.treated_area?.toString() || '',
      area_unit: entry.area_unit || 'ha',
      weather_conditions: entry.weather_conditions || '',
      operator_name: entry.operator_name || '',
      notes: entry.notes || '',
      status: entry.status || 'draft',
    })
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingEntryId(null)
    setFormState(createEmptyFormState())
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!organization?.id) return

    if (!formState.operation_title.trim()) {
      setError('Operation title is required.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    const payload = {
      organization_id: organization.id,
      farm_id: formState.farm_id || null,
      entry_date: formState.entry_date,
      activity_category: formState.activity_category,
      operation_title: formState.operation_title,
      crop_name: formState.crop_name || null,
      product_name: formState.product_name || null,
      active_substance: formState.active_substance || null,
      quantity: formState.quantity ? Number(formState.quantity) : null,
      unit: formState.unit || null,
      treated_area: formState.treated_area ? Number(formState.treated_area) : null,
      area_unit: formState.area_unit || null,
      weather_conditions: formState.weather_conditions || null,
      operator_name: formState.operator_name || null,
      notes: formState.notes || null,
      status: formState.status,
    }

    const endpoint = editingEntryId
      ? `/api/operations/field-logbook/${editingEntryId}`
      : '/api/operations/field-logbook'
    const method = editingEntryId ? 'PATCH' : 'POST'

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.error || 'Unable to save field logbook entry.')
      }

      await fetchEntries()
      closeForm()
      setSuccessMessage(
        editingEntryId
          ? 'Field logbook entry updated successfully.'
          : 'Field logbook entry created successfully.'
      )
    } catch (submitError) {
      console.error('[field-logbook] submit failed', submitError)
      setError(
        submitError instanceof Error ? submitError.message : 'Unable to save field logbook entry.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!organization?.id) {
    return (
      <div className="p-4 pt-20 md:p-6 md:pt-20">
        <DashboardState
          variant="notice"
          title="Organization required"
          description="You need an active organization before using the Field Logbook."
        />
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4 pt-20 md:p-6 md:pt-20">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Field Logbook</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Record agronomic activities, treatments, and field operations inspired by the Italian
              farming logbook model.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
            <BookOpenCheck className="h-3.5 w-3.5 text-[#07f880]" />
            {organization.name}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={selectedFarmId}
          onChange={(e) => setSelectedFarmId(e.target.value)}
          className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-[#07f880]/40 focus:outline-none"
        >
          <option value="">All farms</option>
          {farms.map((farm) => (
            <option key={farm.id} value={farm.id} className="bg-[#0f1115]">
              {farm.name}
            </option>
          ))}
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-[#07f880]/40 focus:outline-none"
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((category) => (
            <option key={category} value={category} className="bg-[#0f1115]">
              {category}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={loadPageData}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white hover:bg-white/10"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#07f880]/30 bg-[#07f880]/10 px-3 text-sm font-medium text-[#07f880] hover:bg-[#07f880]/20"
        >
          <Plus className="h-4 w-4" />
          New Entry
        </button>
      </div>

      {successMessage && (
        <div className="rounded-lg border border-[#07f880]/25 bg-[#07f880]/10 px-4 py-3 text-sm text-[#07f880]">
          {successMessage}
        </div>
      )}

      {error && (
        <DashboardState
          variant="error"
          title="Unable to load Field Logbook"
          description={error}
          className="py-8"
        />
      )}

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {editingEntryId ? 'Edit logbook entry' : 'Create logbook entry'}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="text-white/75">Entry date</span>
              <input
                type="date"
                value={formState.entry_date}
                onChange={(e) => setFormState((prev) => ({ ...prev, entry_date: e.target.value }))}
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
                required
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-white/75">Farm</span>
              <select
                value={formState.farm_id}
                onChange={(e) => setFormState((prev) => ({ ...prev, farm_id: e.target.value }))}
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
              >
                <option value="" className="bg-[#0f1115]">
                  Not specified
                </option>
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id} className="bg-[#0f1115]">
                    {farm.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-white/75">Category</span>
              <select
                value={formState.activity_category}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, activity_category: e.target.value }))
                }
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
              >
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category} className="bg-[#0f1115]">
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-white/75">Status</span>
              <select
                value={formState.status}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    status: e.target.value as 'draft' | 'completed',
                  }))
                }
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value} className="bg-[#0f1115]">
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-white/75">Operation title</span>
              <input
                type="text"
                value={formState.operation_title}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, operation_title: e.target.value }))
                }
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
                placeholder="e.g. Fungicide treatment - vineyard block A"
                required
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-white/75">Crop</span>
              <input
                type="text"
                value={formState.crop_name}
                onChange={(e) => setFormState((prev) => ({ ...prev, crop_name: e.target.value }))}
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-white/75">Operator</span>
              <input
                type="text"
                value={formState.operator_name}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, operator_name: e.target.value }))
                }
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-white/75">Product</span>
              <input
                type="text"
                value={formState.product_name}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, product_name: e.target.value }))
                }
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-white/75">Active substance</span>
              <input
                type="text"
                value={formState.active_substance}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, active_substance: e.target.value }))
                }
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-white/75">Quantity</span>
              <input
                type="number"
                step="0.01"
                value={formState.quantity}
                onChange={(e) => setFormState((prev) => ({ ...prev, quantity: e.target.value }))}
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-white/75">Unit</span>
              <input
                type="text"
                value={formState.unit}
                onChange={(e) => setFormState((prev) => ({ ...prev, unit: e.target.value }))}
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-white/75">Treated area</span>
              <input
                type="number"
                step="0.01"
                value={formState.treated_area}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, treated_area: e.target.value }))
                }
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-white/75">Area unit</span>
              <input
                type="text"
                value={formState.area_unit}
                onChange={(e) => setFormState((prev) => ({ ...prev, area_unit: e.target.value }))}
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-white/75">Weather conditions</span>
              <input
                type="text"
                value={formState.weather_conditions}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, weather_conditions: e.target.value }))
                }
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
                placeholder="Sunny, 18°C, light wind"
              />
            </label>

            <label className="space-y-1 text-sm md:col-span-2 xl:col-span-4">
              <span className="text-white/75">Notes</span>
              <textarea
                value={formState.notes}
                onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
                className="min-h-24 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-[#07f880]/40 focus:outline-none"
                placeholder="Additional operational notes..."
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#07f880]/30 bg-[#07f880]/10 px-4 text-sm font-medium text-[#07f880] hover:bg-[#07f880]/20 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Saving...' : editingEntryId ? 'Update entry' : 'Create entry'}
            </button>

            <button
              type="button"
              onClick={closeForm}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm text-white/80 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <DashboardState variant="loading" title="Loading Field Logbook" description="Please wait..." />
      ) : filteredEntries.length === 0 ? (
        <DashboardState
          variant="empty"
          title="No logbook entries"
          description="Start by creating your first field operation record."
          action={
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#07f880]/30 bg-[#07f880]/10 px-4 text-sm font-medium text-[#07f880] hover:bg-[#07f880]/20"
            >
              <Plus className="h-4 w-4" />
              Create first entry
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/50">Date</th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/50">Farm</th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/50">
                  Category
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/50">
                  Operation
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/50">
                  Product
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/50">Qty</th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/50">Area</th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/50">Status</th>
                <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-white/50">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-white/85">
                    {entry.entry_date ? new Date(entry.entry_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-3 py-2 text-white/80">
                    {entry.farm_id ? farmNameById.get(entry.farm_id) || entry.farm_id : '-'}
                  </td>
                  <td className="px-3 py-2 text-white/80">{entry.activity_category}</td>
                  <td className="px-3 py-2 text-white">{entry.operation_title}</td>
                  <td className="px-3 py-2 text-white/80">{entry.product_name || '-'}</td>
                  <td className="px-3 py-2 text-white/80">
                    {entry.quantity !== null && entry.quantity !== undefined
                      ? `${entry.quantity} ${entry.unit || ''}`.trim()
                      : '-'}
                  </td>
                  <td className="px-3 py-2 text-white/80">
                    {entry.treated_area !== null && entry.treated_area !== undefined
                      ? `${entry.treated_area} ${entry.area_unit || ''}`.trim()
                      : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                        entry.status === 'completed'
                          ? 'bg-[#07f880]/15 text-[#07f880]'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openEditForm(entry)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/80 hover:bg-white/10 hover:text-white"
                    >
                      <PencilLine className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
