/**
 * Annual Qatar customs import unit values. Never turn annual observations
 * into a synthetic monthly price series or assume these are supplier offers.
 */
import type {YearObservation} from './origin-price-model'
import {QAR_PER_USD} from './origin-price-model'

export type AnnualImportPrice={
 year:number
 qarPerKg:number
 qarPerTonne:number
 weightTonnes:number
 basis:'published_world_total'|'reported_partner_aggregate'
 sourceUrl:string
 sourceLabel:string
}
const valid=(n:number)=>Number.isFinite(n)&&n>0
const money=(n:number)=>Math.round(n*1000)/1000

export function annualQatarImportPrices(
 annual:readonly YearObservation[],
 sourceLabel:string,
):AnnualImportPrice[]{
 const seen=new Set<number>()
 return [...annual].sort((a,b)=>a.year-b.year).flatMap(year=>{
  if(seen.has(year.year))return []
  seen.add(year.year)
  const world=year.worldTotal
  let usd=0,kg=0
  let basis:AnnualImportPrice['basis']='published_world_total'
  if(world&&valid(world.importValueUsd)&&valid(world.importWeightKg)){
   usd=world.importValueUsd
   kg=world.importWeightKg
  }else if(!year.incompletePreview){
   // Do not describe a partial/truncated customs preview as a national total.
   // If the visible partner dataset is complete, label it as an aggregate.
   const partners=year.partners.filter(p=>valid(p.importValueUsd)&&valid(p.importWeightKg))
   if(partners.length<2)return []
   usd=partners.reduce((sum,p)=>sum+p.importValueUsd,0)
   kg=partners.reduce((sum,p)=>sum+p.importWeightKg,0)
   basis='reported_partner_aggregate'
  }else return []
  if(!valid(usd)||!valid(kg))return []
  const qarPerKg=usd*QAR_PER_USD/kg
  if(!valid(qarPerKg)||qarPerKg>10000)return []
  return [{year:year.year,qarPerKg:money(qarPerKg),
   qarPerTonne:money(qarPerKg*1000),
   weightTonnes:money(kg/1000),basis,
   sourceUrl:year.sourceUrl,sourceLabel}]
 })
}
