import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {getOpenWatersSnapshot} from '@/lib/watchtower/open-waters-ais'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=30
const headers={'Cache-Control':'private, no-store, max-age=0'}
export async function GET(){
  try{
    const client=await createClient()
    const {data:{user},error}=await client.auth.getUser()
    if(error||!user)return NextResponse.json({error:'Authentication required'},{status:401,headers})
    return NextResponse.json(await getOpenWatersSnapshot(),{headers})
  }catch{
    return NextResponse.json({error:'Open Waters AIS request failed'},{status:503,headers})
  }
}
