import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {getDataTrackingSnapshot} from '@/lib/watchtower/data-tracking-net'

export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=30
const headers={'Cache-Control':'private, no-store, max-age=0'}

export async function GET(){
  try{
    const supabase=await createClient()
    const {data:{user},error}=await supabase.auth.getUser()
    if(error||!user)return NextResponse.json(
      {error:'Sign in to access maritime chokepoint intelligence.'},
      {status:401,headers},
    )
    return NextResponse.json(await getDataTrackingSnapshot(),{headers})
  }catch{
    return NextResponse.json({
      error:'The public chokepoint AIS source is unavailable. No ship positions are simulated.',
    },{status:503,headers})
  }
}
