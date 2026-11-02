/**
 * Indicative freight COST RANGE for food import planning, not a tariff feed.
 *
 * Priority: user-entered carrier rate > Freightos dry FCL benchmark (direct sea
 * only, 1-22 tonnes) > configurable distance/weight-based planning model.
 * Model coefficients below are scenario assumptions, NOT observed spot prices.
 * The freight calculation excludes duties, taxes, insurance and actual pickup.
 */
import type {FreightEstimate} from './logistics-freight-benchmark'
import type {Mode,ScreenedRoute} from './logistics-screening'

export type CostSource='entered_rate'|'marketplace_benchmark'|'planning_model'
export type FreightCharge={minQar:number;maxQar:number}
export type FreightCostEstimate={
  currency:'QAR'
  source:CostSource
  sourceLabel:string
  sourceUrl:string|null
  observedAt:string|null
  minQar:number
  maxQar:number
  minQarKg:number
  maxQarKg:number
  units:number|null
  unitLabel:string
  modelDistanceKm:number|null
  breakdown:{
    linehaul:FreightCharge
    handling:FreightCharge
    coldChain:FreightCharge
    transferAndBorder:FreightCharge
  }
  assumptions:string[]
}
export type FreightCostInput={
  routeId:string
  mode:Mode
  distanceKm:number
  distanceType:ScreenedRoute['distanceType']
  tonnes:number
  coldChain:boolean
  via:string|null
  enteredRateQarPerTonne:number|null
  marketplaceEstimate?:FreightEstimate|null
}

const money=(value:number)=>Math.round(value*100)/100
const charge=(min:number,max:number):FreightCharge=>({
  minQar:money(min),maxQar:money(max),
})
const ZERO=charge(0,0)

/** Weight-only payload caps; pallet count and volumetric capacity are unknown. */
export const COST_MODEL={
  dryContainerTonnes:22,
  reeferContainerTonnes:17,
  dryTruckTonnes:24,
  reeferTruckTonnes:18,
  airRateMinQarKgBase:4.2,
  airRateMinQarKgPer1000Km:0.72,
  airRateMaxQarKgBase:8.3,
  airRateMaxQarKgPer1000Km:1.65,
} as const

function assemble(
  source:CostSource,sourceLabel:string,sourceUrl:string|null,
  observedAt:string|null,tonnes:number,units:number|null,
  unitLabel:string,modelDistanceKm:number|null,
  breakdown:FreightCostEstimate['breakdown'],assumptions:string[],
):FreightCostEstimate{
  const charges=Object.values(breakdown)
  const minQar=money(charges.reduce((sum,item)=>sum+item.minQar,0))
  const maxQar=money(charges.reduce((sum,item)=>sum+item.maxQar,0))
  return {
    currency:'QAR',source,sourceLabel,sourceUrl,observedAt,
    minQar,maxQar,minQarKg:money(minQar/tonnes/1000*1000)/1000,
    maxQarKg:money(maxQar/tonnes/1000*1000)/1000,
    units,unitLabel,modelDistanceKm,breakdown,assumptions,
  }
}

export function estimateFreightCost(input:FreightCostInput):FreightCostEstimate|null{
  const {routeId,mode,tonnes,coldChain,via,enteredRateQarPerTonne,
    marketplaceEstimate,distanceKm,distanceType}=input
  if(!Number.isFinite(tonnes)||tonnes<0.1||tonnes>200)return null
  const kg=tonnes*1000
  const entered=enteredRateQarPerTonne
  if(entered!==null&&Number.isFinite(entered)&&entered>0&&entered<100000){
    const linehaul=charge(entered*tonnes,entered*tonnes)
    return assemble('entered_rate','User-entered carrier / forwarder rate',null,
      null,tonnes,null,'Rate per tonne',null,{
        linehaul,handling:ZERO,coldChain:ZERO,transferAndBorder:ZERO,
      },[
        'Rate entered by the user, not independently authenticated as a carrier quotation.',
        'This total excludes any fees not included in the entered QAR/tonne price.',
        via?'The same mode-level rate was entered for alternative hubs; transfer costs may differ.':
          'Actual service availability and transport terms remain unverified.',
      ])
  }
  if(mode==='sea'&&routeId==='sea_direct'&&!coldChain&&tonnes>=1&&tonnes<=22&&
    marketplaceEstimate?.mode==='sea'&&
    Number.isFinite(marketplaceEstimate.amountMinQar)&&
    Number.isFinite(marketplaceEstimate.amountMaxQar)&&
    marketplaceEstimate.amountMinQar>0&&
    marketplaceEstimate.amountMaxQar>=marketplaceEstimate.amountMinQar){
    return assemble('marketplace_benchmark','Freightos FCL marketplace benchmark',
      marketplaceEstimate.sourceUrl,marketplaceEstimate.checkedAt,
      tonnes,1,'40-ft dry container',null,{
        linehaul:charge(marketplaceEstimate.amountMinQar,
          marketplaceEstimate.amountMaxQar),
        handling:ZERO,coldChain:ZERO,transferAndBorder:ZERO,
      },[
        'Non-binding public marketplace FCL benchmark; not a bookable rate.',
        'USD benchmark converted at 3.64 QAR per USD.',
        'Local terminal, pickup, customs, insurance and other charges are not verified or added.',
      ])
  }
  if(!Number.isFinite(distanceKm)||distanceKm<=0||distanceKm>50000)return null

  const proxy=mode==='sea'&&distanceType==='straight_line_lower_bound'
  // Straight lines may cross land. A broad proxy is used ONLY for preliminary
  // budget ranges, never to claim a navigable route or rate.
  const lowerKm=proxy?distanceKm*1.25:distanceKm
  const upperKm=proxy?distanceKm*2.4:distanceKm
  let units:number|null=null
  let unitLabel='Chargeable gross weight; volume unverified'
  let linehaul=ZERO
  let handling=ZERO
  let cooling=ZERO
  let transfer=ZERO
  if(mode==='sea'){
    units=Math.ceil(tonnes/(coldChain?
      COST_MODEL.reeferContainerTonnes:COST_MODEL.dryContainerTonnes))
    unitLabel=coldChain?'40-ft reefer container (weight-only)':
      '40-ft dry container (weight-only)'
    linehaul=charge(units*(2300+0.7*lowerKm),
      units*(4900+1.5*upperKm))
    handling=charge(units*1600,units*3600)
    if(coldChain)cooling=charge(units*(1400+0.12*lowerKm),
      units*(3100+0.28*upperKm))
    if(via)transfer=charge(units*1200,units*3600)
  }else if(mode==='air'){
    const distance1000=distanceKm/1000
    linehaul=charge(kg*(COST_MODEL.airRateMinQarKgBase+
      COST_MODEL.airRateMinQarKgPer1000Km*distance1000),
      kg*(COST_MODEL.airRateMaxQarKgBase+
      COST_MODEL.airRateMaxQarKgPer1000Km*distance1000))
    handling=charge(kg*0.55+500,kg*1.5+1500)
    if(coldChain)cooling=charge(kg*0.8,kg*2.1)
    if(via)transfer=charge(kg*0.8,kg*1.8)
  }else{
    units=Math.ceil(tonnes/(coldChain?
      COST_MODEL.reeferTruckTonnes:COST_MODEL.dryTruckTonnes))
    unitLabel=coldChain?'Refrigerated truckload (weight-only)':
      'Truckload (weight-only)'
    linehaul=charge(units*(900+2.8*distanceKm),
      units*(1800+6.2*distanceKm))
    handling=charge(units*450,units*1500)
    if(coldChain)cooling=charge(units*(400+0.45*distanceKm),
      units*(1300+1.2*distanceKm))
    transfer=charge(units*450,units*1800)
  }
  const assumptions=[
    'Illustrative planning tariff assumptions, not retrieved carrier rates or a live quote.',
    'Range includes modeled linehaul and handling allowances; cold-chain and transfer/border allowances where applicable.',
    'Excludes duties, import taxes, insurance, demurrage, spoilage, and unverified door-to-door pickup/delivery.',
    mode==='air'?
      'Air charged on gross kg only; volumetric weight, capacity, schedule and actual flown route are unknown.':
      'Number of vehicles/containers is estimated from weight only; package volume may increase it.',
  ]
  if(proxy)assumptions.push('Sea route is NOT verified; broad 1.25-2.4x straight-line distance proxy makes this range especially uncertain.')
  if(mode==='road')assumptions.push('Road geometry is a passenger-car reference, not confirmed truck access or border clearance.')
  if(via)assumptions.push('Transfer-hub fees and service viability are modeled; no scheduled transshipment verified.')
  return assemble('planning_model','Distance-based planning estimate',
    null,null,tonnes,units,unitLabel,Math.round(distanceKm),{
      linehaul,handling,coldChain:cooling,transferAndBorder:transfer,
    },assumptions)
}
