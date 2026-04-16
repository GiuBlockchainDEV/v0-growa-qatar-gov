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

type CategoryKey =
  | 'Planting'
  | 'Fertilization'
  | 'Irrigation'
  | 'Plant Protection'
  | 'Harvest'
  | 'Soil Work'
  | 'Monitoring'
  | 'Other'

type CategoryFormSection = {
  label: string
  description: string
  fields: Array<
    | 'operation_title'
    | 'crop_name'
    | 'product_name'
    | 'active_substance'
    | 'quantity'
    | 'treated_area'
    | 'weather_conditions'
    | 'notes'
  >
}

const CATEGORY_SECTIONS: Record<CategoryKey, CategoryFormSection> = {
  Planting: {
    label: 'Planting',
    description: 'Simple section for sowing or transplanting activities.',
    fields: ['crop_name', 'quantity', 'treated_area', 'notes'],
  },
  Fertilization: {
    label: 'Fertilization',
    description: 'Register fertilizer product and applied quantity.',
    fields: ['product_name', 'quantity', 'treated_area', 'notes'],
  },
  Irrigation: {
    label: 'Irrigation',
    description: 'Track irrigation volume and weather context.',
    fields: ['quantity', 'weather_conditions', 'notes'],
  },
  'Plant Protection': {
    label: 'Plant Protection',
    description: 'Record treatment product, active substance, and treated area.',
    fields: [
      'crop_name',
      'product_name',
      'active_substance',
      'quantity',
      'treated_area',
      'weather_conditions',
      'notes',
    ],
  },
  Harvest: {
    label: 'Harvest',
    description: 'Capture crop harvested and resulting quantity.',
    fields: ['crop_name', 'quantity', 'treated_area', 'notes'],
  },
  'Soil Work': {
    label: 'Soil Work',
    description: 'Register tillage and soil preparation operations.',
    fields: ['operation_title', 'treated_area', 'notes'],
  },
  Monitoring: {
    label: 'Monitoring',
    description: 'Quick observations, scouting, and field checks.',
    fields: ['weather_conditions', 'notes'],
  },
  Other: {
    label: 'Other',
    description: 'Flexible section for any other field operation.',
    fields: ['operation_title', 'notes'],
  },
}

const CATEGORY_OPTIONS = Object.keys(CATEGORY_SECTIONS) as CategoryKey[]

const STATUS_OPTIONS: Array<{ value: 'draft' | 'completed'; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'completed', label: 'Completed' },
]

const UNIT_OPTIONS = ['kg', 'g', 'l', 'ml', 'm3', 't', 'units']
const AREA_UNIT_OPTIONS = ['ha', 'm²', 'ac']

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function isCategoryKey(value: string): value is CategoryKey {
  return Object.prototype.hasOwnProperty.call(CATEGORY_SECTIONS, value)
}

function defaultUnitByCategory(category: CategoryKey): string {
  switch (category) {
    case 'Irrigation':
      return 'm3'
    case 'Plant Protection':
      return 'l'
    default:
      return 'kg'
  }
}

function createEmptyFormState(defaultFarmId = '', defaultCategory: CategoryKey = 'Monitoring'): FormState {
  return {
    entry_date: todayIsoDate(),
    farm_id: defaultFarmId,
    activity_category: defaultCategory,
    operation_title: '',
    crop_name: '',
    product_name: '',
    active_substance: '',
    quantity: '',
    unit: defaultUnitByCategory(defaultCategory),
    treated_area: '',
    area_unit: 'ha',
    weather_conditions: '',
    operator_name: '',
    notes: '',
    status: 'draft',
  }
}

function parseNumberInput(value: string): number | null {
  const normalized = value.trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function renderCategoryFields({
  formState,
  setFormState,
  visibleFieldSet,
}: {
  formState: FormState
  setFormState: React.Dispatch<React.SetStateAction<FormState>>
  visibleFieldSet: Set<string>
}) {
  return (
    <>
      {(visibleFieldSet.has('operation_title') || formState.activity_category === 'Other') && (
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-white/75">Operation title</span>
          <input
            type="text"
            value={formState.operation_title}
            onChange={(e) => setFormState((prev) => ({ ...prev, operation_title: e.target.value }))}
            className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
            placeholder={`${formState.activity_category} activity`}
          />
        </label>
      )}

      {visibleFieldSet.has('crop_name') && (
        <label className="space-y-1 text-sm">
          <span className="text-white/75">Crop</span>
          <input
            type="text"
            value={formState.crop_name}
            onChange={(e) => setFormState((prev) => ({ ...prev, crop_name: e.target.value }))}
            className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
            placeholder="Tomato, Wheat, Olive..."
          />
        </label>
      )}

      {visibleFieldSet.has('product_name') && (
        <label className="space-y-1 text-sm">
          <span className="text-white/75">Product</span>
          <input
            type="text"
            value={formState.product_name}
            onChange={(e) => setFormState((prev) => ({ ...prev, product_name: e.target.value }))}
            className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
            placeholder="NPK 20-10-10, Copper..."
          />
        </label>
      )}

      {visibleFieldSet.has('active_substance') && (
        <label className="space-y-1 text-sm">
          <span className="text-white/75">Active substance</span>
          <input
            type="text"
            value={formState.active_substance}
            onChange={(e) => setFormState((prev) => ({ ...prev, active_substance: e.target.value }))}
            className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
            placeholder="Active ingredient"
          />
        </label>
      )}

      {visibleFieldSet.has('quantity') && (
        <>
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
            <select
              value={formState.unit}
              onChange={(e) => setFormState((prev) => ({ ...prev, unit: e.target.value }))}
              className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
            >
              {UNIT_OPTIONS.map((unit) => (
                <option key={unit} value={unit} className="bg-[#0f1115]">
                  {unit}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {visibleFieldSet.has('treated_area') && (
        <>
          <label className="space-y-1 text-sm">
            <span className="text-white/75">Area</span>
            <input
              type="number"
              step="0.01"
              value={formState.treated_area}
              onChange={(e) => setFormState((prev) => ({ ...prev, treated_area: e.target.value }))}
              className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-white/75">Area unit</span>
            <select
              value={formState.area_unit}
              onChange={(e) => setFormState((prev) => ({ ...prev, area_unit: e.target.value }))}
              className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
            >
              {AREA_UNIT_OPTIONS.map((unit) => (
                <option key={unit} value={unit} className="bg-[#0f1115]">
                  {unit}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {visibleFieldSet.has('weather_conditions') && (
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-white/75">Weather conditions</span>
          <input
            type="text"
            value={formState.weather_conditions}
            onChange={(e) => setFormState((prev) => ({ ...prev, weather_conditions: e.target.value }))}
            className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
            placeholder="Sunny, 18°C, light wind"
          />
        </label>
      )}

      {visibleFieldSet.has('notes') && (
        <label className="space-y-1 text-sm md:col-span-2 xl:col-span-4">
          <span className="text-white/75">Notes</span>
          <textarea
            value={formState.notes}
            onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
            className="min-h-24 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-[#07f880]/40 focus:outline-none"
            placeholder="Write short notes here..."
          />
        </label>
      )}
    </>
  )
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

  const selectedFormCategory = useMemo<CategoryKey>(() => {
    return isCategoryKey(formState.activity_category) ? formState.activity_category : 'Other'
  }, [formState.activity_category])

  const selectedCategorySection = CATEGORY_SECTIONS[selectedFormCategory]
  const visibleFieldSet = useMemo(
    () => new Set<string>(selectedCategorySection.fields),
    [selectedCategorySection.fields]
  )

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
    const defaultFarmId = selectedFarmId || farms[0]?.id || ''
    setFormState(createEmptyFormState(defaultFarmId))
    setIsFormOpen(true)
  }

  const openEditForm = (entry: LogbookEntry) => {
    setEditingEntryId(entry.id)
    setSuccessMessage(null)
    setError(null)

    const normalizedCategory = isCategoryKey(entry.activity_category)
      ? entry.activity_category
      : 'Other'

    setFormState({
      entry_date: entry.entry_date || todayIsoDate(),
      farm_id: entry.farm_id || '',
      activity_category: normalizedCategory,
      operation_title: entry.operation_title || '',
      crop_name: entry.crop_name || '',
      product_name: entry.product_name || '',
      active_substance: entry.active_substance || '',
      quantity: entry.quantity?.toString() || '',
      unit: entry.unit || defaultUnitByCategory(normalizedCategory),
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

  const handleCategoryChange = (category: CategoryKey) => {
    setFormState((prev) => ({
      ...prev,
      activity_category: category,
      unit: prev.unit.trim() ? prev.unit : defaultUnitByCategory(category),
      operation_title: prev.operation_title.trim() ? prev.operation_title : `${category} activity`,
    }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!organization?.id) return

    if (!formState.farm_id) {
      setError('Please select a farm.')
      return
    }

    const category = isCategoryKey(formState.activity_category) ? formState.activity_category : 'Other'
    const normalizedOperationTitle =
      formState.operation_title.trim() || `${CATEGORY_SECTIONS[category].label} activity`

    setIsSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    const payload = {
      organization_id: organization.id,
      farm_id: formState.farm_id || null,
      entry_date: formState.entry_date || todayIsoDate(),
      activity_category: category,
      operation_title: normalizedOperationTitle,
      crop_name: formState.crop_name.trim() || null,
      product_name: formState.product_name.trim() || null,
      active_substance: formState.active_substance.trim() || null,
      quantity: parseNumberInput(formState.quantity),
      unit: formState.unit.trim() || null,
      treated_area: parseNumberInput(formState.treated_area),
      area_unit: formState.area_unit.trim() || null,
      weather_conditions: formState.weather_conditions.trim() || null,
      operator_name: formState.operator_name.trim() || null,
      notes: formState.notes.trim() || null,
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
              Category-based farmer logbook, inspired by the Italian field book and optimized for
              quick daily entry.
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

          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <p className="text-sm font-medium text-white">1. Basic information</p>
            <p className="mt-1 text-xs text-white/60">Start with the minimum required details.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                  required
                >
                  <option value="" className="bg-[#0f1115]">
                    Select farm
                  </option>
                  {farms.map((farm) => (
                    <option key={farm.id} value={farm.id} className="bg-[#0f1115]">
                      {farm.name}
                    </option>
                  ))}
                </select>
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
                  placeholder="Farmer / worker name"
                />
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
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <p className="text-sm font-medium text-white">2. Choose category section</p>
            <p className="mt-1 text-xs text-white/60">
              Pick one section and complete only the fields needed for that activity.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((category) => {
                const active = selectedFormCategory === category
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategoryChange(category)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      active
                        ? 'border-[#07f880]/35 bg-[#07f880]/15 text-[#07f880]'
                        : 'border-white/15 bg-white/5 text-white/75 hover:bg-white/10'
                    }`}
                  >
                    {CATEGORY_SECTIONS[category].label}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-sm text-white/70">{selectedCategorySection.description}</p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <p className="text-sm font-medium text-white">3. {selectedCategorySection.label} details</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-white/75">Quick title</span>
                <select
                  value={formState.operation_title}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, operation_title: e.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
                >
                  <option value="" className="bg-[#0f1115]">
                    Select a quick title
                  </option>
                  {(
                    {
                      Planting: ['Seeding', 'Transplanting', 'Gap filling'],
                      Fertilization: ['Base fertilization', 'Top dressing', 'Foliar fertilization'],
                      Irrigation: ['Drip irrigation', 'Sprinkler irrigation', 'Emergency irrigation'],
                      'Plant Protection': ['Fungicide treatment', 'Insecticide treatment', 'Herbicide treatment'],
                      Harvest: ['Main harvest', 'Selective harvest', 'Trial harvest'],
                      'Soil Work': ['Tillage', 'Bed preparation', 'Mechanical weeding'],
                      Monitoring: ['Field scouting', 'Pest check', 'Growth check'],
                      Other: ['General operation', 'Maintenance activity', 'Other field task'],
                    } as Record<CategoryKey, string[]>
                  )[selectedFormCategory].map((title) => (
                    <option key={title} value={title} className="bg-[#0f1115]">
                      {title}
                    </option>
                  ))}
                </select>
              </label>

              {visibleFieldSet.has('operation_title') && (
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="text-white/75">Operation title</span>
                  <input
                    type="text"
                    value={formState.operation_title}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, operation_title: e.target.value }))
                    }
                    className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
                    placeholder={`${selectedCategorySection.label} activity`}
                  />
                </label>
              )}

              {visibleFieldSet.has('crop_name') && (
                <label className="space-y-1 text-sm">
                  <span className="text-white/75">Crop</span>
                  <input
                    type="text"
                    value={formState.crop_name}
                    onChange={(e) => setFormState((prev) => ({ ...prev, crop_name: e.target.value }))}
                    className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
                    placeholder="Tomato, Wheat, Olive..."
                  />
                </label>
              )}

              {visibleFieldSet.has('product_name') && (
                <label className="space-y-1 text-sm">
                  <span className="text-white/75">Product</span>
                  <input
                    type="text"
                    value={formState.product_name}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, product_name: e.target.value }))
                    }
                    className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
                    placeholder="NPK 20-10-10, Copper..."
                  />
                </label>
              )}

              {visibleFieldSet.has('active_substance') && (
                <label className="space-y-1 text-sm">
                  <span className="text-white/75">Active substance</span>
                  <input
                    type="text"
                    value={formState.active_substance}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, active_substance: e.target.value }))
                    }
                    className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
                    placeholder="Active ingredient"
                  />
                </label>
              )}

              {visibleFieldSet.has('quantity') && (
                <>
                  <label className="space-y-1 text-sm">
                    <span className="text-white/75">Quantity</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formState.quantity}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, quantity: e.target.value }))
                      }
                      className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-white/75">Unit</span>
                    <select
                      value={formState.unit}
                      onChange={(e) => setFormState((prev) => ({ ...prev, unit: e.target.value }))}
                      className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
                    >
                      {UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit} className="bg-[#0f1115]">
                          {unit}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              {visibleFieldSet.has('treated_area') && (
                <>
                  <label className="space-y-1 text-sm">
                    <span className="text-white/75">Area</span>
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
                    <select
                      value={formState.area_unit}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, area_unit: e.target.value }))
                      }
                      className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-[#07f880]/40 focus:outline-none"
                    >
                      {AREA_UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit} className="bg-[#0f1115]">
                          {unit}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              {visibleFieldSet.has('weather_conditions') && (
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
              )}

              {visibleFieldSet.has('notes') && (
                <label className="space-y-1 text-sm md:col-span-2 xl:col-span-4">
                  <span className="text-white/75">Notes</span>
                  <textarea
                    value={formState.notes}
                    onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
                    className="min-h-24 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-[#07f880]/40 focus:outline-none"
                    placeholder="Write short notes here..."
                  />
                </label>
              )}
            </div>
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
