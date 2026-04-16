import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isSchemaMismatchError,
  resolveOrganizationType,
  normalizeOrganizationRows,
} from '../lib/supabase/schema-compat.ts'

test('isSchemaMismatchError detects schema-cache/missing-column messages', () => {
  assert.equal(
    isSchemaMismatchError("Could not find the 'preferred_locale' column of 'profiles' in the schema cache"),
    true
  )
  assert.equal(
    isSchemaMismatchError('column "created_by" of relation "farms" does not exist'),
    true
  )
  assert.equal(
    isSchemaMismatchError('permission denied for table profiles'),
    false
  )
})

test('organization type resolution prefers organization_type over type', () => {
  assert.equal(resolveOrganizationType({ type: 'government', organization_type: 'private' }), 'private')
  assert.equal(resolveOrganizationType({ organization_type: 'farm_company' }), 'farm_company')
  assert.equal(resolveOrganizationType({}), null)
})

test('normalizeOrganizationRows computes fallback type fields', () => {
  const normalized = normalizeOrganizationRows([
    {
      id: 'org-1',
      name: 'Org One',
      slug: 'org-one',
      description: 'demo',
      organization_type: 'public',
    },
  ])[0]

  assert.equal(normalized.id, 'org-1')
  assert.equal(normalized.name, 'Org One')
  assert.equal(normalized.type, 'public')
  assert.equal(normalized.organization_type, 'public')
})
