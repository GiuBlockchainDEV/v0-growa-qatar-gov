import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {getFlightRouteLookups} from '@/lib/watchtower/tracking-providers'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=30
const headers={'Cache-Control':'private, no-store, max-age=0'}
export async function GET(){
  try{
    const supabase=await createClient()
    const {data:{user},error}=await supabase.auth.getUser()
    if(error||!user)return NextResponse.json({error:'Sign in to use route intelligence.'},
      {status:401,headers})
    return NextResponse.json(await getFlightRouteLookups(),{headers})
  }catch{
    return NextResponse.json({error:'Route providers unavailable; aircraft positions remain accessible.'},
      {status:503,headers})
  }
}
