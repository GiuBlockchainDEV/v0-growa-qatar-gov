# Growa Qatar - Operations Data Model

**Step 3.1: Crop/Livestock/Aquaculture Domain Entities**

## Overview

This document defines the core operational data entities for Growa Qatar's agricultural operations platform. These entities represent the physical assets, activities, and metrics tracked across Qatar's agricultural sector.

## Domain Entity Categories

### 1. Agricultural Assets

#### 1.1 Crop Types
```sql
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
  growing_season_start INT, -- Month (1-12)
  growing_season_end INT,   -- Month (1-12)
  days_to_maturity INT,
  water_requirement water_level NOT NULL DEFAULT 'medium',
  temperature_tolerance temperature_range NOT NULL DEFAULT 'moderate',
  
  -- Yield expectations
  expected_yield_per_hectare DECIMAL(10,2),
  yield_unit VARCHAR(50) DEFAULT 'kg',
  
  -- Qatar suitability
  qatar_suitability_score INT CHECK (qatar_suitability_score BETWEEN 1 AND 10),
  recommended_regions TEXT[], -- Qatar regions
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Crop categories for Qatar
CREATE TYPE crop_category AS ENUM (
  'vegetables',
  'fruits',
  'grains',
  'legumes',
  'fodder',
  'herbs',
  'ornamental',
  'date_palms'
);
```

#### 1.2 Livestock Types
```sql
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
  primary_product VARCHAR(100), -- meat, milk, wool, eggs
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

-- Livestock categories
CREATE TYPE livestock_category AS ENUM (
  'cattle',
  'sheep',
  'goats',
  'camels',
  'poultry',
  'rabbits',
  'horses',
  'bees'
);

CREATE TYPE heat_tolerance_level AS ENUM (
  'low',
  'moderate',
  'high',
  'very_high'
);
```

#### 1.3 Aquaculture Species
```sql
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
  growth_rate_months INT, -- Time to market size
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

-- Aquaculture categories
CREATE TYPE aquaculture_category AS ENUM (
  'marine_fish',
  'freshwater_fish',
  'shrimp',
  'shellfish',
  'seaweed',
  'ornamental'
);

CREATE TYPE salinity_level AS ENUM (
  'freshwater',
  'brackish',
  'marine',
  'hypersaline'
);
```

### 2. Production Sites

#### 2.1 Farms
```sql
CREATE TABLE farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
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
  water_sources TEXT[], -- well, desalinated, recycled, municipal
  daily_water_allocation_cubic_meters DECIMAL(10,2),
  
  -- Status
  status farm_status NOT NULL DEFAULT 'active',
  operational_since DATE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

CREATE TYPE farm_type AS ENUM (
  'open_field',
  'greenhouse',
  'hydroponic',
  'vertical',
  'mixed',
  'livestock',
  'aquaculture',
  'integrated'
);

CREATE TYPE ownership_type AS ENUM (
  'government',
  'private',
  'cooperative',
  'joint_venture',
  'leased'
);

CREATE TYPE certification_status AS ENUM (
  'none',
  'pending',
  'organic',
  'gap', -- Good Agricultural Practices
  'haccp',
  'iso_certified'
);

CREATE TYPE farm_status AS ENUM (
  'planning',
  'active',
  'seasonal_pause',
  'maintenance',
  'inactive',
  'decommissioned'
);
```

#### 2.2 Production Units (Fields, Pens, Tanks)
```sql
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
  volume_cubic_meters DECIMAL(12,2), -- For aquaculture tanks
  
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

CREATE TYPE production_unit_type AS ENUM (
  'field',
  'greenhouse_section',
  'hydroponic_unit',
  'vertical_rack',
  'livestock_pen',
  'poultry_house',
  'aquaculture_tank',
  'aquaculture_pond',
  'aquaculture_cage',
  'processing_area',
  'storage'
);

CREATE TYPE production_unit_status AS ENUM (
  'available',
  'in_production',
  'harvesting',
  'fallow',
  'maintenance',
  'quarantine'
);
```

### 3. Production Cycles

#### 3.1 Growing Cycles
```sql
CREATE TABLE growing_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_unit_id UUID NOT NULL REFERENCES production_units(id),
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

CREATE TYPE planting_method AS ENUM (
  'direct_seeding',
  'transplanting',
  'cutting',
  'grafting',
  'tissue_culture'
);

CREATE TYPE cycle_status AS ENUM (
  'planned',
  'in_progress',
  'harvesting',
  'completed',
  'failed',
  'cancelled'
);
```

#### 3.2 Livestock Batches
```sql
CREATE TABLE livestock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_unit_id UUID NOT NULL REFERENCES production_units(id),
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
  production_unit VARCHAR(50), -- liters, eggs, kg wool
  
  -- Status
  status batch_status NOT NULL DEFAULT 'active',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

CREATE TYPE batch_source AS ENUM (
  'own_breeding',
  'local_purchase',
  'imported',
  'government_program',
  'transferred'
);

CREATE TYPE batch_health_status AS ENUM (
  'healthy',
  'under_observation',
  'treatment',
  'quarantine',
  'critical'
);

CREATE TYPE batch_status AS ENUM (
  'active',
  'sold',
  'transferred',
  'culled',
  'lost'
);
```

#### 3.3 Aquaculture Cycles
```sql
CREATE TABLE aquaculture_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_unit_id UUID NOT NULL REFERENCES production_units(id),
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
  status aquaculture_cycle_status NOT NULL DEFAULT 'active',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

CREATE TYPE aquaculture_cycle_status AS ENUM (
  'preparing',
  'stocked',
  'growing',
  'harvesting',
  'completed',
  'failed'
);
```

### 4. Inputs and Resources

#### 4.1 Input Types (Seeds, Feed, Fertilizers, etc.)
```sql
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

CREATE TYPE input_category AS ENUM (
  'seeds',
  'seedlings',
  'fertilizer_organic',
  'fertilizer_chemical',
  'pesticide',
  'herbicide',
  'feed_livestock',
  'feed_aquaculture',
  'veterinary',
  'water_treatment',
  'packaging',
  'equipment',
  'fuel'
);
```

#### 4.2 Input Inventory
```sql
CREATE TABLE input_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
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

CREATE TYPE inventory_status AS ENUM (
  'available',
  'reserved',
  'depleted',
  'expired',
  'recalled'
);
```

### 5. Activity Logging

#### 5.1 Farm Activities
```sql
CREATE TABLE farm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
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
  inputs_used JSONB, -- Array of {input_type_id, quantity, unit}
  
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

CREATE TYPE activity_type AS ENUM (
  -- Crop activities
  'soil_preparation',
  'planting',
  'irrigation',
  'fertilizing',
  'pest_control',
  'weeding',
  'pruning',
  'harvesting',
  
  -- Livestock activities
  'feeding',
  'watering',
  'vaccination',
  'health_check',
  'breeding',
  'milking',
  'shearing',
  'slaughter',
  
  -- Aquaculture activities
  'water_quality_check',
  'feeding_aqua',
  'stocking',
  'sampling',
  'treatment',
  'harvesting_aqua',
  
  -- General
  'maintenance',
  'inspection',
  'training',
  'other'
);
```

## Relationships Diagram

```
Organizations
     │
     ├── Farms
     │      │
     │      ├── Production Units
     │      │      │
     │      │      ├── Growing Cycles ──> Crop Types
     │      │      ├── Livestock Batches ──> Livestock Types
     │      │      └── Aquaculture Cycles ──> Aquaculture Species
     │      │
     │      ├── Input Inventory ──> Input Types
     │      │
     │      └── Farm Activities
     │
     └── Regions
```

## Qatar-Specific Considerations

### Climate Adaptations
- All date/temperature references account for Qatar's hot climate
- Water scarcity metrics are prioritized
- Heat tolerance ratings for all species

### Local Regulations
- MOPH food safety compliance
- Qatar Standards compliance
- Import/export tracking for species

### Supported Crops (Qatar Priority)
1. Date palms (major crop)
2. Tomatoes (greenhouse)
3. Cucumbers (greenhouse)
4. Leafy greens (hydroponic)
5. Herbs (oregano, mint, basil)
6. Strawberries (cooled greenhouse)

### Supported Livestock (Qatar Priority)
1. Camels (traditional)
2. Sheep (local breeds)
3. Goats
4. Poultry (broilers, layers)
5. Dairy cattle

### Supported Aquaculture (Qatar Priority)
1. Hammour (grouper)
2. Sea bream
3. Shrimp
4. Tilapia (freshwater)

## Next Steps

- Step 3.2: Create actual SQL migrations for operations tables
- Step 3.3: Seed Qatar-specific crop/livestock/aquaculture reference data
- Step 3.4: Define RLS policies for operations data
