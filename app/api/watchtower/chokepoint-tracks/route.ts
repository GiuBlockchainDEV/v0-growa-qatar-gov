import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {getDataTrackingSnapshot} from '@/lib/watchtower/data-tracking-net'
import {fetchAISHistory,getAISOverview} from '@/lib/watchtower/data-tracking-history'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=30
const headers={'Cache-Control':'private, no-store, max-age=0'}

export async function GET(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user},error}=await supabase.auth.getUser()
    if(error||!user)return NextResponse.json(
      {error:'Sign in to view historical AIS routes.'},{status:401,headers})
    const url=new URL(request.url)
    const mmsi=url.searchParams.get('mmsi')
    const id=url.searchParams.get('chokepoint')
    if(mmsi!==null){
      if(!/^[1-9]\d{8}$/.test(mmsi)||
        (id!=='hormuz'&&id!=='bab_el_mandeb'))
        return NextResponse.json({error:'Invalid vessel history selection.'},{status:400,headers})
      return NextResponse.json(await fetchAISHistory(id,mmsi),{headers})
    }
    // Overview routes never prevent the fast basic position endpoint.
    const data=await getDataTrackingSnapshot()
    return NextResponse.json(await getAISOverview(data.assets),{headers})
  }catch{
    return NextResponse.json({error:'Historical AIS observations unavailable. Routes are not inferred.'},
      {status:503,headers})
  }
}
