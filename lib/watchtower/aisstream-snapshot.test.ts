import {describe,expect,it} from 'vitest'
import {parseAisStreamMessage} from './aisstream-snapshot'
const now=Date.parse('2026-11-06T14:00:00Z')
describe('AISStream short-burst parser',()=>{
 it('accepts only source-reported underway positions',()=>{
  const envelope={MessageType:'PositionReport',MetaData:{MMSI:123456789,
   ShipName:'Cargo Vessel',time_utc:'2026-11-06T13:59:30Z'},
   Message:{PositionReport:{Latitude:25.3,Longitude:51.5,Sog:9.7,Cog:70,TrueHeading:71}}}
  const asset=parseAisStreamMessage(envelope,now)
  expect(asset).toMatchObject({id:'sea:123456789',speedKnots:9.7,
   heading:71,source:'AISStream.io (short sample)',cargo:'unverified'})
  expect(asset?.foodCargoVerified).toBe(false)
  expect(parseAisStreamMessage({...envelope,Message:{PositionReport:{...envelope.Message.PositionReport,Sog:0}}},now)).toBeNull()
 })
 it('rejects invalid coordinates, non-position messages and timestamps are only inferred as receipt time',()=>{
  expect(parseAisStreamMessage({MessageType:'ShipStaticData'},now)).toBeNull()
  const x={MessageType:'PositionReport',MetaData:{MMSI:123456789},
   Message:{PositionReport:{Latitude:99,Longitude:51,Sog:10}}}
  expect(parseAisStreamMessage(x,now)).toBeNull()
  const y={...x,Message:{PositionReport:{Latitude:25,Longitude:51,Sog:10}}}
  expect(parseAisStreamMessage(y,now)?.observationBasis).toBe('snapshot_poll')
 })
})
