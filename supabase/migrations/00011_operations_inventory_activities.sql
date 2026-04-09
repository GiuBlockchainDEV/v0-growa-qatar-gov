-- ============================================================================
-- Growa Qatar - Inventory and Activities Migration
-- Step 3.2: Create input inventory and farm activities tables
-- ============================================================================

-- Input Inventory
CREATE TABLE input_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  input_type_id UUID NOT NULL REFERENCES input_types(id),
  
  -- Batch tracking
  batch_number VARCHAR(100),
  supplier VARCHAR(255),
  purchase_date DATE,
  expiry_date DATE,
  
  -- Quantities
  quantity_received DECIMAL(12,2) NOT NULL,
  quantity_remaining DECIMAL(12,2) NOT NULL,
  unit_cost DECIMAL(12,2),
  currency VARCHAR(3) DEFAULT 'QAR',
  
  -- Storage
  storage_location VARCHAR(255),
  storage_conditions TEXT,
  
  -- Status
  status inventory_status NOT NULL DEFAULT 'available',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- Farm Activities
CREATE TABLE farm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  production_unit_id UUID REFERENCES production_units(id),
  
  -- Activity reference
  growing_cycle_id UUID REFERENCES growing_cycles(id),
  livestock_batch_id UUID REFERENCES livestock_batches(id),
  aquaculture_cycle_id UUID REFERENCES aquaculture_cycles(id),
  
  -- Activity details
  activity_type activity_type NOT NULL,
  activity_date DATE NOT NULL,
  
  -- Description
  description_en TEXT,
  description_ar TEXT,
  
  -- Inputs used
  inputs_used JSONB,
  
  -- Labor
  labor_hours DECIMAL(6,2),
  workers_count INT,
  
  -- Equipment
  equipment_used TEXT[],
  
  -- Weather conditions
  weather_conditions JSONB,
  
  -- Results/observations
  observations TEXT,
  issues_encountered TEXT,
  
  -- Attachments
  photo_urls TEXT[],
  document_urls TEXT[],
  
  -- Metadata
  recorded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_input_inventory_farm ON input_inventory(farm_id);
CREATE INDEX idx_input_inventory_type ON input_inventory(input_type_id);
CREATE INDEX idx_input_inventory_status ON input_inventory(status);
CREATE INDEX idx_input_inventory_expiry ON input_inventory(expiry_date);

CREATE INDEX idx_farm_activities_farm ON farm_activities(farm_id);
CREATE INDEX idx_farm_activities_unit ON farm_activities(production_unit_id);
CREATE INDEX idx_farm_activities_type ON farm_activities(activity_type);
CREATE INDEX idx_farm_activities_date ON farm_activities(activity_date);
CREATE INDEX idx_farm_activities_growing_cycle ON farm_activities(growing_cycle_id);
CREATE INDEX idx_farm_activities_livestock_batch ON farm_activities(livestock_batch_id);
CREATE INDEX idx_farm_activities_aquaculture_cycle ON farm_activities(aquaculture_cycle_id);

-- Triggers
CREATE TRIGGER update_input_inventory_updated_at
  BEFORE UPDATE ON input_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_farm_activities_updated_at
  BEFORE UPDATE ON farm_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE input_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for input_inventory
CREATE POLICY "Users can view inventory in their farms"
  ON input_inventory FOR SELECT
  USING (
    farm_id IN (
      SELECT f.id FROM farms f
      JOIN memberships m ON f.organization_id = m.organization_id
      WHERE m.user_id = auth.uid() AND m.status = 'active'
    )
  );

CREATE POLICY "Farm managers can manage inventory"
  ON input_inventory FOR ALL
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

-- RLS Policies for farm_activities
CREATE POLICY "Users can view activities in their farms"
  ON farm_activities FOR SELECT
  USING (
    farm_id IN (
      SELECT f.id FROM farms f
      JOIN memberships m ON f.organization_id = m.organization_id
      WHERE m.user_id = auth.uid() AND m.status = 'active'
    )
  );

CREATE POLICY "Farm operators can insert activities"
  ON farm_activities FOR INSERT
  WITH CHECK (
    farm_id IN (
      SELECT f.id FROM farms f
      JOIN memberships m ON f.organization_id = m.organization_id
      JOIN role_templates rt ON m.role_template_id = rt.id
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND rt.code IN ('org_master_admin', 'org_admin', 'food_security_ops_director', 'regional_ops_officer', 'agricultural_inspector', 'agronomist')
    )
  );

CREATE POLICY "Farm operators can update their activities"
  ON farm_activities FOR UPDATE
  USING (
    recorded_by = auth.uid()
    OR farm_id IN (
      SELECT f.id FROM farms f
      JOIN memberships m ON f.organization_id = m.organization_id
      JOIN role_templates rt ON m.role_template_id = rt.id
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND rt.code IN ('org_master_admin', 'org_admin', 'food_security_ops_director')
    )
  );
