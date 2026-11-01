/**
 * NFII logistics screening reference network.
 * Hubs are GEOGRAPHIC REFERENCE POINTS, not verified supplier locations,
 * schedules, port clearance, current services or bookable carrier routes.
 * A country may have many other suitable ports/airports.
 */
import {countryName} from './world-countries'

export type GeoPoint={lat:number;lon:number}
export type ExportHub={country:string;port:string;unlocode:string;
  sea:GeoPoint;airport:string;iata:string;air:GeoPoint;roadEligible:boolean}
const HUBS:Readonly<Record<string,ExportHub>>={
 IN:{country:'IN',port:'Nhava Sheva',unlocode:'INNSA',sea:{lat:18.95,lon:72.95},airport:'Mumbai',iata:'BOM',air:{lat:19.09,lon:72.87},roadEligible:false},
 PK:{country:'PK',port:'Karachi',unlocode:'PKKHI',sea:{lat:24.82,lon:66.98},airport:'Karachi',iata:'KHI',air:{lat:24.91,lon:67.17},roadEligible:false},
 VN:{country:'VN',port:'Ho Chi Minh',unlocode:'VNSGN',sea:{lat:10.76,lon:106.73},airport:'Ho Chi Minh',iata:'SGN',air:{lat:10.82,lon:106.65},roadEligible:false},
 TH:{country:'TH',port:'Laem Chabang',unlocode:'THLCH',sea:{lat:13.09,lon:100.88},airport:'Bangkok',iata:'BKK',air:{lat:13.68,lon:100.75},roadEligible:false},
 AU:{country:'AU',port:'Melbourne',unlocode:'AUMEL',sea:{lat:-37.84,lon:144.93},airport:'Melbourne',iata:'MEL',air:{lat:-37.67,lon:144.84},roadEligible:false},
 CN:{country:'CN',port:'Shanghai',unlocode:'CNSHA',sea:{lat:31.23,lon:121.50},airport:'Shanghai Pudong',iata:'PVG',air:{lat:31.14,lon:121.81},roadEligible:false},
 RU:{country:'RU',port:'Novorossiysk',unlocode:'RUNVS',sea:{lat:44.72,lon:37.77},airport:'Moscow',iata:'SVO',air:{lat:55.97,lon:37.41},roadEligible:false},
 UA:{country:'UA',port:'Odesa',unlocode:'UAODS',sea:{lat:46.48,lon:30.74},airport:'Kyiv',iata:'KBP',air:{lat:50.34,lon:30.89},roadEligible:false},
 RO:{country:'RO',port:'Constanta',unlocode:'ROCND',sea:{lat:44.17,lon:28.65},airport:'Bucharest',iata:'OTP',air:{lat:44.57,lon:26.10},roadEligible:false},
 BG:{country:'BG',port:'Varna',unlocode:'BGVAR',sea:{lat:43.20,lon:27.92},airport:'Sofia',iata:'SOF',air:{lat:42.70,lon:23.41},roadEligible:false},
 DE:{country:'DE',port:'Hamburg',unlocode:'DEHAM',sea:{lat:53.53,lon:9.99},airport:'Hamburg',iata:'HAM',air:{lat:53.63,lon:10.01},roadEligible:false},
 FR:{country:'FR',port:'Marseille',unlocode:'FRMRS',sea:{lat:43.31,lon:5.37},airport:'Marseille',iata:'MRS',air:{lat:43.44,lon:5.22},roadEligible:false},
 NL:{country:'NL',port:'Rotterdam',unlocode:'NLRTM',sea:{lat:51.91,lon:4.48},airport:'Amsterdam',iata:'AMS',air:{lat:52.31,lon:4.76},roadEligible:false},
 ES:{country:'ES',port:'Valencia',unlocode:'ESVLC',sea:{lat:39.45,lon:-0.32},airport:'Valencia',iata:'VLC',air:{lat:39.49,lon:-0.48},roadEligible:false},
 IT:{country:'IT',port:'Genoa',unlocode:'ITGOA',sea:{lat:44.40,lon:8.92},airport:'Milan Malpensa',iata:'MXP',air:{lat:45.63,lon:8.72},roadEligible:false},
 MA:{country:'MA',port:'Agadir',unlocode:'MAAGA',sea:{lat:30.42,lon:-9.60},airport:'Agadir',iata:'AGA',air:{lat:30.33,lon:-9.41},roadEligible:false},
 EG:{country:'EG',port:'Alexandria',unlocode:'EGALY',sea:{lat:31.19,lon:29.87},airport:'Cairo',iata:'CAI',air:{lat:30.12,lon:31.41},roadEligible:false},
 JO:{country:'JO',port:'Aqaba',unlocode:'JOAQJ',sea:{lat:29.53,lon:35.00},airport:'Amman',iata:'AMM',air:{lat:31.72,lon:35.99},roadEligible:true},
 SA:{country:'SA',port:'Dammam',unlocode:'SADMM',sea:{lat:26.44,lon:50.16},airport:'Dammam',iata:'DMM',air:{lat:26.47,lon:49.80},roadEligible:true},
 AE:{country:'AE',port:'Jebel Ali',unlocode:'AEJEA',sea:{lat:24.99,lon:55.06},airport:'Dubai',iata:'DXB',air:{lat:25.25,lon:55.36},roadEligible:true},
 OM:{country:'OM',port:'Sohar',unlocode:'OMSOH',sea:{lat:24.53,lon:56.60},airport:'Muscat',iata:'MCT',air:{lat:23.59,lon:58.28},roadEligible:true},
 KW:{country:'KW',port:'Shuwaikh',unlocode:'KWSWK',sea:{lat:29.35,lon:47.92},airport:'Kuwait City',iata:'KWI',air:{lat:29.23,lon:47.97},roadEligible:true},
 BH:{country:'BH',port:'Khalifa Bin Salman',unlocode:'BHKBS',sea:{lat:26.20,lon:50.68},airport:'Bahrain',iata:'BAH',air:{lat:26.27,lon:50.63},roadEligible:true},
 IR:{country:'IR',port:'Bandar Abbas',unlocode:'IRBND',sea:{lat:27.15,lon:56.27},airport:'Bandar Abbas',iata:'BND',air:{lat:27.22,lon:56.38},roadEligible:false},
 TR:{country:'TR',port:'Mersin',unlocode:'TRMER',sea:{lat:36.79,lon:34.63},airport:'Istanbul',iata:'IST',air:{lat:41.28,lon:28.75},roadEligible:false},
 ZA:{country:'ZA',port:'Durban',unlocode:'ZADUR',sea:{lat:-29.87,lon:31.03},airport:'Durban',iata:'DUR',air:{lat:-29.61,lon:31.12},roadEligible:false},
 US:{country:'US',port:'Houston',unlocode:'USHOU',sea:{lat:29.74,lon:-95.27},airport:'Houston',iata:'IAH',air:{lat:29.98,lon:-95.34},roadEligible:false},
 BR:{country:'BR',port:'Santos',unlocode:'BRSSZ',sea:{lat:-23.97,lon:-46.32},airport:'São Paulo',iata:'GRU',air:{lat:-23.44,lon:-46.47},roadEligible:false},
 AR:{country:'AR',port:'Buenos Aires',unlocode:'ARBUE',sea:{lat:-34.60,lon:-58.37},airport:'Buenos Aires',iata:'EZE',air:{lat:-34.82,lon:-58.53},roadEligible:false},
 PE:{country:'PE',port:'Callao',unlocode:'PECLL',sea:{lat:-12.05,lon:-77.14},airport:'Lima',iata:'LIM',air:{lat:-12.02,lon:-77.11},roadEligible:false},
 KE:{country:'KE',port:'Mombasa',unlocode:'KEMBA',sea:{lat:-4.04,lon:39.67},airport:'Nairobi',iata:'NBO',air:{lat:-1.32,lon:36.93},roadEligible:false},
 UG:{country:'UG',port:'Mombasa via Kenya (proxy only)',unlocode:'KEMBA',sea:{lat:-4.04,lon:39.67},airport:'Entebbe',iata:'EBB',air:{lat:0.04,lon:32.44},roadEligible:false},
 BD:{country:'BD',port:'Chattogram',unlocode:'BDCGP',sea:{lat:22.32,lon:91.82},airport:'Dhaka',iata:'DAC',air:{lat:23.84,lon:90.40},roadEligible:false},
 LB:{country:'LB',port:'Beirut',unlocode:'LBBEY',sea:{lat:33.91,lon:35.51},airport:'Beirut',iata:'BEY',air:{lat:33.82,lon:35.49},roadEligible:false},
 TN:{country:'TN',port:'Rades',unlocode:'TNRDS',sea:{lat:36.77,lon:10.30},airport:'Tunis',iata:'TUN',air:{lat:36.85,lon:10.23},roadEligible:false},
 GR:{country:'GR',port:'Piraeus',unlocode:'GRPIR',sea:{lat:37.95,lon:23.63},airport:'Athens',iata:'ATH',air:{lat:37.94,lon:23.95},roadEligible:false},
 GB:{country:'GB',port:'Felixstowe',unlocode:'GBFXT',sea:{lat:51.95,lon:1.31},airport:'London Heathrow',iata:'LHR',air:{lat:51.47,lon:-0.45},roadEligible:false},
 CA:{country:'CA',port:'Montreal',unlocode:'CAMTR',sea:{lat:45.51,lon:-73.55},airport:'Montreal',iata:'YUL',air:{lat:45.46,lon:-73.75},roadEligible:false},
 PS:{country:'PS',port:'Aqaba regional port proxy',unlocode:'JOAQJ',sea:{lat:29.53,lon:35.00},airport:'Amman regional hub proxy',iata:'AMM',air:{lat:31.72,lon:35.99},roadEligible:false},
 IQ:{country:'IQ',port:'Umm Qasr',unlocode:'IQUQR',sea:{lat:30.05,lon:47.94},airport:'Baghdad',iata:'BGW',air:{lat:33.26,lon:44.23},roadEligible:false},
};
export const QATAR_PORT={name:'Hamad Port, Qatar',code:'QAHMD',
  lat:25.00,lon:51.61} as const
export const QATAR_AIR={name:'Hamad International Airport, Doha',code:'DOH',
  lat:25.27,lon:51.61} as const
export const QATAR_ROAD={name:'Abu Samra border via Doha',code:'QAABS',
  lat:24.74,lon:50.82} as const
export const getExportHub=(country:string):ExportHub|null=>HUBS[country.toUpperCase()]??null
export const HUB_COUNTRIES=Object.keys(HUBS).map(code=>({countryCode:code,
  countryName:countryName(code)})).sort((a,b)=>a.countryName.localeCompare(b.countryName))
export const HUB_SOURCE='UNECE UN/LOCODE reference; representative cargo gateways, not service confirmation.'
export function haversineKm(a:GeoPoint,b:GeoPoint):number{
  const rad=Math.PI/180,R=6371,lat=(b.lat-a.lat)*rad,lon=(b.lon-a.lon)*rad
  const d=Math.sin(lat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*
    Math.sin(lon/2)**2
  return 2*R*Math.asin(Math.min(1,Math.sqrt(d)))
}
export type CargoSpec={
  crop:string;label:string;coldChain:boolean;maxTransitDays:number;
  temperature:string;productClass:'fresh'|'chilled'|'ambient'
}
export const CARGO_SPECS:Record<string,CargoSpec>={
  tomato:{crop:'tomato',label:'Fresh tomatoes',coldChain:true,maxTransitDays:10,temperature:'Product-specific controlled temperature',productClass:'fresh'},
  cucumber:{crop:'cucumber',label:'Fresh cucumbers',coldChain:true,maxTransitDays:9,temperature:'Avoid chilling injury; qualified refrigeration',productClass:'fresh'},
  pepper:{crop:'pepper',label:'Fresh bell peppers',coldChain:true,maxTransitDays:14,temperature:'Product-specific controlled temperature',productClass:'fresh'},
  lettuce:{crop:'lettuce',label:'Fresh lettuce',coldChain:true,maxTransitDays:5,temperature:'Near 0°C verified cold chain',productClass:'fresh'},
  date:{crop:'date',label:'Dates (dry/chilled depends on SKU)',coldChain:false,maxTransitDays:60,temperature:'Verify moisture, packaging and variety',productClass:'ambient'},
  milk:{crop:'milk',label:'Fresh refrigerated milk',coldChain:true,maxTransitDays:3,temperature:'Continuous verified cold chain',productClass:'chilled'},
  rice:{crop:'rice',label:'Dry rice',coldChain:false,maxTransitDays:60,temperature:'Dry moisture-controlled packaging',productClass:'ambient'},
  barley:{crop:'barley',label:'Barley (feed/food grade must match)',coldChain:false,maxTransitDays:60,temperature:'Dry bulk with grade/contamination controls',productClass:'ambient'},
  wheat:{crop:'wheat',label:'Wheat',coldChain:false,maxTransitDays:60,temperature:'Dry bulk with grade/contamination controls',productClass:'ambient'},
}
export function validateLaneInput(params:URLSearchParams):
  {ok:true;commodity:string;country:string;tonnes:number;limitDays:number}|
  {ok:false;error:string}{
  const commodity=params.get('commodity')??''
  const country=(params.get('country')??'').trim().toUpperCase()
  const tonnes=Number(params.get('tonnes')??'20')
  const limitDays=Number(params.get('limitDays')??String(CARGO_SPECS[commodity]?.maxTransitDays??15))
  if(!CARGO_SPECS[commodity])return {ok:false,error:'Unsupported food commodity'}
  if(!HUBS[country])return {ok:false,error:'No documented reference gateway for selected origin'}
  if(!Number.isFinite(tonnes)||tonnes<0.1||tonnes>200)
    return {ok:false,error:'Quantity must be 0.1–200 tonnes'}
  if(!Number.isInteger(limitDays)||limitDays<1||limitDays>120)
    return {ok:false,error:'Delivery deadline must be 1–120 days'}
  return {ok:true,commodity,country,tonnes,limitDays}
}
