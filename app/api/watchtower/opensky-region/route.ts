import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {getOpenSkySnapshot} from '@/lib/watchtower/opensky-regional'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=20
export async function GET(){
 const supabase=await createClient()
 const {data:{user},error}=await supabase.auth.getUser()
 if(error||!user)return NextResponse.json({error:'Authentication required'},{status:401})
 try{
  return NextResponse.json(await getOpenSkySnapshot(),{
   headers:{'Cache-Control':'private, no-store'},
  })
 }catch{
  return NextResponse.json({error:'OpenSky source unavailable'},{status:503})
 }
}
