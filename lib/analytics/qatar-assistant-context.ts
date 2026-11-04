import type {QatarCountrySnapshot} from '@/lib/analytics/qatar-country'
import type {CommodityMarketsSnapshot} from '@/lib/watchtower/commodity-markets'
import type {GrowaFarmAnalysisContext,QatarCountryGrowaAnalysisContext} from '@/lib/ai/growa-types'

/**
 * The assistant receives the same datasets rendered by Qatar Country Command.
 * Public country measures and signed-in Growa farm estimates MUST remain
 * explicitly distinct. No unavailable figure is silently converted to zero.
 */
export function buildQatarCountryAssistantContext(
 country:QatarCountrySnapshot|null,
 markets:CommodityMarketsSnapshot|null,
 operations:GrowaFarmAnalysisContext|null,
 errors:{country?:string|null;markets?:string|null}={},
):QatarCountryGrowaAnalysisContext{
 const national=country?{
  ...country,
  // Keep complete country rows (up to 2500 from the official endpoint).
  // Historical trends capped for transport size; retain latest 30 observed years.
  indicators:country.indicators.map(ind=>({
   ...ind,history:ind.history.slice(-30),
  })),
  production:country.production.slice(0,350),
  farms:country.farms.slice(0,350),
  sufficiency:country.sufficiency.slice(0,350),
 }:null
 const commodity=markets?{
  generatedAt:markets.generatedAt,
  source:markets.source,
  sourceUrl:markets.sourceUrl,
  frequency:markets.frequency,
  status:markets.status,
  latestObservationMonth:markets.latestObservationMonth,
  fxBasis:markets.fxBasis,
  disclaimer:markets.disclaimer,
  instruments:markets.instruments.map(x=>({...x,points:x.points.slice(-18)})),
 }:null
 const sources=country?.sources??[]
 const readySources=sources.filter(x=>x.status==='available')
 const gaps=[
  ...sources.filter(x=>x.status!=='available').map(x=>x.label+': '+x.note),
  ...(!country?['National country datasets unavailable'+(errors.country?': '+errors.country:'')]:[]),
  ...(!markets?['Monthly market benchmarks unavailable'+(errors.markets?': '+errors.markets:'')]:[]),
  ...(!operations?['Growa operational farm records unavailable or still loading']:[]),
 ]
 const mainLines=[
  'QATAR COUNTRY-LEVEL INTELLIGENCE / SOURCE-AWARE DIGEST',
  'Do not confuse Qatar published statistics with Growa farm records or international commodity benchmarks.',
  'National public sources:',
  ...sources.map(s=>'- '+s.label+': '+s.status+
   ' | '+s.count+' records | latest year '+(s.latestYear??'N/A')+
   ' | '+s.url),
  'Published World Bank country indicators:',
  ...(country?.indicators.map(i=>'- '+i.label+': '+
   (i.latest?i.latest.value+' '+i.unit+' ('+i.latest.year+')':'unavailable')+
   ' | '+i.url)??[]),
  'Latest available production rows (source: Qatar Open Data; tonnes):',
  ...(national?.production.slice(0,90).map(x=>
   '- '+x.year+' '+x.crop+' ['+x.group+']: '+x.tonnes+' t')??[]),
  'Latest available product-level self-sufficiency (not overall national dependency):',
  ...(national?.sufficiency.slice(0,90).map(x=>
   '- '+x.year+' '+x.product+': '+x.ratioPercent+'%')??[]),
  'Registered farms by municipality (may have multiple farm types):',
  ...(national?.farms.slice(0,90).map(x=>
   '- '+x.year+' '+x.municipality+' / '+x.farmType+': '+x.farms+' holdings')??[]),
  'Global monthly commodity benchmark prices: NOT Qatar retail/import prices and NOT carrier quotes.',
  ...(commodity?.instruments.map(x=>'- '+x.label+' ['+x.latestDate+']: '+
   x.latestQarTonne.toFixed(2)+' QAR/t; MoM '+(x.change1mPct??'N/A')+
   '%, data stale: '+x.stale+' | '+x.sourceUrl)??[]),
  'Growa signed-in user records only (NOT Qatar national totals):',
  ...(operations?[operations.digest]:['No Growa operational context available']),
  'Missing/partial evidence: '+(gaps.join('; ')||'No missing sources reported.'),
 ]
 return {
  module:'data-analytics',
  scope:'qatar-country',
  generatedAt:country?.generatedAt??markets?.generatedAt??operations?.generatedAt??new Date().toISOString(),
  headline:{
   country:'Qatar',
   publicSourceGroups:sources.length,
   availableSourceGroups:readySources.length,
   officialIndicatorCount:country?.indicators.filter(x=>x.latest!==null).length??0,
   benchmarkCount:markets?.instruments.length??0,
   growaRecordsAvailable:operations!==null,
  },
  national,
  markets:commodity,
  growaOperations:operations?{
   headline:operations.headline,
   crops:operations.crops.slice(0,120),
   producers:operations.producers.slice(0,120),
   rankings:operations.rankings,
   alerts:operations.alerts,
  }:null,
  dataGaps:gaps,
  digest:mainLines.join('\n').slice(0,60000),
 }
}
