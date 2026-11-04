import { redirect } from 'next/navigation'

/**
 * Strategic Reserves has been retired from the user interface.
 * Preserve the legacy URL for bookmarks without rendering an empty module.
 * Operational inventory records and authorized APIs remain unchanged.
 */
export default function RetiredReservesRedirect(){
  redirect('/dashboard?module=watchtower#watchtower-operations')
}
