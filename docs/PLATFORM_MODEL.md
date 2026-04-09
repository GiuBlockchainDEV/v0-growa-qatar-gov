# Growa Qatar - Platform and Deployment Model

**Step 1.1: Platform vs Deployment vs Organization Model**

## Hierarchy

```
Growa Platform (Base)
└── Growa Qatar (Country Deployment)
    ├── Ministry of Municipality (Organization)
    │   ├── Food Security Division (Department)
    │   └── Agricultural Inspection (Department)
    ├── Hassad Food (Organization)
    │   ├── Operations (Department)
    │   └── Quality Assurance (Department)
    └── Qatar Development Bank (Organization)
        └── Agricultural Finance (Department)
```

## Platform Base: Growa

The **Growa Platform** is the shared foundation for all country deployments:

- Core architecture and codebase
- Design system and component library
- Authentication framework
- Operational ontology (farm, greenhouse, sensor, alert, etc.)
- Module structure
- Code conventions and patterns

**NOT country-specific:**
- No branding or legal labels
- No map data or geographic boundaries
- No organization data
- No role presets beyond templates

## Country Deployment: Growa Qatar

**Growa Qatar** is the first sovereign country deployment, customizing:

| Element | Qatar Customization |
|---------|---------------------|
| Branding | Qatar maroon, Arabic/English |
| Legal Labels | State of Qatar, Ministry names |
| Organizations | Qatar-specific entities |
| Regions | Qatar municipalities |
| Map Layers | Qatar geography, satellite data |
| Role Presets | Qatar government structure |
| Language | Arabic primary, English secondary |

**Future Deployments:**
- Growa Saudi (KSA)
- Growa UAE
- Growa Oman
- Growa Kuwait
- Growa Bahrain

Each country deployment will:
1. Reuse the Growa platform base
2. Have its own isolated Supabase project
3. Customize branding, legal labels, organizations
4. Define country-specific roles and permissions

## Organizations Inside Qatar

Growa Qatar serves **multiple authorized organizations** within one deployment:

### Organization Types

| Type | Description | Example |
|------|-------------|---------|
| `ministry` | Government ministry | Ministry of Municipality |
| `sovereign_entity` | State food security body | Qatar Food Security Program |
| `state_operator` | State-owned agricultural operator | Hassad Food |
| `financial_institution` | Agricultural finance provider | Qatar Development Bank |
| `research_entity` | Agricultural research body | Qatar University Ag Research |
| `external_operator` | Approved private operator | [Licensed farms] |

### Key Principles

1. **Not Ministry-Only**: The platform serves multiple organization types, not just government.

2. **Organization Scoping**: Each user belongs to one or more organizations with specific roles.

3. **Data Isolation**: Organizations see only their own data unless explicitly granted cross-organization access.

4. **Shared Infrastructure**: All organizations share the Qatar deployment infrastructure but have isolated data.

## Access Model Summary

```
Country Instance (Qatar)
└── Organization (Ministry of Municipality)
    └── Department (Food Security Division)
        └── User Membership
            ├── Role (Food Security Operations Director)
            └── Scope (Region: Doha Municipality)
```

- **Country Instance**: Top-level deployment container
- **Organization**: Authorized entity within the country
- **Department**: Division within an organization
- **User Membership**: Links a user to an organization with role and scope
- **Role**: Permission template
- **Scope**: Data visibility boundaries (region, farm, etc.)

## Database Implications

Tables to support this model (Phase 1.5):

- `country_instances` - Qatar deployment record
- `organizations` - Ministry, Hassad, QDB, etc.
- `departments` - Divisions within organizations
- `profiles` - User profiles (linked to auth.users)
- `memberships` - User-organization-role assignments
- `role_templates` - Predefined role definitions
- `permission_templates` - Granular permission sets

## Cross-Cutting Concerns

1. **Bilingual Content**: All labels support English and Arabic
2. **Audit Trail**: All significant actions are logged
3. **Invitation-Only**: No public signup
4. **Organization Context**: UI always shows current organization context
