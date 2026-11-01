import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {describe,expect,it} from 'vitest'

const read=(file:string)=>readFileSync(join(process.cwd(),file),'utf8')
const lab=read('components/dashboard/commodity-agent-lab.tsx')
const verdict=read('components/dashboard/commodity-agent-verdict.tsx')
const logic=read('lib/nfii/agent-decision.ts')

describe('Final decision discoverability and safety',()=>{
  it('withholds the final verdict until the run has been started and all stages completed',()=>{
    expect(lab).toContain("const [session,setSession]=useState<AgentRunSession|null>(null)")
    expect(lab).toContain('const result=session &&')
    expect(lab).toContain('const simulation=simulateCommodityAgents({')
    expect(lab).not.toContain('useMemo(()=>balance?simulateCommodityAgents')
    expect(lab).toContain('const workflowComplete=result!==null && !playing && revealed>=result.steps.length')
    expect(lab).toContain('()=>workflowComplete && result ? buildAgentFinalRecommendation(result) : null')
    expect(lab).toContain('{recommendation && workflowComplete && (')
    expect(lab).toContain('<CommodityAgentVerdict')
    expect(lab.indexOf('<CommodityAgentVerdict')).toBeLessThan(lab.indexOf("tx('Agent activity log'"))
    expect(verdict).toContain('FINAL AGENT RECOMMENDATION')
    expect(verdict).toContain('Next recommended step')
    expect(verdict).toContain('Responsible reviewer')
  })

  it('does not leak intermediate recommendations or numbers before completion',()=>{
    expect(lab).toContain('{workflowComplete && result && <div')
    expect(lab).toContain('{workflowComplete ? (')
    expect(lab).toContain('{workflowComplete && (')
    expect(lab).toContain('disabled={!result || workflowComplete}')
    expect(lab).toContain("Complete active simulation")
    expect(lab).toContain("No result has been produced yet.")
    expect(lab).toContain("The final recommendation and numeric scenario results will appear only after all stages complete.")
  })

  it('invalidates old sessions when scenario or source changes',()=>{
    expect(lab).toContain('session.balance===balance')
    expect(lab).toContain('session.operations===operations')
    expect(lab).toContain('session.today===today')
    expect(lab).toContain('session.shocks===shocks')
    expect(lab).toContain('setSession(null);setPlaying(false);setRevealed(0);setDecision(null)')
    expect(lab).toContain('setSession(null);setRevealed(0);setPlaying(false);setDecision(null)')
    expect(lab).toContain('setShocks(prev=>({...prev,[key]:value}))')
    expect(lab).toContain('setSession({balance,operations,today,shocks,result:simulation})')
  })

  it('makes proposed quantity, alternatives and human approval state distinguishable',()=>{
    expect(verdict).toContain('Not an approved purchase quantity')
    expect(verdict).toContain('Options to verify before acting')
    expect(verdict).toContain('Potential gap to investigate')
    expect(verdict).toContain('Approval and execution status')
    expect(verdict).toContain('Purchase orders created: 0 · Reserves released: 0')
    expect(verdict).toContain('Local approval rehearsed. No actual authorization.')
    expect(verdict).toContain('Illustrative Qatar inputs')
  })

  it('never issues any request that mutates server or Supabase state',()=>{
    expect(verdict).not.toMatch(/fetch\s*\(/)
    expect(verdict).not.toContain('createAdminClient')
    expect(logic).not.toMatch(/fetch\s*\(/)
    expect(logic).not.toContain('createAdminClient')
    expect(logic).toContain("executionStatus: 'not_executed'")
    expect(logic).toContain('requiredHumanApproval: true')
  })
})
