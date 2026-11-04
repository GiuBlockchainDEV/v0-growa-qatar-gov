/**
 * Keep goods contracts, customs price references and freight evidence separate.
 * Annual customs values are normally CIF-like; adding freight would double-count.
 */
import type {Candidate,OriginReference} from './sourcing-autopilot'
import {displayFreight,type CorridorPayload,type RouteDetail,
 type DisplayFreight} from './procurement-route-evidence'

export type MerchandiseReference={
 kind:'approved_contract'|'historical_import'
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
   goods={kind:'approved_contract',unitQarPerTonne:contract.priceQarPerTonne,
    totalQar:Math.round(contract.priceQarPerTonne*evaluatedTonnes*100)/100,
    source:'Approved supplier contract ('+contract.name+')'}
  }else{
   const origin=origins.find(x=>x.countryCode===selected.country&&
    x.historicalUnitValueQarKg!==null&&
    Number.isFinite(x.historicalUnitValueQarKg)&&
    (x.historicalUnitValueQarKg??0)>0)
   if(origin&&origin.historicalUnitValueQarKg!==null){
    const unit=origin.historicalUnitValueQarKg*1000
    goods={kind:'historical_import',unitQarPerTonne:unit,
     totalQar:Math.round(unit*evaluatedTonnes*100)/100,
     source:'Qatar customs unit-value reference'+
      (origin.year!==null?' ('+origin.year+')':'')}
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
