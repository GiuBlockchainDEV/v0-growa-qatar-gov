import { redirect } from 'next/navigation'

/**
 * Compatibility redirect for the legacy, fixture-backed "Supply overview".
 * NFII 2.0 now shows actual organization-sourced operations in Watchtower
 * and its Procurement and Logistics modules.
 */
export default function SupplyOverviewRedirect() {
  redirect('/dashboard?module=watchtower#watchtower-operations')
}
