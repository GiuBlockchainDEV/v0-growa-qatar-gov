'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useGovernance, SHARED_LAYERS } from '@/hooks/use-governance'
import { usePermissions } from '@/hooks/use-permissions'
import { useOrganization } from '@/hooks/use-organization'
import { Building2, Layers, Shield, ShoppingCart, DollarSign, Wrench, ChevronRight } from 'lucide-react'
import { Card, LoadingState, Notice, PageBody, PageHeader, Tile } from '@/components/brand/layout'
import { StatusTag } from '@/components/brand/status'

interface Organization {
  id: string
  name: string
  slug: string
  type: string
  tier: number
  description?: string
}

export default function OrganizationsPage() {
  const { tr } = useI18n()
  const { getTopLevelOrganizations } = useGovernance()
  const { getUserOrgType } = usePermissions()
  const { organization } = useOrganization()
  
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [userOrgType, setUserOrgType] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (!organization?.id) return

      const [orgs, orgType] = await Promise.all([
        getTopLevelOrganizations(),
        getUserOrgType(organization.id),
      ])

      setOrganizations(orgs)
      setUserOrgType(orgType)
      setIsLoading(false)
    }

    loadData()
  }, [organization?.id, getTopLevelOrganizations, getUserOrgType])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <LoadingState label={tr('Loading organisations…')} />
      </div>
    )
  }

  // Only government_master (Ministry) can see all organizations
  const canViewAllOrgs = userOrgType === 'government_master'

  const getOrgTypeLabel = (type: string) => {
    switch (type) {
      case 'government_master': return tr('Master authority')
      case 'government': return tr('Government entity')
      case 'farm_company': return tr('Farm company')
      case 'private': return tr('Private organisation')
      default: return type
    }
  }

  const ORG_LEVEL: Record<string, string> = {
    government_master: 'critical',
    government: 'high',
    farm_company: 'good',
  }

  const getSharedLayersForOrg = (type: string) => {
    switch (type) {
      case 'government_master':
        return ['regulatory', 'commercial', 'finance', 'technical_support']
      case 'government':
        return ['commercial', 'finance'] // Hassad = commercial, QDB = finance
      case 'farm_company':
        return ['technical_support']
      default:
        return []
    }
  }

  const layerIcons: Record<string, React.ReactNode> = {
    regulatory: <Shield strokeWidth={1.5} className="h-4 w-4" />,
    commercial: <ShoppingCart strokeWidth={1.5} className="h-4 w-4" />,
    finance: <DollarSign strokeWidth={1.5} className="h-4 w-4" />,
    technical_support: <Wrench strokeWidth={1.5} className="h-4 w-4" />,
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <PageBody>
        <PageHeader
          eyebrow={tr('Settings')}
          title={tr('Organisations')}
          subtitle={canViewAllOrgs ? tr('Manage all organisations in the Growa Qatar ecosystem.') : tr('Your organisation details.')}
        />

        <div className="space-y-4">
          <Card icon={Building2} title={tr('Top-level organisations (tier 1)')} subtitle={tr('Primary stakeholders with equal authority in the Growa ecosystem.')} flush>
            <ul className="divide-y divide-line">
              {organizations.map((org) => (
                <li key={org.id} className="px-4 py-4 hover:bg-muted transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[15px] text-content" style={{ fontWeight: 500 }}>{org.name}</h3>
                      <p className="text-[13px] text-content-soft mt-0.5">
                        {org.description || tr('Tier {tier} organisation', { tier: org.tier })}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="text-[12px] text-content-soft">{tr('Shared layers')}</span>
                        {getSharedLayersForOrg(org.type).map((layer) => (
                          <span
                            key={layer}
                            className="g-tag g-tag--muted"
                            style={{ height: 24, padding: '0 10px', fontSize: 12 }}
                            title={tr(SHARED_LAYERS[layer as keyof typeof SHARED_LAYERS]?.description ?? '')}
                          >
                            {layerIcons[layer]}
                            {tr(SHARED_LAYERS[layer as keyof typeof SHARED_LAYERS]?.name ?? '')}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusTag level={ORG_LEVEL[org.type] || 'unknown'} label={getOrgTypeLabel(org.type)} size="md" />
                      {canViewAllOrgs && (
                        <button aria-label={tr('Open {name}', { name: org.name })} className="w-8 h-8 inline-flex items-center justify-center text-content-soft hover:text-content hover:bg-stone-100 rounded-pill transition-colors">
                          <ChevronRight strokeWidth={1.5} className="h-4 w-4 rtl:-scale-x-100" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card icon={Layers} title={tr('Shared layers overview')}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(SHARED_LAYERS).map(([key, layer]) => (
                <Tile key={key}>
                  <div className="flex items-center gap-2 mb-1.5 text-content-soft">
                    {layerIcons[key]}
                    <span className="text-[14px] text-content" style={{ fontWeight: 500 }}>{tr(layer.name)}</span>
                  </div>
                  <p className="text-[12px] text-content-soft leading-snug">{tr(layer.description)}</p>
                </Tile>
              ))}
            </div>
          </Card>

          <Notice tone="good" title={tr('Data isolation and privacy')}>
            {tr(
              'Each organisation keeps its data isolated by default. Data can only be shared with the Ministry of Municipality when explicitly approved by the owning organisation in the data sharing settings. All data access is logged for audit purposes.'
            )}
          </Notice>
        </div>
      </PageBody>
    </div>
  )
}
