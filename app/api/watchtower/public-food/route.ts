import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {getPublicFoodSnapshot} from '@/lib/watchtower/public-food-intelligence'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=30
const headers={'Cache-Control':'private, no-store'}
export async function GET(){
  try{
    const supabase=await createClient()
    const {data:{user},error}=await supabase.auth.getUser()
    if(error||!user)return NextResponse.json({error:'Authentication required'},{status:401,headers})
    return NextResponse.json(await getPublicFoodSnapshot(),{headers})
  }catch{
    return NextResponse.json({error:'Public global food sources unavailable'},{status:503,headers})
  }
}
