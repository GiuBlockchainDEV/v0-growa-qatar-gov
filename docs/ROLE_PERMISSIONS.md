# Growa Qatar - Role and Permission Architecture

**Step 1.4: Role and permission layers definition**

## Permission Layer Stack

Effective permissions are computed by combining multiple layers:

```
┌─────────────────────────────────────────┐
│ Layer 1: Country Instance              │
│ (Qatar deployment boundary)             │
├─────────────────────────────────────────┤
│ Layer 2: Organization                   │
│ (Ministry, Hassad Food, QDB, etc.)      │
├─────────────────────────────────────────┤
│ Layer 3: Department                     │
│ (Food Security, Operations, etc.)       │
├─────────────────────────────────────────┤
│ Layer 4: Region/Geographic Scope        │
│ (Doha, Al Wakrah, Al Khor, etc.)        │
├─────────────────────────────────────────┤
│ Layer 5: Object Scope                   │
│ (Specific farms, greenhouses, etc.)     │
├─────────────────────────────────────────┤
│ Layer 6: Action Permissions             │
│ (read, write, approve, admin, etc.)     │
└─────────────────────────────────────────┘
```

**Critical Rule**: Never flatten this into a single 'role' string. Effective permissions = Role Template + Scoped Assignments.

## Role Templates

### Administrative Roles

#### Organization Master Admin
**Code**: `org_master_admin`

Full administrative control over the organization.

| Permission | Scope |
|------------|-------|
| Manage users | Organization-wide |
| Manage departments | Organization-wide |
| Manage roles | Organization-wide |
| View all data | Organization-wide |
| Approve workflows | Organization-wide |
| Audit access | Organization-wide |

**Typical Users**: IT Director, Chief Admin Officer

---

#### Organization Admin
**Code**: `org_admin`

Administrative control with some restrictions.

| Permission | Scope |
|------------|-------|
| Manage users | Department-scoped |
| View all data | Organization-wide |
| Manage workflows | Department-scoped |
| Cannot modify org settings | N/A |

**Typical Users**: Department Head, Admin Manager

---

### Operational Roles

#### Food Security Operations Director
**Code**: `food_security_director`

Strategic oversight of food security operations.

| Permission | Scope |
|------------|-------|
| View all operations | Country-wide |
| Approve critical decisions | Organization-wide |
| Access executive reports | Full |
| Assign investigations | Organization-wide |
| Cannot modify users | N/A |

**Typical Users**: Director of Food Security, Deputy Minister

---

#### Regional Operations Officer
**Code**: `regional_ops_officer`

Day-to-day management of a geographic region.

| Permission | Scope |
|------------|-------|
| View operations | Region-scoped |
| Manage alerts | Region-scoped |
| Assign inspections | Region-scoped |
| Approve remediation | Region-scoped |
| View reports | Region-scoped |

**Typical Users**: Regional Manager, District Coordinator

---

#### Agricultural Inspector
**Code**: `agricultural_inspector`

Field inspection and compliance verification.

| Permission | Scope |
|------------|-------|
| View assigned tasks | Own assignments |
| Create inspection reports | Assigned scope |
| Document findings | Assigned scope |
| Upload evidence | Assigned scope |
| View asset details | Assigned scope |
| Cannot approve | N/A |

**Typical Users**: Field Inspector, Compliance Inspector

---

#### Agronomist
**Code**: `agronomist`

Technical agricultural expertise and advisory.

| Permission | Scope |
|------------|-------|
| View all crop data | Assigned scope |
| Create recommendations | Assigned scope |
| View sensor data | Assigned scope |
| View irrigation data | Assigned scope |
| Cannot approve workflows | N/A |

**Typical Users**: Senior Agronomist, Crop Specialist

---

#### Compliance Officer
**Code**: `compliance_officer`

Regulatory compliance and audit.

| Permission | Scope |
|------------|-------|
| View compliance data | Organization-wide |
| Create compliance reports | Organization-wide |
| View audit logs | Organization-wide |
| Flag violations | Organization-wide |
| Cannot modify operations | N/A |

**Typical Users**: Compliance Manager, Audit Specialist

---

### Viewing Roles

#### Analyst / Viewer
**Code**: `analyst`

Data analysis and reporting access.

| Permission | Scope |
|------------|-------|
| View dashboards | Assigned scope |
| View reports | Assigned scope |
| Export data | Assigned scope |
| Cannot modify anything | N/A |

**Typical Users**: Data Analyst, Research Assistant

---

#### Executive Read-Only
**Code**: `executive_readonly`

High-level visibility without operational access.

| Permission | Scope |
|------------|-------|
| View executive dashboards | Organization-wide |
| View summary reports | Organization-wide |
| View KPIs | Organization-wide |
| Cannot see operational details | N/A |
| Cannot modify anything | N/A |

**Typical Users**: CEO, Board Member, Minister

---

### External Roles

#### External Operator (Restricted)
**Code**: `external_operator`

Limited access for external partners.

| Permission | Scope |
|------------|-------|
| View own assets only | Own assets |
| Update own asset status | Own assets |
| View own alerts | Own assets |
| Cannot see other operators | N/A |
| Cannot access reports | N/A |

**Typical Users**: Private Farm Operator, Licensed Greenhouse Owner

---

## Permission Actions

### Core Actions

| Action | Description |
|--------|-------------|
| `read` | View data |
| `write` | Create/update data |
| `delete` | Remove data (soft delete) |
| `approve` | Approve workflows/requests |
| `assign` | Assign tasks to others |
| `admin` | Administrative actions |
| `export` | Export/download data |

### Domain-Specific Actions

| Domain | Actions |
|--------|---------|
| Users | `invite`, `suspend`, `revoke`, `change_role` |
| Alerts | `acknowledge`, `escalate`, `resolve`, `close` |
| Inspections | `schedule`, `complete`, `review`, `certify` |
| Irrigation | `start`, `stop`, `adjust`, `schedule` |
| Reports | `generate`, `share`, `archive` |

## Scope Assignments

### Geographic Scopes

```typescript
interface GeographicScope {
  type: 'country' | 'region' | 'municipality' | 'farm' | 'greenhouse'
  ids: string[] // UUIDs of allowed entities
  include_children: boolean // Include nested entities
}
```

### Examples

**Country-wide access:**
```json
{
  "type": "country",
  "ids": ["qatar-uuid"],
  "include_children": true
}
```

**Region-scoped access:**
```json
{
  "type": "region",
  "ids": ["doha-uuid", "al-wakrah-uuid"],
  "include_children": true
}
```

**Specific farms only:**
```json
{
  "type": "farm",
  "ids": ["farm-1-uuid", "farm-2-uuid"],
  "include_children": true
}
```

## Permission Resolution

### Algorithm

```
1. Get user's role_template_id from membership
2. Load role_template permissions
3. Get user's scope_assignments from membership
4. For each permission check:
   a. Check if role_template grants the action
   b. Check if scope_assignment includes the target entity
   c. If both pass, permission granted
   d. Otherwise, permission denied
```

### Example Resolution

**Question**: Can user X read farm Y?

```
1. User X has role: regional_ops_officer
2. Role grants: read operations in assigned scope
3. User X scope: region = "doha"
4. Farm Y is in: region = "doha"
5. Result: GRANTED
```

**Question**: Can user X approve inspection for farm Z?

```
1. User X has role: agricultural_inspector
2. Role grants: create inspections, document findings
3. Role does NOT grant: approve
4. Result: DENIED (inspectors cannot approve)
```

## Database Schema Preview

```sql
-- Role templates (predefined)
CREATE TABLE role_templates (
  id UUID PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  permissions JSONB NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memberships (user-org-role assignments)
CREATE TABLE memberships (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  department_id UUID REFERENCES departments(id),
  role_template_id UUID REFERENCES role_templates(id),
  scope_assignments JSONB, -- Geographic and object scopes
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Permission Checking Utilities

### Server-Side Check

```typescript
async function hasPermission(
  userId: string,
  action: string,
  resource: { type: string; id: string }
): Promise<boolean> {
  // 1. Load user's memberships
  // 2. For each membership, check role permissions
  // 3. Verify scope includes the resource
  // 4. Return true if any membership grants access
}
```

### RLS Policy Pattern

```sql
CREATE POLICY "Users can read farms in their scope"
ON farms FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.user_id = auth.uid()
    AND m.status = 'active'
    AND (
      -- Check geographic scope
      farms.region_id = ANY(m.scope_assignments->'region_ids')
      OR
      -- Or direct farm access
      farms.id = ANY(m.scope_assignments->'farm_ids')
    )
  )
);
```
