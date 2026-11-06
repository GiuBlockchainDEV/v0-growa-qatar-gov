import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {getAisStreamSnapshot} from '@/lib/watchtower/aisstream-snapshot'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=20
export async function GET(){
 const supabase=await createClient()
 const {data:{user},error}=await supabase.auth.getUser()
 if(error||!user)return NextResponse.json({error:'Authentication required'},{
  status:401,headers:{'Cache-Control':'private, no-store'}})
 return NextResponse.json(await getAisStreamSnapshot(),{
  headers:{'Cache-Control':'private, no-store'}})
}
