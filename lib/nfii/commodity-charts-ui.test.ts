import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {describe,expect,it} from 'vitest'

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8')
const overview=read('components/dashboard/commodity-workspace.tsx')
const lab=read('components/dashboard/commodity-agent-lab.tsx')
const balances=read('components/dashboard/commodity-balance-charts.tsx')
const scenario=read('components/dashboard/commodity-scenario-charts.tsx')

describe('Growa visual explanations for commodities and agent work',()=>{
  it('includes both supply-demand bars and the accounting bridge on Commodity Intelligence',()=>{
    expect(overview).toContain('<CommodityBalanceCharts balance={balance}/>')
    expect(balances).toContain('function SupplyDemandChart(')
    expect(balances).toContain('function BalanceBridgeChart(')
    expect(balances).toContain('What is available versus what is needed')
    expect(balances).toContain('How the food balance changes')
    expect(balances).toContain('All quantities cover the selected period')
    expect(balances).toContain('not a daily inventory forecast')
  })
  it('uses Growa ink, sage and warm neutrals, not a blue chart-library theme',()=>{
    for(const src of [balances,scenario]){
      expect(src).toContain('var(--growa-sage)')
      expect(src).toContain('var(--growa-ink)')
      expect(src).toContain('bg-card')
      expect(src).not.toMatch(/#[0-9a-f]{6}\b/i)
      expect(src).not.toMatch(/recharts|chart\.js|victory/i)
    }
  })
  it('does not reveal scenario outcome charts or final verdict before the user runs and completes agents',()=>{
    expect(lab).toContain('const [session,setSession]=useState<AgentRunSession|null>(null)')
    expect(lab).toContain('const simulation=simulateCommodityAgents({')
    expect(lab).toContain('const workflowComplete=result!==null && !playing && revealed>=result.steps.length')
    expect(lab).toContain('{workflowComplete && result && session && (')
    expect(lab).toContain('<CommodityScenarioCharts balance={session.balance} scenario={result.scenario}/>')
    expect(lab).toContain('{recommendation && workflowComplete && (')
    expect(lab).toContain('<CommodityAgentProgress')
    expect(lab.indexOf('<CommodityAgentVerdict')).toBeLessThan(lab.indexOf('<CommodityScenarioCharts'))
    expect(lab).not.toContain('useMemo(()=>balance?simulateCommodityAgents')
  })
  it('renders a progress-only chart during an active run, with accessible numbers',()=>{
    expect(scenario).toContain('export function CommodityAgentProgress')
    expect(scenario).toContain('role="progressbar"')
    expect(scenario).toContain('aria-valuenow={capped}')
    expect(scenario).toContain('Completed specialist stages; the outcome appears only at 100%.')
    expect(scenario).toContain('function NetPositionBar')
    expect(scenario).toContain('function CoverageBar')
  })
  it('labels comparisons as horizons and examples, not observed daily or verified national data',()=>{
    expect(scenario).toContain('Period-end net tonnes')
    expect(scenario).toContain('Not an approved procurement quantity')
    expect(scenario).toContain('NOT an official Qatar reserve policy')
    expect(balances).toContain('Any negative balance is reported separately as unmet demand')
    expect(balances).toContain('Missing values are not zero')
  })
})
