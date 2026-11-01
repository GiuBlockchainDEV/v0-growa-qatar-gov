import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe,expect,it } from 'vitest'

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8')
const migration=read('supabase/migrations/00041_nfii_operational_supply_chain.sql')
const reader=read('app/api/nfii/operations/route.ts')
const writer=read('app/api/nfii/operations/action/route.ts')
const watchtower=read('components/dashboard/watchtower-workspace.tsx')

describe('NFII cross-module operation security contract (static regression)',()=>{
  it('contains every real operational and audit table without demo rows',()=>{
    for(const table of [
      'nfii_suppliers','nfii_contracts','nfii_purchase_orders',
      'nfii_shipments','nfii_warehouses','nfii_reserve_lots',
      'nfii_reserve_releases','nfii_operation_approvals','nfii_operation_events',
    ])expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.'+table)
    expect(migration).not.toContain('DEMO-SUPPLIER')
    expect(migration).not.toContain('INSERT INTO public.nfii_suppliers (id, organization_id')
  })

  it('enforces tenant-composite parents and active organization membership',()=>{
    expect(migration).toContain('FOREIGN KEY (organization_id,supplier_id)')
    expect(migration).toContain('FOREIGN KEY (organization_id,contract_id)')
    expect(migration).toContain('FOREIGN KEY (organization_id,purchase_order_id)')
    expect(migration).toContain('FOREIGN KEY (organization_id,shipment_id)')
    expect(migration).toContain('m.organization_id = %I.organization_id')
    expect(migration).toContain("m.status = 'active'")
    expect(migration).toContain("public.nfii_assert_operational_actor(p_org,p_actor)")
  })

  it('blocks volume oversubscriptions and self-approval',()=>{
    expect(migration).toContain('v_total+v_qty>v_parent.ordered_tonnes')
    expect(migration).toContain('v_total + v_record.ordered_tonnes > v_parent.contracted_tonnes')
    expect(migration).toContain('v_total+v_qty>v_parent.shipment_tonnes')
    expect(migration).toContain('v_total + v_record.quantity_tonnes > v_parent.received_tonnes')
    expect(migration).toContain('v_review.submitted_by=p_actor')
    expect(migration).toContain('v_release.created_by=p_actor')
  })

  it('allows no browser direct DML or service-RPC invocation',()=>{
    expect(migration).toContain('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.nfii_create_operation(UUID,UUID,TEXT,JSONB) FROM PUBLIC,anon,authenticated')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.nfii_review_operation(UUID,UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated')
    expect(migration).toContain('ON public.nfii_operation_events')
    expect(migration).toContain('RAISE EXCEPTION')
  })

  it('checks capabilities for all real persistence endpoints',()=>{
    expect(reader).toContain("requireCapability('supply.view',organizationId)")
    expect(reader).toContain("const permission=input.kind==='release'?'decisions.propose':'supply.edit'")
    expect(writer).toContain("const permission=approve?'decisions.approve':'decisions.execute'")
    expect(reader).toContain("createAdminClient()")
    expect(writer).toContain("createAdminClient()")
  })

  it('links the operational network to Watchtower without fixture fallback',()=>{
    expect(watchtower).toContain('<WatchtowerOperationsPulse />')
    expect(watchtower).toContain('href={item.href}')
    expect(watchtower).toContain("'/dashboard/procurement'")
    expect(watchtower).toContain("'/dashboard/logistics'")
    expect(watchtower).toContain("'/dashboard/reserves'")
    expect(watchtower).not.toContain('buildDemoFoodBalanceInput')
  })
})
