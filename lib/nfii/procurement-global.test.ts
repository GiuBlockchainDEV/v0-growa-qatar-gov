import {describe,expect,it} from 'vitest'
import {
  HS_CODES,comtradeUrl,gleifUrl,parseComtradeTrade,parseGleifCandidates,
  parseGooglePlacesCandidates,supplierDraftCode,validateProcurementQuery,
} from './procurement-global'

const query=(s:string)=>validateProcurementQuery(new URLSearchParams(s))

const gleifFixture={
  data:[{
    id:'529900T8BM49AURSDO55',
    attributes:{
      entity:{
        legalName:{name:'Global Grain Trading GmbH'},
        legalAddress:{addressLines:['Sample Street 14'],city:'Berlin',
          country:'DE'},
        status:'ACTIVE',
      },
      registration:{status:'ISSUED'},
    },
  }],
}
describe('Global procurement provider validation and normalization',()=>{
  it('accepts only fixed source types, bounded safe queries and NFII commodities',()=>{
    expect(query('provider=gleif&q=grain&country=DE&commodity=wheat').ok).toBe(true)
    expect(query('provider=places&q=rice%20wholesaler&country=IN').ok).toBe(true)
    expect(query('provider=comtrade&commodity=rice&year=2024').ok).toBe(true)
    for(const invalid of [
      'provider=bad&q=grain',
      'provider=gleif&q=a',
      'provider=gleif&q='+('x'.repeat(100)),
      'provider=gleif&q=%3Cscript%3E',
      'provider=gleif&q=grain&country=AAA',
      'provider=comtrade&commodity=not-in-catalog',
      'provider=comtrade&commodity=rice&year=2026',
    ])expect(query(invalid).ok).toBe(false)
  })
  it('builds only GLEIF host urls with an encoded, bounded legal name and country',()=>{
    const url=new URL(gleifUrl('grain & rice','DE'))
    expect(url.origin).toBe('https://api.gleif.org')
    expect(url.searchParams.get('filter[entity.legalName]')).toBe('grain & rice')
    expect(url.searchParams.get('filter[entity.legalAddress.country]')).toBe('DE')
    expect(url.searchParams.get('page[size]')).toBe('18')
    expect(url.searchParams.has('subscription-key')).toBe(false)
  })
  it('returns legal identity evidence with an active LEI, never a qualified commodity supplier',()=>{
    const rows=parseGleifCandidates(gleifFixture)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      source:'GLEIF',name:'Global Grain Trading GmbH',
      countryCode:'DE',legalEntityStatus:'ACTIVE',registrationStatus:'ISSUED',
      supplierQualification:'not_assessed',website:null,phone:null,
    })
    expect(rows[0].sourceUrl).toContain('search.gleif.org')
    expect(supplierDraftCode(rows[0])).toBe('LEI-529900T8BM49AURSDO55')
    expect(()=>parseGleifCandidates({data:{invalid:true}})).toThrow()
  })
  it('refuses to infer legal/food product identity from Google business listings',()=>{
    const rows=parseGooglePlacesCandidates({places:[{
      id:'ChIJABC1234',
      displayName:{text:'Test Export Food Ltd'},
      formattedAddress:'Doha, Qatar',
      websiteUri:'https://sample.example.com',
      internationalPhoneNumber:'+97412345678',
      businessStatus:'OPERATIONAL',
      addressComponents:[{types:['country'],shortText:'QA'}],
    }]})
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      source:'Google Places',countryCode:'QA',lei:null,
      legalEntityStatus:null,registrationStatus:null,
      supplierQualification:'not_assessed',
    })
    expect(rows[0].sourceUrl).toContain('google.com/maps/place')
    expect(rows[0].website).toBe('https://sample.example.com/')
    expect(supplierDraftCode(rows[0])).toMatch(/^PL-[A-Za-z0-9]+$/)
    const suspicious=parseGooglePlacesCandidates({places:[{
      id:'abc',displayName:{text:'Vendor A'},websiteUri:'javascript:alert(1)',
    }]})
    expect(suspicious[0].website).toBeNull()
    expect(suspicious[0].countryCode).toBeNull()
  })
  it('maps every NFII commodity to a fixed HS heading and a Qatar imports preview',()=>{
    expect(Object.keys(HS_CODES)).toHaveLength(9)
    expect(HS_CODES.rice.code).toBe('1006')
    expect(HS_CODES.wheat.code).toBe('1001')
    expect(HS_CODES.tomato.code).toBe('0702')
    const u=new URL(comtradeUrl('rice',2024))
    expect(u.origin).toBe('https://comtradeapi.un.org')
    expect(u.searchParams.get('reporterCode')).toBe('634')
    expect(u.searchParams.get('period')).toBe('2024')
    expect(u.searchParams.get('flowCode')).toBe('M')
    expect(u.searchParams.get('partner2Code')).toBe('0')
    expect(u.searchParams.get('customsCode')).toBe('C00')
    expect(u.searchParams.get('motCode')).toBe('0')
    expect(u.searchParams.get('cmdCode')).toBe('1006')
    expect(u.searchParams.has('subscription-key')).toBe(false)
  })
  it('filters country rows to the selected reporter and HS heading; never double counts repeated partners',()=>{
    const source=comtradeUrl('rice',2024)
    const row={
      reporterCode:634,refYear:2024,flowCode:'M',cmdCode:'1006',
      partner2Code:0,customsCode:'C00',motCode:0,
    }
    const data=[
      {...row,partnerCode:0,partnerDesc:'World',primaryValue:2500000},
      {...row,partnerCode:356,partnerDesc:'India',partnerISO:'IND',
        primaryValue:1000000,netWgt:3000000},
      {...row,partnerCode:356,partnerDesc:'India',partnerISO:'IND',
        primaryValue:950000,netWgt:2800000},
      {...row,partnerCode:586,partnerDesc:'Pakistan',partnerISO:'PAK',
        primaryValue:500000,netWgt:1200000},
      {...row,partnerCode:704,partnerDesc:'Vietnam',partnerISO:'VNM',
        primaryValue:650000,netWgt:2000000},
      {...row,reporterCode:840,partnerCode:840,partnerDesc:'US',primaryValue:99999999},
      {...row,cmdCode:'1001',partnerCode:124,partnerDesc:'Canada',primaryValue:9999999},
      {...row,partner2Code:356,partnerCode:124,partnerDesc:'Canada',primaryValue:10000000},
    ]
    const result=parseComtradeTrade({data,count:rowsCount(data)},'rice',2024,source)
    expect(result.reporter).toBe('Qatar')
    expect(result.worldTradeValueUsd).toBe(2500000)
    expect(result.partners).toHaveLength(3)
    expect(result.partners.map(p=>p.countryCode)).toEqual(['IN','VN','PK'])
    expect(result.partners[0].tradeValueUsd).toBe(1000000)
    expect(result.partners[0].netWeightTonnes).toBe(3000)
    expect(result.limitedPreview).toBe(false)
    expect(result.sourceUrl).toBe(source)
  })
  it('marks preview truncation and never substitutes a zero for unknown country or volume',()=>{
    const row={
      reporterCode:634,refYear:2024,flowCode:'M',cmdCode:'1006',
      partnerCode:27,partnerDesc:'Unknown partner',partnerISO:'ZZZ',
      primaryValue:null,netWgt:null,
    }
    const data=parseComtradeTrade({data:[row],count:500},'rice',2024,'https://source.example.com')
    expect(data.limitedPreview).toBe(true)
    expect(data.partners[0].tradeValueUsd).toBeNull()
    expect(data.partners[0].netWeightTonnes).toBeNull()
    expect(data.partners[0].countryCode).toBeNull()
    expect(data.worldTradeValueUsd).toBeNull()
    expect(()=>parseComtradeTrade({data:{}},'rice',2024,'abc')).toThrow()
  })
})
function rowsCount(data:unknown[]):number{return data.length}
