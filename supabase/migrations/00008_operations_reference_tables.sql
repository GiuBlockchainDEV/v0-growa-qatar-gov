-- ============================================================================
-- Growa Qatar - Operations Reference Tables Migration
-- Step 3.2: Create reference tables for crops, livestock, aquaculture
-- ============================================================================

-- Crop Types
CREATE TABLE crop_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  code VARCHAR(20) UNIQUE NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  scientific_name VARCHAR(255),
  
  -- Classification
  category crop_category NOT NULL,
  sub_category VARCHAR(100),
  
  -- Growing characteristics (Qatar-specific)
  growing_season_start INT CHECK (growing_season_start BETWEEN 1 AND 12),
  growing_season_end INT CHECK (growing_season_end BETWEEN 1 AND 12),
  days_to_maturity INT,
  water_requirement water_level NOT NULL DEFAULT 'medium',
  temperature_tolerance temperature_range NOT NULL DEFAULT 'moderate',
  
  -- Yield expectations
  expected_yield_per_hectare DECIMAL(10,2),
  yield_unit VARCHAR(50) DEFAULT 'kg',
  
  -- Qatar suitability
  qatar_suitability_score INT CHECK (qatar_suitability_score BETWEEN 1 AND 10),
  recommended_regions TEXT[],
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Livestock Types
CREATE TABLE livestock_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  code VARCHAR(20) UNIQUE NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  scientific_name VARCHAR(255),
  
  -- Classification
  category livestock_category NOT NULL,
  breed VARCHAR(100),
  
  -- Characteristics
  average_weight_kg DECIMAL(10,2),
  maturity_months INT,
  lifespan_years INT,
  
  -- Production metrics
  primary_product VARCHAR(100),
  secondary_products TEXT[],
  expected_yield_per_unit DECIMAL(10,2),
  yield_unit VARCHAR(50),
  
  -- Requirements
  space_requirement_sqm DECIMAL(10,2),
  feed_requirement_kg_per_day DECIMAL(10,2),
  water_requirement_liters_per_day DECIMAL(10,2),
  
  -- Qatar suitability
  heat_tolerance heat_tolerance_level NOT NULL DEFAULT 'moderate',
  qatar_adaptation_notes TEXT,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Aquaculture Species
CREATE TABLE aquaculture_species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  code VARCHAR(20) UNIQUE NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  scientific_name VARCHAR(255) NOT NULL,
  
  -- Classification
  category aquaculture_category NOT NULL,
  family VARCHAR(100),
  
  -- Characteristics
  average_weight_kg DECIMAL(10,2),
  growth_rate_months INT,
  optimal_temperature_min DECIMAL(5,2),
  optimal_temperature_max DECIMAL(5,2),
  salinity_tolerance salinity_level NOT NULL,
  
  -- Production metrics
  stocking_density_per_cubic_meter INT,
  feed_conversion_ratio DECIMAL(5,2),
  expected_survival_rate DECIMAL(5,2),
  
  -- Qatar suitability
  local_availability BOOLEAN DEFAULT false,
  import_required BOOLEAN DEFAULT true,
  qatar_production_notes TEXT,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Input Types (seeds, feed, fertilizers, etc.)
CREATE TABLE input_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  code VARCHAR(50) UNIQUE NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  
  -- Classification
  category input_category NOT NULL,
  sub_category VARCHAR(100),
  
  -- Specifications
  unit_of_measure VARCHAR(50) NOT NULL,
  min_stock_level DECIMAL(12,2),
  
  -- Regulatory
  requires_license BOOLEAN DEFAULT false,
  restricted_use BOOLEAN DEFAULT false,
  qatar_approved BOOLEAN DEFAULT true,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_crop_types_category ON crop_types(category);
CREATE INDEX idx_crop_types_active ON crop_types(is_active);
CREATE INDEX idx_livestock_types_category ON livestock_types(category);
CREATE INDEX idx_livestock_types_active ON livestock_types(is_active);
CREATE INDEX idx_aquaculture_species_category ON aquaculture_species(category);
CREATE INDEX idx_aquaculture_species_active ON aquaculture_species(is_active);
CREATE INDEX idx_input_types_category ON input_types(category);
CREATE INDEX idx_input_types_active ON input_types(is_active);

-- Updated at triggers
CREATE TRIGGER update_crop_types_updated_at
  BEFORE UPDATE ON crop_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_livestock_types_updated_at
  BEFORE UPDATE ON livestock_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aquaculture_species_updated_at
  BEFORE UPDATE ON aquaculture_species
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_input_types_updated_at
  BEFORE UPDATE ON input_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
