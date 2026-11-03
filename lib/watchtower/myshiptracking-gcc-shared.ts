/** Client-safe GCC radar constants and DTO types; never import server-side
 * AIS, route-geometry or node:fs dependencies from a React component. */
import type {TrackingAsset} from './global-tracking'
export const GCC_RADAR_INTERVAL_MS=5*60000
export const GCC_RADAR_MIN_SPEED_KNOTS=1.5
export const GCC_PORTS=[
  {id:'AEJEA',label:'Jebel Ali · Dubai (UAE)',lat:25.02413,lon:55.04112,unloco:'AEJEA'},
  {id:'QAHMD',label:'Hamad Port (Qatar)',lat:25.02946,lon:51.62450,unloco:'QAHMD'},
  {id:'QADOH',label:'Doha Port (Qatar)',lat:25.30644,lon:51.54737,unloco:'QADOH'},
  {id:'QARLF',label:'Ras Laffan (Qatar)',lat:25.91669,lon:51.62693,unloco:'QARLF'},
] as const
/** Verified source pages in the region shown on the Watchtower screenshot.
 * These are discovery ports, not a claim of full AIS coverage over open sea.
 * Keep the paid GCC API ports above unchanged.
 */
export const REGIONAL_SCAN_PORTS=[
  {id:'AEFJR',label:'Fujairah · Gulf of Oman (UAE)',lat:25.14916,lon:56.36416,unloco:'AEFJR',
    url:'https://www.myshiptracking.com/ports/port-of-fujairah-in-ae-uae-id-3510'},
  {id:'OMSOH',label:'Sohar (Oman)',lat:24.50582,lon:56.63091,unloco:'OMSOH',
    url:'https://www.myshiptracking.com/ports/port-of-sohar-in-om-oman-id-3479'},
  {id:'OMSLL',label:'Salalah (Oman)',lat:16.95314,lon:54.02416,unloco:'OMSLL',
    url:'https://www.myshiptracking.com/ports/port-of-salalah-in-om-oman-id-3477'},
  {id:'SADMM',label:'Dammam · Gulf (Saudi Arabia)',lat:26.49736,lon:50.16472,unloco:'SADMM',
    url:'https://www.myshiptracking.com/ports/port-of-dammam-in-sa-saudi-arabia-id-3445'},
  {id:'SAJUB',label:'Jubail · Gulf (Saudi Arabia)',lat:27.11078,lon:49.69211,unloco:'SAJUB',
    url:'https://www.myshiptracking.com/ports/port-of-al-jubail-in-sa-saudi-arabia-id-3450'},
  {id:'BHKBS',label:'Khalifa Bin Salman (Bahrain)',lat:26.20064,lon:50.70637,unloco:'BHKBS',
    url:'https://www.myshiptracking.com/ports/port-of-khalifa-bin-salman-in-bh-bahrain-id-5907'},
  {id:'IQUQR',label:'Umm Qasr · Gulf (Iraq)',lat:30.03356,lon:47.95304,unloco:'IQUQR',
    url:'https://www.myshiptracking.com/ports/port-of-umm-qasr-in-iq-iraq-id-5896'},
  {id:'SAJED',label:'Jeddah · Red Sea (Saudi Arabia)',lat:21.46219,lon:39.14749,unloco:'SAJED',
    url:'https://www.myshiptracking.com/ports/port-of-jeddah-in-sa-saudi-arabia-id-3441'},
  {id:'DJJIB',label:'Djibouti · Bab el-Mandeb',lat:11.61172,lon:43.12628,unloco:'DJJIB',
    url:'https://www.myshiptracking.com/ports/port-of-djibouti-in-dj-djibouti-id-3430'},
  {id:'YEADE',label:'Aden · Gulf of Aden (Yemen)',lat:12.80028,lon:45.01225,unloco:'YEADE',
    url:'https://www.myshiptracking.com/ports/port-of-aden-in-ye-yemen-id-3454'},
] as const
export const MONITORED_MARITIME_PORTS=[...GCC_PORTS,...REGIONAL_SCAN_PORTS] as const
export type GccHubId=typeof MONITORED_MARITIME_PORTS[number]['id']
export type GccRadarState='not_configured'|'available'|'partial'|'unavailable'
export type GccHubReport={
  id:GccHubId;label:string;status:GccRadarState
  candidates:number;observed:number;withRoutes:number
  /** Optional public-page scan diagnostics (not provided by licensed API). */
  inspected?:number;incomplete?:number;blocked?:number;cargoClass?:number
  sourceUrl:string;detail:string
}
export type GccRadarSnapshot={
  generatedAt:string;refreshSeconds:300;source:'MyShipTracking API'|'MyShipTracking public pages'
  status:GccRadarState;configured:boolean
  hubs:GccHubReport[];assets:TrackingAsset[];sourceUrl:string
  checked:number;moving:number;withRoutes:number
  sourceNote:string;maxShipsPerHub:number
  creditsCharged:number|null
}
