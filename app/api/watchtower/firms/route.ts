import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {getFirmsSnapshot} from '@/lib/watchtower/firms-hotspots'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=30
export async function GET(){
  const supabase=await createClient()
  const {data:{user},error}=await supabase.auth.getUser()
  if(error||!user)return NextResponse.json({error:'Authentication required'},{
    status:401,headers:{'Cache-Control':'private, no-store'}})
  return NextResponse.json(await getFirmsSnapshot(),{
    headers:{'Cache-Control':'private, no-store'}})
}
