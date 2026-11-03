import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {getOpenSeaFeedSnapshot} from '@/lib/watchtower/openseafeed'

export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=30
const headers={'Cache-Control':'private, no-store, max-age=0'}
export async function GET(){
  try{
    const supabase=await createClient()
    const {data:{user},error}=await supabase.auth.getUser()
    if(error||!user)return NextResponse.json({error:'Authentication required'},{status:401,headers})
    return NextResponse.json(await getOpenSeaFeedSnapshot(),{headers})
  }catch{
    return NextResponse.json({error:'Global AIS service unavailable.'},{status:503,headers})
  }
}
