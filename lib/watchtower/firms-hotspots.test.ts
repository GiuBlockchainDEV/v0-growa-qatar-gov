import {describe,it,expect} from 'vitest'
import {parseFirmsCsv} from './firms-hotspots'
describe('NASA FIRMS Watchtower detections',()=>{
 it('validates satellite coordinates and timestamp without turning reports into actual fire perimeters',()=>{
  const csv='latitude,longitude,acq_date,acq_time,confidence,frp\n'+
   '25.1111,51.3333,2026-11-06,0915,n,35.4\n'+
   '99,51,2026-11-06,0915,n,5\n'+
   '25,51,2020-11-06,0915,n,5'
  const found=parseFirmsCsv(csv,'VIIRS_SNPP_NRT',Date.parse('2026-11-06T10:00:00Z'))
  expect(found).toHaveLength(1)
  expect(found[0].frp).toBe(35.4)
  expect(found[0].observedAt).toBe('2026-11-06T09:15:00.000Z')
 })
 it('fails closed for a provider error body',()=>{
  expect(()=>parseFirmsCsv('Forbidden','VIIRS_SNPP_NRT')).toThrow()
 })
})
