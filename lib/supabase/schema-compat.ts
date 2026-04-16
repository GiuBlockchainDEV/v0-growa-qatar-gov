type MaybeSchemaError =
  | string
  | null
  | undefined
  | {
      message?: string | null
      code?: string | null
    }

type OrganizationCompatInput = {
  type?: string | null
  organization_type?: string | null
} | null | undefined

const SCHEMA_MISMATCH_CODES = new Set(['42703', '42P01', 'PGRST204', 'PGRST116'])

function normalizeText(value: string | null | undefined) {
  return value?.toLowerCase().trim() || ''
}

function normalizeOrgType(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

// Canonical schema-mismatch detector.
export function isSchemaMismatchError(error: MaybeSchemaError): boolean {
  if (!error) return false

  if (typeof error === 'string') {
    const text = normalizeText(error)
    return (
      text.includes('schema cache') ||
      text.includes('does not exist') ||
      text.includes('could not find') ||
      text.includes('column') ||
      text.includes('relation')
    )
  }

  if (error.code && SCHEMA_MISMATCH_CODES.has(error.code)) {
    return true
  }

  const message = normalizeText(error.message || '')
  return (
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('could not find') ||
    message.includes('column') ||
    message.includes('relation')
  )
}

// Backward-compatible alias used across older code paths.
export const isMissingColumnError = isSchemaMismatchError
export const isSchemaMissingError = isSchemaMismatchError

// Canonical organization type resolver (prefer organization_type, then type).
export function resolveOrganizationType(input: OrganizationCompatInput): string | null {
  if (!input) return null
  return normalizeOrgType(input.organization_type) || normalizeOrgType(input.type) || null
}

// Backward-compatible aliases.
export const getOrganizationType = resolveOrganizationType
export const getOrganizationTypeFromRow = resolveOrganizationType
export const resolveOrgTypeForRow = resolveOrganizationType
export const getOrganizationTypeValue = resolveOrganizationType

export function getOrganizationTypeFilterColumns(): Array<'type' | 'organization_type'> {
  return ['type', 'organization_type']
}

export function normalizeOrganization<T extends Record<string, unknown>>(row: T) {
  const resolvedType = resolveOrganizationType(row as OrganizationCompatInput)
  return {
    ...row,
    type: (row.type as string | null | undefined) ?? resolvedType,
    organization_type: (row.organization_type as string | null | undefined) ?? resolvedType,
    orgType: resolvedType,
  }
}

export function normalizeOrganizationRows<T extends Record<string, unknown>>(rows: T[]) {
  return rows.map((row) => normalizeOrganization(row))
}
