import {describe,expect,it} from 'vitest'
import {resolveAuthorization,type MembershipRecord} from '@/lib/auth/authorization'
import {canViewGlobalMaritimeRadar} from './global-maritime-access'

function context(memberships:MembershipRecord[],tier:null|'super_admin'|'support'=null){
  return {
    memberships,
    authorization:resolveAuthorization({
      userId:'test-account',memberships,activeOrganizationId:null,
      platformStaffTier:tier,
    }),
  }
}
describe('global public-source radar access',()=>{
  it('authorizes an active viewer without requesting or selecting an organization',()=>{
    const memberships=[
      {organizationId:'org-a',role:'viewer',status:'active'},
      {organizationId:'org-b',role:'sourcing_manager',status:'active'},
    ]
    expect(canViewGlobalMaritimeRadar(context(memberships))).toBe(true)
    expect(context(memberships).authorization.activeOrganizationId).toBeNull()
  })
  it('never turns mere authentication into permission without active membership',()=>{
    expect(canViewGlobalMaritimeRadar(context([]))).toBe(false)
    expect(canViewGlobalMaritimeRadar(context([
      {organizationId:'org-a',role:'owner',status:'invited'},
      {organizationId:'org-b',role:'owner',status:'suspended'},
    ]))).toBe(false)
  })
  it('allows an authenticated platform super-admin, not ordinary support',()=>{
    expect(canViewGlobalMaritimeRadar(context([],'super_admin'))).toBe(true)
    expect(canViewGlobalMaritimeRadar(context([],'support'))).toBe(false)
  })
})
