'use client'

import { useEffect, useState } from 'react'
import { useGovernance, SHARED_LAYERS } from '@/hooks/use-governance'
import { usePermissions } from '@/hooks/use-permissions'
import { useOrganization } from '@/hooks/use-organization'
import { Building2, Shield, ShoppingCart, DollarSign, Wrench, Users, ChevronRight } from 'lucide-react'

interface Organization {
  id: string
  name: string
  slug: string
  type: string
  tier: number
  description?: string
}

export default function OrganizationsPage() {
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted-foreground">Loading organizations...</div>
      </div>
    )
  }

  // Only government_master (Ministry) can see all organizations
  const canViewAllOrgs = userOrgType === 'government_master'

  const getOrgIcon = (type: string) => {
    switch (type) {
      case 'government_master': return <Shield className="h-5 w-5 text-red-500" />
      case 'government': return <Building2 className="h-5 w-5 text-orange-500" />
      case 'farm_company': return <Users className="h-5 w-5 text-[#07fc82]" />
      default: return <Building2 className="h-5 w-5 text-blue-500" />
    }
  }

  const getOrgTypeLabel = (type: string) => {
    switch (type) {
      case 'government_master': return 'Master Authority'
      case 'government': return 'Government Entity'
      case 'farm_company': return 'Farm Company'
      case 'private': return 'Private Organization'
      default: return type
    }
  }

  const getOrgTypeColor = (type: string) => {
    switch (type) {
      case 'government_master': return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'government': return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      case 'farm_company': return 'bg-[#07fc82]/10 text-[#07fc82] border-[#07fc82]/20'
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    }
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
    regulatory: <Shield className="h-4 w-4" />,
    commercial: <ShoppingCart className="h-4 w-4" />,
    finance: <DollarSign className="h-4 w-4" />,
    technical_support: <Wrench className="h-4 w-4" />,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Building2 className="h-6 w-6 text-[#07fc82]" />
          Organizations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {canViewAllOrgs 
            ? 'Manage all organizations in the Growa Qatar ecosystem'
            : 'View your organization details'
          }
        </p>
      </div>

      {/* Organization Hierarchy */}
      <div className="rounded-lg border border-white/5 overflow-hidden">
        <div className="p-4 bg-white/[0.02] border-b border-white/5">
          <h2 className="font-semibold text-foreground">Top-Level Organizations (Tier 1)</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Primary stakeholders with equal authority in the Growa ecosystem
          </p>
        </div>

        <div className="divide-y divide-white/5">
          {organizations.map((org) => (
            <div
              key={org.id}
              className="p-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {getOrgIcon(org.type)}
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">{org.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {org.description || `Tier ${org.tier} organization`}
                    </p>
                    
                    {/* Shared Layers Access */}
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs text-muted-foreground">Shared Layers:</span>
                      <div className="flex items-center gap-1">
                        {getSharedLayersForOrg(org.type).map((layer) => (
                          <div
                            key={layer}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-xs text-white/70"
                            title={SHARED_LAYERS[layer as keyof typeof SHARED_LAYERS]?.description}
                          >
                            {layerIcons[layer]}
                            <span>{SHARED_LAYERS[layer as keyof typeof SHARED_LAYERS]?.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full border text-xs font-medium ${getOrgTypeColor(org.type)}`}>
                    {getOrgTypeLabel(org.type)}
                  </span>
                  {canViewAllOrgs && (
                    <button className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Governance Overview */}
      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
        <h3 className="font-semibold text-foreground mb-4">Shared Layers Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(SHARED_LAYERS).map(([key, layer]) => (
            <div key={key} className="p-3 rounded-lg bg-white/5 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                {layerIcons[key]}
                <span className="font-medium text-foreground text-sm">{layer.name}</span>
              </div>
              <p className="text-xs text-muted-foreground">{layer.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Data Isolation Notice */}
      <div className="rounded-lg border border-[#07fc82]/20 bg-[#07fc82]/5 p-4">
        <h3 className="font-semibold text-[#07fc82] mb-2">Data Isolation & Privacy</h3>
        <p className="text-sm text-white/70">
          Each organization maintains isolated data by default. Data can only be shared with the 
          Ministry of Municipality when explicitly approved by the owning organization through 
          the Data Sharing settings. All data access is logged for audit purposes.
        </p>
      </div>
    </div>
  )
}
