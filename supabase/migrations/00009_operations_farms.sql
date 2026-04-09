-- ============================================================================
-- Growa Qatar - Farms and Production Units Migration
-- Step 3.2: Create farm and production unit tables
-- ============================================================================

-- Farms
CREATE TABLE farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Identification
  code VARCHAR(50) UNIQUE NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  
  -- Location
  region_id UUID REFERENCES regions(id),
  municipality VARCHAR(100),
  gps_latitude DECIMAL(10,8),
  gps_longitude DECIMAL(11,8),
  address_en TEXT,
  address_ar TEXT,
  
  -- Size and capacity
  total_area_hectares DECIMAL(10,2),
  cultivable_area_hectares DECIMAL(10,2),
  
  -- Classification
  farm_type farm_type NOT NULL,
  ownership_type ownership_type NOT NULL,
  certification_status certification_status DEFAULT 'none',
  
  -- Infrastructure
  has_irrigation BOOLEAN DEFAULT false,
  irrigation_type VARCHAR(100),
  has_greenhouse BOOLEAN DEFAULT false,
  greenhouse_area_sqm DECIMAL(10,2),
  has_cold_storage BOOLEAN DEFAULT false,
  cold_storage_capacity_tons DECIMAL(10,2),
  
  -- Water sources
  water_sources TEXT[],
  daily_water_allocation_cubic_meters DECIMAL(10,2),
  
  -- Status
  status farm_status NOT NULL DEFAULT 'active',
  operational_since DATE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- Production Units (Fields, Pens, Tanks)
CREATE TABLE production_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  
  -- Identification
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  
  -- Type
  unit_type production_unit_type NOT NULL,
  
  -- Dimensions
  area_sqm DECIMAL(12,2),
  volume_cubic_meters DECIMAL(12,2),
  
  -- Current usage
  current_crop_type_id UUID REFERENCES crop_types(id),
  current_livestock_type_id UUID REFERENCES livestock_types(id),
  current_aquaculture_species_id UUID REFERENCES aquaculture_species(id),
  
  -- Capacity
  max_capacity INT,
  current_occupancy INT,
  
  -- Status
  status production_unit_status NOT NULL DEFAULT 'available',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(farm_id, code)
);

-- Indexes
CREATE INDEX idx_farms_organization ON farms(organization_id);
CREATE INDEX idx_farms_region ON farms(region_id);
CREATE INDEX idx_farms_status ON farms(status);
CREATE INDEX idx_farms_type ON farms(farm_type);
CREATE INDEX idx_production_units_farm ON production_units(farm_id);
CREATE INDEX idx_production_units_type ON production_units(unit_type);
CREATE INDEX idx_production_units_status ON production_units(status);

-- Triggers
CREATE TRIGGER update_farms_updated_at
  BEFORE UPDATE ON farms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_production_units_updated_at
  BEFORE UPDATE ON production_units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_units ENABLE ROW LEVEL SECURITY;

-- RLS Policies for farms
CREATE POLICY "Users can view farms in their organization"
  ON farms FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Org admins can insert farms"
  ON farms FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN role_templates rt ON m.role_template_id = rt.id
      WHERE m.user_id = auth.uid()
        AND m.organization_id = farms.organization_id
        AND m.status = 'active'
        AND rt.code IN ('org_master_admin', 'org_admin', 'food_security_ops_director')
    )
  );

CREATE POLICY "Org admins can update farms"
  ON farms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN role_templates rt ON m.role_template_id = rt.id
      WHERE m.user_id = auth.uid()
        AND m.organization_id = farms.organization_id
        AND m.status = 'active'
        AND rt.code IN ('org_master_admin', 'org_admin', 'food_security_ops_director')
    )
  );

-- RLS Policies for production_units
CREATE POLICY "Users can view production units in their farms"
  ON production_units FOR SELECT
  USING (
    farm_id IN (
      SELECT f.id FROM farms f
      JOIN memberships m ON f.organization_id = m.organization_id
      WHERE m.user_id = auth.uid() AND m.status = 'active'
    )
  );

CREATE POLICY "Farm managers can insert production units"
  ON production_units FOR INSERT
  WITH CHECK (
    farm_id IN (
      SELECT f.id FROM farms f
      JOIN memberships m ON f.organization_id = m.organization_id
      JOIN role_templates rt ON m.role_template_id = rt.id
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND rt.code IN ('org_master_admin', 'org_admin', 'food_security_ops_director', 'regional_ops_officer')
    )
  );

CREATE POLICY "Farm managers can update production units"
  ON production_units FOR UPDATE
  USING (
    farm_id IN (
      SELECT f.id FROM farms f
      JOIN memberships m ON f.organization_id = m.organization_id
      JOIN role_templates rt ON m.role_template_id = rt.id
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND rt.code IN ('org_master_admin', 'org_admin', 'food_security_ops_director', 'regional_ops_officer')
    )
  );
