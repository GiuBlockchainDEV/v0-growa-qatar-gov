-- ============================================================================
-- Growa Qatar - Production Cycles Migration
-- Step 3.2: Create growing, livestock, and aquaculture cycle tables
-- ============================================================================

-- Growing Cycles (Crops)
CREATE TABLE growing_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_unit_id UUID NOT NULL REFERENCES production_units(id) ON DELETE CASCADE,
  crop_type_id UUID NOT NULL REFERENCES crop_types(id),
  
  -- Timeline
  planned_start_date DATE NOT NULL,
  actual_start_date DATE,
  expected_harvest_date DATE,
  actual_harvest_date DATE,
  
  -- Planting details
  planting_method planting_method NOT NULL,
  seed_source VARCHAR(255),
  seed_quantity_kg DECIMAL(10,2),
  seedling_count INT,
  
  -- Area
  planted_area_sqm DECIMAL(12,2),
  
  -- Expected outcomes
  expected_yield_kg DECIMAL(12,2),
  
  -- Actual outcomes
  actual_yield_kg DECIMAL(12,2),
  yield_quality_grade VARCHAR(10),
  
  -- Status
  status cycle_status NOT NULL DEFAULT 'planned',
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- Livestock Batches
CREATE TABLE livestock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_unit_id UUID NOT NULL REFERENCES production_units(id) ON DELETE CASCADE,
  livestock_type_id UUID NOT NULL REFERENCES livestock_types(id),
  
  -- Batch details
  batch_code VARCHAR(50) NOT NULL,
  
  -- Timeline
  arrival_date DATE NOT NULL,
  expected_output_date DATE,
  actual_output_date DATE,
  
  -- Quantities
  initial_count INT NOT NULL,
  current_count INT NOT NULL,
  mortality_count INT DEFAULT 0,
  sold_count INT DEFAULT 0,
  
  -- Source
  source_type batch_source NOT NULL,
  source_details TEXT,
  
  -- Health
  vaccination_status VARCHAR(100),
  health_status batch_health_status NOT NULL DEFAULT 'healthy',
  
  -- Production (for dairy/eggs)
  total_production_kg DECIMAL(12,2),
  production_unit VARCHAR(50),
  
  -- Status
  status batch_status NOT NULL DEFAULT 'active',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- Aquaculture Cycles
CREATE TABLE aquaculture_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_unit_id UUID NOT NULL REFERENCES production_units(id) ON DELETE CASCADE,
  species_id UUID NOT NULL REFERENCES aquaculture_species(id),
  
  -- Cycle details
  cycle_code VARCHAR(50) NOT NULL,
  
  -- Timeline
  stocking_date DATE NOT NULL,
  expected_harvest_date DATE,
  actual_harvest_date DATE,
  
  -- Stocking
  initial_stock_count INT NOT NULL,
  average_stocking_weight_grams DECIMAL(10,2),
  
  -- Current status
  current_count INT,
  average_current_weight_grams DECIMAL(10,2),
  mortality_count INT DEFAULT 0,
  
  -- Water parameters targets
  target_temperature_celsius DECIMAL(5,2),
  target_salinity_ppt DECIMAL(5,2),
  target_ph_min DECIMAL(4,2),
  target_ph_max DECIMAL(4,2),
  
  -- Harvest
  harvest_weight_kg DECIMAL(12,2),
  harvest_count INT,
  
  -- Status
  status aquaculture_cycle_status NOT NULL DEFAULT 'preparing',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- Indexes
CREATE INDEX idx_growing_cycles_unit ON growing_cycles(production_unit_id);
CREATE INDEX idx_growing_cycles_crop ON growing_cycles(crop_type_id);
CREATE INDEX idx_growing_cycles_status ON growing_cycles(status);
CREATE INDEX idx_growing_cycles_dates ON growing_cycles(planned_start_date, expected_harvest_date);

CREATE INDEX idx_livestock_batches_unit ON livestock_batches(production_unit_id);
CREATE INDEX idx_livestock_batches_type ON livestock_batches(livestock_type_id);
CREATE INDEX idx_livestock_batches_status ON livestock_batches(status);
CREATE INDEX idx_livestock_batches_health ON livestock_batches(health_status);

CREATE INDEX idx_aquaculture_cycles_unit ON aquaculture_cycles(production_unit_id);
CREATE INDEX idx_aquaculture_cycles_species ON aquaculture_cycles(species_id);
CREATE INDEX idx_aquaculture_cycles_status ON aquaculture_cycles(status);

-- Triggers
CREATE TRIGGER update_growing_cycles_updated_at
  BEFORE UPDATE ON growing_cycles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_livestock_batches_updated_at
  BEFORE UPDATE ON livestock_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aquaculture_cycles_updated_at
  BEFORE UPDATE ON aquaculture_cycles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE growing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE livestock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE aquaculture_cycles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for growing_cycles
CREATE POLICY "Users can view growing cycles in their farms"
  ON growing_cycles FOR SELECT
  USING (
    production_unit_id IN (
      SELECT pu.id FROM production_units pu
      JOIN farms f ON pu.farm_id = f.id
      JOIN memberships m ON f.organization_id = m.organization_id
      WHERE m.user_id = auth.uid() AND m.status = 'active'
    )
  );

CREATE POLICY "Farm operators can manage growing cycles"
  ON growing_cycles FOR ALL
  USING (
    production_unit_id IN (
      SELECT pu.id FROM production_units pu
      JOIN farms f ON pu.farm_id = f.id
      JOIN memberships m ON f.organization_id = m.organization_id
      JOIN role_templates rt ON m.role_template_id = rt.id
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND rt.code IN ('org_master_admin', 'org_admin', 'food_security_ops_director', 'regional_ops_officer', 'agricultural_inspector', 'agronomist')
    )
  );

-- RLS Policies for livestock_batches
CREATE POLICY "Users can view livestock batches in their farms"
  ON livestock_batches FOR SELECT
  USING (
    production_unit_id IN (
      SELECT pu.id FROM production_units pu
      JOIN farms f ON pu.farm_id = f.id
      JOIN memberships m ON f.organization_id = m.organization_id
      WHERE m.user_id = auth.uid() AND m.status = 'active'
    )
  );

CREATE POLICY "Farm operators can manage livestock batches"
  ON livestock_batches FOR ALL
  USING (
    production_unit_id IN (
      SELECT pu.id FROM production_units pu
      JOIN farms f ON pu.farm_id = f.id
      JOIN memberships m ON f.organization_id = m.organization_id
      JOIN role_templates rt ON m.role_template_id = rt.id
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND rt.code IN ('org_master_admin', 'org_admin', 'food_security_ops_director', 'regional_ops_officer', 'agricultural_inspector', 'agronomist')
    )
  );

-- RLS Policies for aquaculture_cycles
CREATE POLICY "Users can view aquaculture cycles in their farms"
  ON aquaculture_cycles FOR SELECT
  USING (
    production_unit_id IN (
      SELECT pu.id FROM production_units pu
      JOIN farms f ON pu.farm_id = f.id
      JOIN memberships m ON f.organization_id = m.organization_id
      WHERE m.user_id = auth.uid() AND m.status = 'active'
    )
  );

CREATE POLICY "Farm operators can manage aquaculture cycles"
  ON aquaculture_cycles FOR ALL
  USING (
    production_unit_id IN (
      SELECT pu.id FROM production_units pu
      JOIN farms f ON pu.farm_id = f.id
      JOIN memberships m ON f.organization_id = m.organization_id
      JOIN role_templates rt ON m.role_template_id = rt.id
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND rt.code IN ('org_master_admin', 'org_admin', 'food_security_ops_director', 'regional_ops_officer', 'agricultural_inspector', 'agronomist')
    )
  );
