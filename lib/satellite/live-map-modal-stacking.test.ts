import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8')
describe('Live Map modal stacking and honest NDSI presentation',()=>{
 it('portals brand dialogs to the document body above Leaflet panes and map controls',()=>{
  const ui=read('components/brand/ui.tsx')
  const feedback=read('components/brand/feedback.tsx')
  const map=read('components/dashboard/satellite-map.tsx')
  expect(ui).toContain("import { createPortal } from 'react-dom'")
  expect(ui).toContain('return createPortal(')
  expect(ui).toContain('document.body,')
  expect(ui).toContain('Math.max(zIndex, 10000)')
  expect(feedback).toContain('zIndex={90}')
  expect(map).toContain('handleDeletePolygon')
  expect(map).toContain('confirmDialog(')
 })
 it('does not use an NDSI palette or legend to declare sand a salinity emergency',()=>{
  const config=read('lib/satellite/qatar-spectral.ts')
  const layer=read('components/dashboard/qatar-spectral-layers.tsx')
  expect(config).toContain("description:'NDSI spectral contrast · NOT measured soil salinity'")
  expect(config).toContain("palette:'purples',rescale:'-0.1,0.7'")
  expect(layer).toContain("setOpacity(choice==='ndsi'?.35:.7)")
  expect(layer).toContain('Sand and bare soil are not classified as saline.')
  expect(layer).toContain('Bare sand can have positive values without being saline.')
 })
})
