import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
const src=(path:string)=>readFileSync(join(process.cwd(),path),'utf8')
describe('Harvest single-field decision cockpit',()=>{
 const field=src('components/dashboard/harvest-field-command.tsx')
 const shell=src('components/dashboard/harvest-workspace.tsx')
 it('mounts on existing per-parcel route, keeping season and mode',()=>{
  expect(shell).toContain('isFieldDetailView && activeField')
  expect(shell).toContain('<HarvestFieldCommand')
  expect(shell).toContain('seasonId={activeSeasonId}')
  expect(shell).toContain('mode={mode}')
  expect(shell).toContain('activeMapMetric={activeMapMetric}')
  expect(shell).toContain('stats={fieldStats}')
 })
 it('preserves map raster changes and period navigation',()=>{
  expect(shell).toContain('onSelectMapMetric={selectMapMetric}')
  expect(shell).toContain('onSelectMapGranularity={selectMapGranularity}')
  expect(shell).toContain("harvestGranularity: 'dekad'")
  expect(shell).toContain('harvestPeriod: period || null')
  expect(field).toContain("raster.metric")
  expect(field).toContain('raster.legend.map')
 })
 it('preserves yield estimate, delete confirmation and AI context',()=>{
  expect(shell).toContain('onEstimateYield={() => void runYieldEstimate()}')
  expect(shell).toContain('onDelete={() => void deleteSelectedField()}')
  expect(shell).toContain('onBack={handleClearFieldSelection}')
  expect(shell).toContain('<GrowaIntelligencePanel module="harvest" context={growaContext}')
  expect(field).toContain('Yield estimation & field actions')
  expect(field).toContain("aria-label={'Delete field '+field.name}")
  expect(field).toContain("{deleteLoading?'Deleting field…':'Delete field'}")
  expect(shell).toContain('Permanently delete field')
  expect(shell).toContain('encodeURIComponent(parcelToDelete)')
  expect(shell).toContain("method: 'DELETE'")

  expect(field).toContain('View source model response')
 })
 it('supports point interaction and distinguishes modeled vs observed data',()=>{
  expect(field).toContain('role="button" tabIndex={0}')
  expect(field).toContain('setPicked(point.period)')
  expect(field).toContain('not sold or harvested tonnage')
  expect(field).toContain('not a documented physical crop harvest')
  expect(field).toContain('Planned harvest date passed')
  expect(field).toContain('Field data lineage & confidence')
 })
 it('retains national cockpit and field-create route',()=>{
  expect(shell).toContain('<HarvestNationalCommand')
  expect(shell).toContain('<HarvestFieldCreatePanel')
 })
})
