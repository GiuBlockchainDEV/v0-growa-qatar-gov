import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {
 parseNearbyPublicCameras,validCameraCoordinates,
 type PublicCameraResult,
} from '@/lib/watchtower/public-cameras'

export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=15
const headers={'Cache-Control':'private, no-store, max-age=0'}
function result(state:PublicCameraResult['state'],detail:string):PublicCameraResult{
 return {state,source:'Windy Webcams',detail,cameras:[],checkedAt:new Date().toISOString()}
}
export async function GET(request:Request){
 const supabase=await createClient()
 const {data:{user},error}=await supabase.auth.getUser()
 if(error||!user)return NextResponse.json({error:'Authentication required'},{status:401,headers})
 const query=new URL(request.url).searchParams
 const lat=Number(query.get('lat')),lon=Number(query.get('lon'))
 if(!query.has('lat')||!query.has('lon')||!validCameraCoordinates(lat,lon))
  return NextResponse.json({error:'Valid map coordinates required'},{status:400,headers})
 const key=process.env.WINDY_WEBCAMS_API_KEY?.trim()
 if(!key)return NextResponse.json(result('unconfigured',
  'Windy Webcams API key not configured. The virtual tracking view remains available.'),{headers})
 const endpoint=new URL('https://api.windy.com/webcams/api/v3/webcams')
 endpoint.searchParams.set('nearby',[lat.toFixed(5),lon.toFixed(5),'80'].join(','))
 endpoint.searchParams.set('include','location,player,urls,images')
 endpoint.searchParams.set('limit','25')
 try{
  const response=await fetch(endpoint,{headers:{'x-windy-key':key,Accept:'application/json'},
   cache:'no-store',signal:AbortSignal.timeout(11500)})
  if(!response.ok)throw Error('Webcam provider HTTP '+response.status)
  const payload:unknown=await response.json()
  const cameras=parseNearbyPublicCameras(payload,lat,lon)
  const data:PublicCameraResult={
   state:cameras.length?'available':'no_matches',
   detail:cameras.length?'Nearby fixed public cameras. Not cameras on the selected vehicle.':
    'No embeddable public cameras found within 80 km.',
   cameras,source:'Windy Webcams',checkedAt:new Date().toISOString(),
  }
  return NextResponse.json(data,{headers})
 }catch{
  return NextResponse.json(result('unavailable',
   'Public webcam provider unavailable; no video has been generated or substituted.'),{headers})
 }
}
