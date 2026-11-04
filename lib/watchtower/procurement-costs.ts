/**
 * Keep goods contracts, customs price references and freight evidence separate.
 * Annual customs values are normally CIF-like; adding freight would double-count.
 */
import type {Candidate,OriginReference} from './sourcing-autopilot'
import {displayFreight,type CorridorPayload,type RouteDetail,
 type DisplayFreight} from './procurement-route-evidence'

export type MerchandiseReference={
 kind:'approved_contract'|'historical_import'|'regional_proxy'|'national_proxy'
 lowQar:number
 highQar:number
 year:number|null
 area:string
 unitQarPerTonne:number
 totalQar:number
 source:string
}
export type RouteCostSummary={
 requestedTonnes:number|null
 evaluatedTonnes:number|null
 coversRequestedQuantity:boolean
 goods:MerchandiseReference|null
 freight:DisplayFreight|null
 subtotal:{minQar:number;maxQar:number}|null
}
export function routeCostSummary(
 selected:RouteDetail|null,
 corridors:Readonly<Record<string,CorridorPayload>>,
 candidates:readonly Candidate[],
 origins:readonly OriginReference[],
 requestedTonnes:number|null,
):RouteCostSummary{
 const rawQty=selected?corridors[selected.country]?.context?.tonnes:null
 const evaluatedTonnes=typeof rawQty==='number'&&Number.isFinite(rawQty)&&rawQty>0?
  rawQty:null
 const complete=typeof requestedTonnes==='number'&&Number.isFinite(requestedTonnes)&&
  evaluatedTonnes!==null&&Math.abs(requestedTonnes-evaluatedTonnes)<0.001
 const freight=selected&&evaluatedTonnes!==null?
  displayFreight(selected.route,evaluatedTonnes,evaluatedTonnes):null
 let goods:MerchandiseReference|null=null
 if(selected&&evaluatedTonnes!==null){
  const eligible=candidates.filter(candidate=>
   candidate.country===selected.country&&candidate.approved&&
   candidate.contractId!==null&&candidate.priceQarPerTonne!==null&&
   candidate.priceQarPerTonne>0&&candidate.capacityTonnes!==null&&
   candidate.capacityTonnes>=evaluatedTonnes)
   .sort((a,b)=>(a.priceQarPerTonne??Infinity)-(b.priceQarPerTonne??Infinity))
  const contract=eligible[0]
  if(contract&&contract.priceQarPerTonne!==null){
   const total=Math.round(contract.priceQarPerTonne*evaluatedTonnes*100)/100
   goods={kind:'approved_contract',unitQarPerTonne:contract.priceQarPerTonne,
    totalQar:total,lowQar:total,highQar:total,year:null,area:selected.country,
    source:'Approved supplier contract ('+contract.name+')'}
  }else{
   const origin=origins.find(x=>x.countryCode===selected.country)
   const planning=origin?.planningPrice
   if(planning&&planning.unitQarPerKg>0){
    const unit=planning.unitQarPerKg*1000
    goods={kind:planning.kind==='origin_customs'?'historical_import':planning.kind,
     unitQarPerTonne:unit,totalQar:Math.round(unit*evaluatedTonnes*100)/100,
     lowQar:Math.round(planning.lowQarPerKg*1000*evaluatedTonnes*100)/100,
     highQar:Math.round(planning.highQarPerKg*1000*evaluatedTonnes*100)/100,
     year:planning.year,area:planning.area,
     source:planning.sourceName+' · '+planning.basis}
   }else if(origin?.historicalUnitValueQarKg!==null&&
    origin?.historicalUnitValueQarKg!==undefined&&
    Number.isFinite(origin.historicalUnitValueQarKg)&&origin.historicalUnitValueQarKg>0){
    const unit=origin.historicalUnitValueQarKg*1000
    const total=Math.round(unit*evaluatedTonnes*100)/100
    goods={kind:'historical_import',unitQarPerTonne:unit,
     totalQar:total,lowQar:Math.round(total*.8*100)/100,
     highQar:Math.round(total*1.2*100)/100,
     year:origin.year,area:selected.country,
     source:'Historical Qatar import unit value ('+(origin.year??'year unknown')+')'}
   }
  }
 }
 // Contract + freight is only an arithmetic planning subtotal, never a
 // carrier offer or validated landed price without checking Incoterms.
 const subtotal=goods?.kind==='approved_contract'&&freight?{
  minQar:Math.round((goods.totalQar+freight.minQar)*100)/100,
  maxQar:Math.round((goods.totalQar+freight.maxQar)*100)/100,
 }:null
 return {requestedTonnes,evaluatedTonnes,coversRequestedQuantity:complete,
  goods,freight,subtotal}
}
