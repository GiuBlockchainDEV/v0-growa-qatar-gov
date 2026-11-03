import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {getRegionalAirBatch} from '@/lib/watchtower/regional-air-grid'
import {REGIONAL_AIR_BATCH_COUNT} from '@/lib/watchtower/regional-air-shared'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=30
const headers={'Cache-Control':'private, no-store, max-age=0'}
export async function GET(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user},error}=await supabase.auth.getUser()
    if(error||!user)return NextResponse.json({error:'Authentication required'},{status:401,headers})
    const input=new URL(request.url).searchParams.get('batch')??''
    if(!/^[0-9]{1,2}$/.test(input)||Number(input)>=REGIONAL_AIR_BATCH_COUNT)
      return NextResponse.json({error:'Invalid regional ADS-B batch'},{status:400,headers})
    return NextResponse.json(await getRegionalAirBatch(Number(input)),{headers})
  }catch{
    return NextResponse.json({error:'Regional ADS-B source unavailable; no aircraft simulated.'},
      {status:503,headers})
  }
}
