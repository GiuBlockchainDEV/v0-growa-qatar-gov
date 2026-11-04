import {describe,it,expect} from 'vitest'
import {suggestProcurementQuantity,parseRequestedTonnes} from './procurement-quantity'
const base={status:'complete' as const,deficitTonnes:null,
 coverageDays:null,consumptionTonnes:null}
describe('Source-labeled procurement quantity suggestion',()=>{
 it('suggests actual reviewed deficits without inventing tonnes',()=>{
  const s=suggestProcurementQuantity({...base,deficitTonnes:38.42},30,'live')
  expect(s.tonnes).toBe(38.4);expect(s.verifiedDemand).toBe(true)
  expect(s.basis).toBe('reviewed_deficit')
  const cap=suggestProcurementQuantity({...base,deficitTonnes:905},30,'live')
  expect(cap.tonnes).toBe(600)
  expect(cap.uncappedTonnes).toBe(905)
 })
 it('proposes a transparent 30-day top-up from reviewed consumption',()=>{
  const s=suggestProcurementQuantity({...base,coverageDays:18,consumptionTonnes:300},30,'live')
  expect(s.tonnes).toBe(120);expect(s.verifiedDemand).toBe(false)
  expect(s.explanation).toMatch(/30-day buffer/)
 })
 it('proposes a seven-day batch when coverage is healthy',()=>{
  const s=suggestProcurementQuantity({...base,coverageDays:45,consumptionTonnes:100},20,'live')
  expect(s.tonnes).toBe(35)
  expect(s.basis).toBe('weekly_consumption')
 })
 it('never treats missing or demo data as verified demand',()=>{
  expect(suggestProcurementQuantity({...base,deficitTonnes:100},30,'demo').tonnes).toBe(20)
  expect(suggestProcurementQuantity({...base,status:'insufficient_data'},30,'live').verifiedDemand).toBe(false)
 })
 it('validates user edits and hard procurement ceiling',()=>{
  expect(parseRequestedTonnes('125.4')).toBe(125.4)
  expect(parseRequestedTonnes('')).toBeNull()
  expect(parseRequestedTonnes('1000')).toBeNull()
  expect(parseRequestedTonnes('-2')).toBeNull()
 })
})
