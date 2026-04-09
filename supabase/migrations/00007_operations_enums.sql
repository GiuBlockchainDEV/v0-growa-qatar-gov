-- ============================================================================
-- Growa Qatar - Operations Enums Migration
-- Step 3.2: Create enums for operations domain
-- ============================================================================

-- Crop categories
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

-- Water requirement levels
CREATE TYPE water_level AS ENUM (
  'very_low',
  'low',
  'medium',
  'high',
  'very_high'
);

-- Temperature tolerance
CREATE TYPE temperature_range AS ENUM (
  'cold_tolerant',
  'moderate',
  'heat_tolerant',
  'extreme_heat_tolerant'
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

-- Heat tolerance
CREATE TYPE heat_tolerance_level AS ENUM (
  'low',
  'moderate',
  'high',
  'very_high'
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

-- Salinity levels
CREATE TYPE salinity_level AS ENUM (
  'freshwater',
  'brackish',
  'marine',
  'hypersaline'
);

-- Farm types
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

-- Ownership types
CREATE TYPE ownership_type AS ENUM (
  'government',
  'private',
  'cooperative',
  'joint_venture',
  'leased'
);

-- Certification status
CREATE TYPE certification_status AS ENUM (
  'none',
  'pending',
  'organic',
  'gap',
  'haccp',
  'iso_certified'
);

-- Farm status
CREATE TYPE farm_status AS ENUM (
  'planning',
  'active',
  'seasonal_pause',
  'maintenance',
  'inactive',
  'decommissioned'
);

-- Production unit types
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

-- Production unit status
CREATE TYPE production_unit_status AS ENUM (
  'available',
  'in_production',
  'harvesting',
  'fallow',
  'maintenance',
  'quarantine'
);

-- Planting methods
CREATE TYPE planting_method AS ENUM (
  'direct_seeding',
  'transplanting',
  'cutting',
  'grafting',
  'tissue_culture'
);

-- Cycle status
CREATE TYPE cycle_status AS ENUM (
  'planned',
  'in_progress',
  'harvesting',
  'completed',
  'failed',
  'cancelled'
);

-- Batch sources
CREATE TYPE batch_source AS ENUM (
  'own_breeding',
  'local_purchase',
  'imported',
  'government_program',
  'transferred'
);

-- Batch health status
CREATE TYPE batch_health_status AS ENUM (
  'healthy',
  'under_observation',
  'treatment',
  'quarantine',
  'critical'
);

-- Batch status
CREATE TYPE batch_status AS ENUM (
  'active',
  'sold',
  'transferred',
  'culled',
  'lost'
);

-- Aquaculture cycle status
CREATE TYPE aquaculture_cycle_status AS ENUM (
  'preparing',
  'stocked',
  'growing',
  'harvesting',
  'completed',
  'failed'
);

-- Input categories
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

-- Inventory status
CREATE TYPE inventory_status AS ENUM (
  'available',
  'reserved',
  'depleted',
  'expired',
  'recalled'
);

-- Activity types
CREATE TYPE activity_type AS ENUM (
  'soil_preparation',
  'planting',
  'irrigation',
  'fertilizing',
  'pest_control',
  'weeding',
  'pruning',
  'harvesting',
  'feeding',
  'watering',
  'vaccination',
  'health_check',
  'breeding',
  'milking',
  'shearing',
  'slaughter',
  'water_quality_check',
  'feeding_aqua',
  'stocking',
  'sampling',
  'treatment',
  'harvesting_aqua',
  'maintenance',
  'inspection',
  'training',
  'other'
);
