import {describe,expect,it} from 'vitest'
import {QAR_PER_USD,comtradeOriginUrl,parseImportOriginYear,
  rankQatarImportOrigins,type YearObservation} from './origin-price-model'

const ROW={reporterCode:634,refYear:2024,flowCode:'M',cmdCode:'0702',
  partner2Code:0,customsCode:'C00',motCode:0}
const sample=(country:string,code:number,usd:number,kg:number)=>({
  ...ROW,partnerCode:code,partnerISO:country,
  partnerDesc:country,primaryValue:usd,netWgt:kg,
})
describe('Qatar procurement origin prices in QAR/kg',()=>{
  it('converts historical USD customs unit value at official Qatar currency parity',()=>{
    expect(QAR_PER_USD).toBe(3.64)
    const url=new URL(comtradeOriginUrl('tomato',2024))
    expect(url.hostname).toBe('comtradeapi.un.org')
    expect(url.searchParams.get('reportercode')).toBe('634')
    expect(url.searchParams.get('cmdCode')).toBe('0702')
    expect(url.searchParams.get('flowCode')).toBe('M')
    expect(()=>comtradeOriginUrl('bad',2024)).toThrow()
  })
  it('ignores world totals, duplicates, different reporters and missing weights',()=>{
    const data=[
      sample('TUR',792,200000,100000),
      sample('TUR',792,180000,100000),
      sample('IND',356,350000,100000),
      sample('IND',356,100000,0),
      {...sample('USA',840,100000,90000),reporterCode:840},
      {...sample('DEU',276,100000,80000),partner2Code:356},
      {...sample('FRA',250,100000,80000),cmdCode:'0705'},
      {...sample('CHN',156,100000,80000),customsCode:'C01'},
      {...sample('MEX',484,100000,80000),motCode:1000},
      sample('ZAF',710,100000,0),
      {...sample('TUR',0,5000000,2000000),partnerCode:0},
    ]
    const y=parseImportOriginYear({data,count:data.length},'tomato',2024,'https://comtradeapi.un.org/example')
    expect(y.partners).toHaveLength(2)
    expect(y.partners.find(p=>p.countryCode==='TR')?.importValueUsd).toBe(200000)
    expect(y.partners.find(p=>p.countryCode==='IN')?.importWeightKg).toBe(100000)
  })
  it('ranks lowest observed QAR/kg after minimum-volume screening',()=>{
    const y2024=parseImportOriginYear({data:[
      sample('TUR',792,200000,100000),
      sample('IND',356,350000,100000),
      sample('ZAF',710,80000,1000),
      sample('ARE',784,30000,20000),
    ]},'tomato',2024,'https://source.example.com/2024')
    const y2023:YearObservation={
      year:2023,sourceUrl:'https://source.example.com/2023',incompletePreview:false,
      partners:[{countryCode:'TR',countryName:'Türkiye',importValueUsd:140000,
        importWeightKg:100000,estimatedNetWeight:false}],
    }
    const report=rankQatarImportOrigins('tomato',[y2024,y2023])
    expect(report.analyzedYear).toBe(2024)
    expect(report.weightedAverageQarKg).toBeCloseTo(3.64*580000/220000)
    expect(report.origins.map(x=>x.countryCode)).toEqual(['AE','TR','IN'])
    expect(report.origins[0].unitValueQarKg).toBeCloseTo(5.46)
    expect(report.origins[1].unitValueQarKg).toBeCloseTo(7.28)
    expect(report.origins[1].previousUnitValueQarKg).toBeCloseTo(5.096)
    expect(report.origins[1].importedPreviousYear).toBe(true)
    expect(report.origins[0].importedPreviousYear).toBe(false)
    expect(report.excludedInsufficientVolumeCount).toBe(1)
  })
  it('falls back to the latest year with enough trade volume and never invents a price',()=>{
    const tiny:YearObservation={year:2025,sourceUrl:'https://example.com/25',
      incompletePreview:false,partners:[{countryCode:'EG',countryName:'Egypt',
        importValueUsd:1000,importWeightKg:90,estimatedNetWeight:false}]}
    const old:YearObservation={year:2024,sourceUrl:'https://example.com/24',
      incompletePreview:false,partners:[{countryCode:'EG',countryName:'Egypt',
        importValueUsd:500000,importWeightKg:2000000,estimatedNetWeight:false}]}
    expect(rankQatarImportOrigins('wheat',[tiny,old]).analyzedYear).toBe(2024)
    const empty=rankQatarImportOrigins('milk',[])
    expect(empty.weightedAverageQarKg).toBeNull()
    expect(empty.bestObservedCountryCode).toBeNull()
    expect(empty.origins).toEqual([])
  })
  it('rejects nonsensical or unrelated import records',()=>{
    expect(()=>parseImportOriginYear({data:{}},'rice',2024,'url')).toThrow()
    expect(()=>rankQatarImportOrigins('unknown',[])).toThrow()
    const y=parseImportOriginYear({data:[
      {...ROW,partnerCode:356,partnerISO:'IND',primaryValue:100000,
        netWgt:null},
    ]},'tomato',2024,'url')
    expect(y.partners).toHaveLength(0)
  })
})
