import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {getIpcRiskSnapshot} from '@/lib/watchtower/ipc-food-security'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=30
const headers={'Cache-Control':'private, no-store, max-age=0'}
export async function GET(){
  try{
    const supabase=await createClient()
    const {data:{user},error}=await supabase.auth.getUser()
    if(error||!user)
      return NextResponse.json({error:'Sign in required'},{status:401,headers})
    return NextResponse.json(await getIpcRiskSnapshot(),{headers})
  }catch{
    return NextResponse.json({error:'IPC country assessments unavailable'},{status:503,headers})
  }
}
