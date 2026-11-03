import {describe,expect,it} from 'vitest'
import {parseHormuzNowCompact} from './hormuz-now'

const now=Date.UTC(2026,10,3,9,30)
const fields=['id','name','lat','lon','speed','course','heading',
  'category','length','flag','type','destination','dwt','ageMin','commercial','side']
const row=(id:string,lat:number,lon:number,speed:number,ageMin=5,
  category='cargo')=>[id,'TEST SHIP '+id,lat,lon,speed,140,142,
  category,100,'QA',category==='cargo'?'Bulk Carrier':category==='tanker'?'Oil Tanker':'Unknown','HAMAD',14000,ageMin,1,1]
describe('hormuz.now real regional AIS adapter',()=>{
  it('reads compact field-indexed API and retains ships regardless of cargo category',()=>{
    const result=parseHormuzNowCompact({t:now-120000,n:3,fields,rows:[
      row('1234',25.4,55.9,12),row('1235',24.8,56.6,0.1,7,'tanker'),
      row('1236',26,55.2,2.5,8,'special'),
    ]},now)
    expect(result.acceptedCount).toBe(3)
    expect(result.movingCount).toBe(2)
    expect(result.cargoCount).toBe(1)
    expect(result.assets[0].id).toBe('sea:hn:1234')
    expect(result.assets[0].foodCargoVerified).toBe(false)
    expect(result.assets.find(a=>a.id==='sea:hn:1235')?.cargo).toBe('unverified')
    expect(result.assets[0].sourceUrl).toContain('hormuz.now')
  })
  it('uses the source ageMin rather than webpage fetch time',()=>{
    const output=parseHormuzNowCompact({t:now-60000,n:1,fields,
      rows:[row('1200',25.7,56.2,12,45)]},now)
    expect(output.assets[0].observedAt).toBe(new Date(now-46*60000).toISOString())
  })
  it('rejects impossible coordinates, missing age and IDs and old positions',()=>{
    const output=parseHormuzNowCompact({t:now-120000,n:5,fields,rows:[
      row('300',95,56,9),row('304',25,56,9,1700),
      row('not-id',25,56,7),row('305',25.2,56.3,7,5),
      row('306',25,56,0.2,-1),
    ]},now)
    expect(output.acceptedCount).toBe(1)
    expect(output.assets[0].id).toBe('sea:hn:305')
    expect(output.providerCount).toBe(5)
  })
  it('marks delayed snapshots stale, not live',()=>{
    const output=parseHormuzNowCompact({t:now-80*60000,n:1,fields,
      rows:[row('400',25.5,56.2,10,3)]},now)
    expect(output.state).toBe('stale')
    expect(output.assets).toHaveLength(1)
  })
  it('refuses an unexpected schema rather than guessing positional indexes',()=>{
    expect(()=>parseHormuzNowCompact({t:now,fields:['lat'],rows:[]},now)).toThrow()
  })
})
