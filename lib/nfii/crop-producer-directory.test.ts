import {describe,expect,it} from 'vitest'
import {
  cropProducerCoverage,FAIRTSA_EXCERPT_CHECKED,
  findDocumentedCropOrganizations,
  validateCropProducerSearch,
} from './crop-producer-directory'

describe('First-party crop product evidence from FairTSA public directory',()=>{
  it('finds organizations by selected crop rather than guessing from a company name',()=>{
    const rows=findDocumentedCropOrganizations('rice')
    expect(rows.length).toBeGreaterThan(80)
    expect(rows.map(r=>r.organizationName)).toContain('Ban Um-Sang Rice Community Enterprise')
    expect(rows.map(r=>r.organizationName)).toContain('Kadwara Ecopure Javik Samuha')
    expect(rows.every(r=>r.commodityId==='rice')).toBe(true)
    expect(rows.every(r=>/rice/i.test(r.matchedProduct))).toBe(true)
    expect(rows.every(r=>r.recordId.length>3 && r.sourceUrl.startsWith('https://'))).toBe(true)
  })
  it('applies country ISO filters before returning published product matches',()=>{
    const india=findDocumentedCropOrganizations('rice','IN')
    const thailand=findDocumentedCropOrganizations('rice','TH')
    expect(india.length).toBeGreaterThan(40)
    expect(thailand.length).toBeGreaterThan(45)
    expect(india.every(r=>r.countryCode==='IN')).toBe(true)
    expect(thailand.every(r=>r.countryCode==='TH')).toBe(true)
    expect(findDocumentedCropOrganizations('wheat','TR')).toEqual([])
    expect(findDocumentedCropOrganizations('not-a-crop')).toEqual([])
  })
  it('exposes only supported, exact crop product matches',()=>{
    const coverage=cropProducerCoverage()
    expect(coverage.rice).toBeGreaterThan(80)
    expect(coverage.date).toBeGreaterThanOrEqual(12)
    expect(coverage.milk).toBeGreaterThanOrEqual(14)
    expect(coverage.tomato).toBeGreaterThanOrEqual(30)
    expect(coverage.cucumber).toBeGreaterThanOrEqual(30)
    expect(coverage.pepper).toBeGreaterThanOrEqual(30)
    expect(coverage.lettuce).toBeGreaterThanOrEqual(7)
    // FairTSA "Pepper" can denote a spice, not Capsicum/bell pepper.
    // Never claim a verified Capsicum producer on this ambiguity.
    expect(findDocumentedCropOrganizations('pepper').every(row=>
      ['QA','NL','FR','US','CA'].includes(row.countryCode)||
      ['company_product_document','historical_crop_marketer'].includes(row.evidenceType))).toBe(true)
    expect(findDocumentedCropOrganizations('tomato').map(r=>r.organizationName)).toContain('Fade Food')
    expect(findDocumentedCropOrganizations('milk').every(row=>/milk/i.test(row.matchedProduct))).toBe(true)
  })
  it('never asserts that registry-listed organizations grow a crop or have current certificates',()=>{
    for(const id of ['tomato','barley','milk','rice','wheat']){
      for(const record of findDocumentedCropOrganizations(id)){
        expect(record.sourceUrl.startsWith('https://')).toBe(true)
        expect(record.registryCheckedOn).toBe(FAIRTSA_EXCERPT_CHECKED)
        expect(record.evidenceType.length).toBeGreaterThan(8)
        expect(record.cropGrowerConfirmed).toBe(false)
        expect(record.currentCertificateConfirmed).toBe(false)
        expect(record.exportCapabilityConfirmed).toBe(false)
        expect(record.supplierApproved).toBe(false)
        expect(record.capacityTonnes).toBeNull()
      }
    }
  })
  it('provides source attribution and deduplicated companies',()=>{
    const rice=findDocumentedCropOrganizations('rice')
    expect(new Set(rice.map(r=>r.countryCode+'|'+r.organizationName.toLowerCase())).size).toBe(rice.length)
    expect(rice.some(r=>r.sourceName.includes('Thai Rice Exporters'))).toBe(true)
    expect(rice.some(r=>r.sourceName.includes('All India Rice Exporters'))).toBe(true)
    expect(findDocumentedCropOrganizations('date','SA').length).toBeGreaterThanOrEqual(12)
    expect(findDocumentedCropOrganizations('rice','AU')).toEqual([])
  })
  it('finds Qatar businesses across farm, manufacturer and trader roles without inventing local grains',()=>{
    const expected:{[crop:string]:number}={
      tomato:10,cucumber:9,pepper:9,lettuce:8,date:5,milk:5,rice:8,wheat:2,barley:2,
    }
    for(const [crop,min] of Object.entries(expected)){
      const rows=findDocumentedCropOrganizations(crop,'QA')
      expect(rows.length).toBeGreaterThanOrEqual(min)
      expect(rows.every(r=>r.countryCode==='QA')).toBe(true)
      expect(rows.every(r=>r.supplierApproved===false && r.cropGrowerConfirmed===false)).toBe(true)
      expect(rows.every(r=>r.sourceUrl.startsWith('https://'))).toBe(true)
    }
    expect(findDocumentedCropOrganizations('tomato','QA').some(r=>
      r.organizationName.includes('Agrico')&&r.supplierRole==='farm_claim')).toBe(true)
    expect(findDocumentedCropOrganizations('milk','QA').some(r=>
      r.organizationName.includes('Baladna')&&r.supplierRole==='manufacturer')).toBe(true)
    expect(findDocumentedCropOrganizations('rice','QA').every(r=>r.supplierRole==='trader')).toBe(true)
    expect(findDocumentedCropOrganizations('barley','QA').every(r=>
      r.matchedProduct.toLowerCase().includes('feed'))).toBe(true)
  })
  it('indexes verified product-specific international names with their local production country',()=>{
    expect(findDocumentedCropOrganizations('tomato','NL').map(r=>r.organizationName))
      .toContain('Agro Care Growers')
    expect(findDocumentedCropOrganizations('tomato','ZA').map(r=>r.organizationName))
      .toContain('ZZ2 Group')
    expect(findDocumentedCropOrganizations('tomato','AE').map(r=>r.organizationName))
      .toContain('Pure Harvest Smart Farms')
    expect(findDocumentedCropOrganizations('milk','SA').map(r=>r.organizationName))
      .toContain('Almarai Company')
    expect(findDocumentedCropOrganizations('rice','VN').map(r=>r.organizationName))
      .toContain('Loc Troi Group')
    expect(findDocumentedCropOrganizations('tomato','BR').map(r=>r.organizationName))
      .toContain('Agro Care Growers (Brazil operations)')
    expect(findDocumentedCropOrganizations('rice','CA')).toEqual([])
  })
  it('accepts only known commodity IDs and ISO two-letter country codes',()=>{
    const ok=validateCropProducerSearch(new URLSearchParams('commodity=tomato&country=tr'))
    expect(ok).toEqual({ok:true,commodity:'tomato',country:'TR'})
    const unknown=validateCropProducerSearch(new URLSearchParams('commodity=potato'))
    const injection=validateCropProducerSearch(new URLSearchParams('commodity=rice&country=%3Cscript%3E'))
    const empty=validateCropProducerSearch(new URLSearchParams())
    expect(unknown.ok).toBe(false)
    expect(injection.ok).toBe(false)
    expect(empty.ok).toBe(false)
  })
})
