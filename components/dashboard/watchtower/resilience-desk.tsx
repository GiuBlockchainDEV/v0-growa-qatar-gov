'use client'

import {WatchtowerProcurementMission} from './procurement-mission'
import type {FoodPosture} from '@/lib/watchtower/food-posture'

/**
 * Source-backed sourcing mission is the active Watchtower decision workflow.
 * Retired the diagnostic audit replay entirely: it duplicated the actual
 * procurement flow and confused a playback with operational agent work.
 */
export function WatchtowerResilienceDesk({posture}:{posture:FoodPosture}){
 return <section id="watchtower-response" aria-label="Growa procurement and resilience decision desk">
  <WatchtowerProcurementMission
   key={posture.organizationId+':'+posture.generatedAt} posture={posture}/>
 </section>
}
