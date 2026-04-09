-- ============================================================================
-- Growa Qatar - Operations Seed Data
-- Step 3.3: Qatar-specific crop, livestock, and aquaculture reference data
-- ============================================================================

-- ============================================================================
-- CROP TYPES
-- ============================================================================

-- Date Palms (Qatar's most important crop)
INSERT INTO crop_types (code, name_en, name_ar, scientific_name, category, sub_category, growing_season_start, growing_season_end, days_to_maturity, water_requirement, temperature_tolerance, expected_yield_per_hectare, yield_unit, qatar_suitability_score, recommended_regions) VALUES
('DATE_KHALAS', 'Khalas Date', 'تمر خلاص', 'Phoenix dactylifera', 'date_palms', 'Premium', 4, 9, 180, 'medium', 'extreme_heat_tolerant', 8000, 'kg', 10, ARRAY['Al Shamal', 'Al Khor', 'Al Wakra']),
('DATE_BARHI', 'Barhi Date', 'تمر برحي', 'Phoenix dactylifera', 'date_palms', 'Fresh', 4, 8, 150, 'medium', 'extreme_heat_tolerant', 7000, 'kg', 9, ARRAY['Al Shamal', 'Al Khor']),
('DATE_MEDJOOL', 'Medjool Date', 'تمر مجدول', 'Phoenix dactylifera', 'date_palms', 'Premium', 4, 9, 180, 'high', 'heat_tolerant', 6000, 'kg', 8, ARRAY['Al Khor', 'Al Wakra']);

-- Vegetables (Greenhouse)
INSERT INTO crop_types (code, name_en, name_ar, scientific_name, category, sub_category, growing_season_start, growing_season_end, days_to_maturity, water_requirement, temperature_tolerance, expected_yield_per_hectare, yield_unit, qatar_suitability_score, recommended_regions) VALUES
('VEG_TOMATO', 'Tomato', 'طماطم', 'Solanum lycopersicum', 'vegetables', 'Greenhouse', 10, 4, 90, 'high', 'moderate', 150000, 'kg', 9, ARRAY['All Regions']),
('VEG_CUCUMBER', 'Cucumber', 'خيار', 'Cucumis sativus', 'vegetables', 'Greenhouse', 10, 4, 60, 'high', 'moderate', 200000, 'kg', 9, ARRAY['All Regions']),
('VEG_PEPPER', 'Bell Pepper', 'فلفل حلو', 'Capsicum annuum', 'vegetables', 'Greenhouse', 10, 4, 75, 'medium', 'moderate', 80000, 'kg', 8, ARRAY['All Regions']),
('VEG_EGGPLANT', 'Eggplant', 'باذنجان', 'Solanum melongena', 'vegetables', 'Greenhouse', 10, 5, 80, 'medium', 'heat_tolerant', 60000, 'kg', 8, ARRAY['All Regions']),
('VEG_ZUCCHINI', 'Zucchini', 'كوسا', 'Cucurbita pepo', 'vegetables', 'Greenhouse', 10, 4, 50, 'medium', 'moderate', 50000, 'kg', 8, ARRAY['All Regions']);

-- Leafy Greens (Hydroponic)
INSERT INTO crop_types (code, name_en, name_ar, scientific_name, category, sub_category, growing_season_start, growing_season_end, days_to_maturity, water_requirement, temperature_tolerance, expected_yield_per_hectare, yield_unit, qatar_suitability_score, recommended_regions) VALUES
('LEAF_LETTUCE', 'Lettuce', 'خس', 'Lactuca sativa', 'vegetables', 'Hydroponic', 10, 4, 45, 'medium', 'cold_tolerant', 30000, 'kg', 9, ARRAY['All Regions']),
('LEAF_SPINACH', 'Spinach', 'سبانخ', 'Spinacia oleracea', 'vegetables', 'Hydroponic', 10, 3, 40, 'medium', 'cold_tolerant', 25000, 'kg', 8, ARRAY['All Regions']),
('LEAF_ARUGULA', 'Arugula', 'جرجير', 'Eruca sativa', 'vegetables', 'Hydroponic', 10, 4, 35, 'low', 'moderate', 20000, 'kg', 9, ARRAY['All Regions']),
('LEAF_KALE', 'Kale', 'كرنب أجعد', 'Brassica oleracea var. sabellica', 'vegetables', 'Hydroponic', 10, 3, 55, 'medium', 'cold_tolerant', 22000, 'kg', 7, ARRAY['All Regions']);

-- Herbs
INSERT INTO crop_types (code, name_en, name_ar, scientific_name, category, sub_category, growing_season_start, growing_season_end, days_to_maturity, water_requirement, temperature_tolerance, expected_yield_per_hectare, yield_unit, qatar_suitability_score, recommended_regions) VALUES
('HERB_MINT', 'Mint', 'نعناع', 'Mentha', 'herbs', 'Culinary', 9, 5, 30, 'high', 'heat_tolerant', 15000, 'kg', 10, ARRAY['All Regions']),
('HERB_BASIL', 'Basil', 'ريحان', 'Ocimum basilicum', 'herbs', 'Culinary', 9, 5, 35, 'medium', 'heat_tolerant', 12000, 'kg', 9, ARRAY['All Regions']),
('HERB_PARSLEY', 'Parsley', 'بقدونس', 'Petroselinum crispum', 'herbs', 'Culinary', 10, 4, 40, 'medium', 'moderate', 18000, 'kg', 8, ARRAY['All Regions']),
('HERB_CORIANDER', 'Coriander', 'كزبرة', 'Coriandrum sativum', 'herbs', 'Culinary', 10, 3, 45, 'medium', 'cold_tolerant', 10000, 'kg', 8, ARRAY['All Regions']);

-- Fruits
INSERT INTO crop_types (code, name_en, name_ar, scientific_name, category, sub_category, growing_season_start, growing_season_end, days_to_maturity, water_requirement, temperature_tolerance, expected_yield_per_hectare, yield_unit, qatar_suitability_score, recommended_regions) VALUES
('FRUIT_STRAWBERRY', 'Strawberry', 'فراولة', 'Fragaria × ananassa', 'fruits', 'Greenhouse', 10, 3, 90, 'high', 'cold_tolerant', 40000, 'kg', 7, ARRAY['Cooled Greenhouses']),
('FRUIT_WATERMELON', 'Watermelon', 'بطيخ', 'Citrullus lanatus', 'fruits', 'Open Field', 2, 5, 80, 'high', 'heat_tolerant', 60000, 'kg', 7, ARRAY['Al Shamal', 'Al Khor']);

-- Fodder
INSERT INTO crop_types (code, name_en, name_ar, scientific_name, category, sub_category, growing_season_start, growing_season_end, days_to_maturity, water_requirement, temperature_tolerance, expected_yield_per_hectare, yield_unit, qatar_suitability_score, recommended_regions) VALUES
('FODDER_ALFALFA', 'Alfalfa', 'برسيم حجازي', 'Medicago sativa', 'fodder', 'Perennial', 10, 5, 60, 'very_high', 'heat_tolerant', 80000, 'kg', 7, ARRAY['Al Shamal']),
('FODDER_RHODES', 'Rhodes Grass', 'حشيش رودس', 'Chloris gayana', 'fodder', 'Perennial', 3, 11, 45, 'high', 'extreme_heat_tolerant', 50000, 'kg', 9, ARRAY['All Regions']);

-- ============================================================================
-- LIVESTOCK TYPES
-- ============================================================================

-- Camels (Traditional)
INSERT INTO livestock_types (code, name_en, name_ar, scientific_name, category, breed, average_weight_kg, maturity_months, lifespan_years, primary_product, secondary_products, expected_yield_per_unit, yield_unit, space_requirement_sqm, feed_requirement_kg_per_day, water_requirement_liters_per_day, heat_tolerance, qatar_adaptation_notes) VALUES
('CAM_DROMEDARY', 'Dromedary Camel', 'جمل عربي', 'Camelus dromedarius', 'camels', 'Arabian', 600, 48, 40, 'milk', ARRAY['meat', 'wool', 'racing'], 5, 'liters/day', 500, 25, 30, 'very_high', 'Native to Arabian Peninsula, perfectly adapted to Qatar climate'),
('CAM_RACING', 'Racing Camel', 'جمل سباق', 'Camelus dromedarius', 'camels', 'Racing', 400, 36, 30, 'racing', ARRAY['breeding'], NULL, NULL, 600, 20, 25, 'very_high', 'Bred specifically for racing, significant cultural value');

-- Sheep
INSERT INTO livestock_types (code, name_en, name_ar, scientific_name, category, breed, average_weight_kg, maturity_months, lifespan_years, primary_product, secondary_products, expected_yield_per_unit, yield_unit, space_requirement_sqm, feed_requirement_kg_per_day, water_requirement_liters_per_day, heat_tolerance, qatar_adaptation_notes) VALUES
('SHP_NAJDI', 'Najdi Sheep', 'خروف نجدي', 'Ovis aries', 'sheep', 'Najdi', 70, 12, 12, 'meat', ARRAY['wool'], 25, 'kg meat', 4, 2.5, 8, 'very_high', 'Local breed, excellent heat tolerance'),
('SHP_AWASSI', 'Awassi Sheep', 'خروف عواسي', 'Ovis aries', 'sheep', 'Awassi', 80, 12, 14, 'meat', ARRAY['milk', 'wool'], 30, 'kg meat', 4, 3, 10, 'high', 'Fat-tailed breed, good milk production');

-- Goats
INSERT INTO livestock_types (code, name_en, name_ar, scientific_name, category, breed, average_weight_kg, maturity_months, lifespan_years, primary_product, secondary_products, expected_yield_per_unit, yield_unit, space_requirement_sqm, feed_requirement_kg_per_day, water_requirement_liters_per_day, heat_tolerance, qatar_adaptation_notes) VALUES
('GOT_SHAMI', 'Shami Goat', 'ماعز شامي', 'Capra aegagrus hircus', 'goats', 'Damascus', 65, 10, 15, 'milk', ARRAY['meat'], 3, 'liters/day', 3, 2, 6, 'high', 'Excellent dairy breed, adapted to Gulf climate'),
('GOT_BOER', 'Boer Goat', 'ماعز بور', 'Capra aegagrus hircus', 'goats', 'Boer', 100, 12, 12, 'meat', NULL, 40, 'kg meat', 4, 2.5, 8, 'moderate', 'Premium meat breed, requires climate control');

-- Cattle
INSERT INTO livestock_types (code, name_en, name_ar, scientific_name, category, breed, average_weight_kg, maturity_months, lifespan_years, primary_product, secondary_products, expected_yield_per_unit, yield_unit, space_requirement_sqm, feed_requirement_kg_per_day, water_requirement_liters_per_day, heat_tolerance, qatar_adaptation_notes) VALUES
('CTL_HOLSTEIN', 'Holstein Dairy', 'بقر هولشتاين', 'Bos taurus', 'cattle', 'Holstein', 700, 24, 20, 'milk', ARRAY['meat'], 30, 'liters/day', 15, 25, 100, 'low', 'Requires climate-controlled housing in Qatar'),
('CTL_BRAHMAN', 'Brahman Cattle', 'بقر براهمان', 'Bos indicus', 'cattle', 'Brahman', 800, 24, 20, 'meat', NULL, 400, 'kg meat', 15, 22, 80, 'very_high', 'Heat-tolerant breed suitable for Gulf');

-- Poultry
INSERT INTO livestock_types (code, name_en, name_ar, scientific_name, category, breed, average_weight_kg, maturity_months, lifespan_years, primary_product, secondary_products, expected_yield_per_unit, yield_unit, space_requirement_sqm, feed_requirement_kg_per_day, water_requirement_liters_per_day, heat_tolerance, qatar_adaptation_notes) VALUES
('PLT_BROILER', 'Broiler Chicken', 'دجاج لاحم', 'Gallus gallus domesticus', 'poultry', 'Cobb 500', 2.5, 2, 0.5, 'meat', NULL, 2.2, 'kg meat', 0.1, 0.12, 0.3, 'moderate', 'Requires climate-controlled housing'),
('PLT_LAYER', 'Layer Chicken', 'دجاج بياض', 'Gallus gallus domesticus', 'poultry', 'Lohmann Brown', 2, 5, 2, 'eggs', ARRAY['meat'], 300, 'eggs/year', 0.2, 0.12, 0.25, 'moderate', 'Requires climate-controlled housing'),
('PLT_QUAIL', 'Japanese Quail', 'سمان ياباني', 'Coturnix japonica', 'poultry', 'Japanese', 0.2, 2, 2, 'eggs', ARRAY['meat'], 280, 'eggs/year', 0.02, 0.025, 0.05, 'high', 'Smaller footprint, faster maturity');

-- ============================================================================
-- AQUACULTURE SPECIES
-- ============================================================================

-- Marine Fish
INSERT INTO aquaculture_species (code, name_en, name_ar, scientific_name, category, family, average_weight_kg, growth_rate_months, optimal_temperature_min, optimal_temperature_max, salinity_tolerance, stocking_density_per_cubic_meter, feed_conversion_ratio, expected_survival_rate, local_availability, import_required, qatar_production_notes) VALUES
('FISH_HAMMOUR', 'Hammour (Grouper)', 'هامور', 'Epinephelus coioides', 'marine_fish', 'Serranidae', 3, 18, 24, 30, 'marine', 15, 1.8, 85, true, false, 'Native species, high market value, fingerlings available locally'),
('FISH_SEABREAM', 'Gilthead Sea Bream', 'دنيس', 'Sparus aurata', 'marine_fish', 'Sparidae', 0.5, 12, 18, 26, 'marine', 25, 1.5, 90, false, true, 'Popular species, requires imported fingerlings'),
('FISH_SEABASS', 'European Sea Bass', 'قاروص', 'Dicentrarchus labrax', 'marine_fish', 'Moronidae', 0.6, 14, 18, 28, 'marine', 20, 1.6, 88, false, true, 'Growing demand, good growth in Gulf waters');

-- Shrimp
INSERT INTO aquaculture_species (code, name_en, name_ar, scientific_name, category, family, average_weight_kg, growth_rate_months, optimal_temperature_min, optimal_temperature_max, salinity_tolerance, stocking_density_per_cubic_meter, feed_conversion_ratio, expected_survival_rate, local_availability, import_required, qatar_production_notes) VALUES
('SHRP_WHITE', 'White Leg Shrimp', 'روبيان أبيض', 'Litopenaeus vannamei', 'shrimp', 'Penaeidae', 0.025, 4, 26, 32, 'brackish', 150, 1.4, 75, false, true, 'Fast growing, requires biosecure facilities'),
('SHRP_TIGER', 'Tiger Prawn', 'روبيان نمري', 'Penaeus monodon', 'shrimp', 'Penaeidae', 0.035, 5, 26, 32, 'brackish', 100, 1.6, 70, false, true, 'Premium product, more disease susceptible');

-- Freshwater Fish
INSERT INTO aquaculture_species (code, name_en, name_ar, scientific_name, category, family, average_weight_kg, growth_rate_months, optimal_temperature_min, optimal_temperature_max, salinity_tolerance, stocking_density_per_cubic_meter, feed_conversion_ratio, expected_survival_rate, local_availability, import_required, qatar_production_notes) VALUES
('FISH_TILAPIA', 'Nile Tilapia', 'بلطي نيلي', 'Oreochromis niloticus', 'freshwater_fish', 'Cichlidae', 0.5, 8, 25, 32, 'freshwater', 40, 1.5, 92, true, false, 'Hardy species, can use treated water, local hatcheries available'),
('FISH_CATFISH', 'African Catfish', 'سمك قط أفريقي', 'Clarias gariepinus', 'freshwater_fish', 'Clariidae', 1, 10, 25, 32, 'freshwater', 30, 1.3, 88, false, true, 'Air-breathing, tolerates poor water quality');

-- ============================================================================
-- INPUT TYPES
-- ============================================================================

INSERT INTO input_types (code, name_en, name_ar, category, sub_category, unit_of_measure, min_stock_level, requires_license, restricted_use, qatar_approved) VALUES
-- Seeds and Seedlings
('INP_SEED_TOMATO', 'Tomato Seeds', 'بذور طماطم', 'seeds', 'Vegetable Seeds', 'kg', 5, false, false, true),
('INP_SEED_CUCUMBER', 'Cucumber Seeds', 'بذور خيار', 'seeds', 'Vegetable Seeds', 'kg', 5, false, false, true),
('INP_SEEDLING_TOMATO', 'Tomato Seedlings', 'شتلات طماطم', 'seedlings', 'Vegetable Seedlings', 'units', 1000, false, false, true),
('INP_SEEDLING_CUCUMBER', 'Cucumber Seedlings', 'شتلات خيار', 'seedlings', 'Vegetable Seedlings', 'units', 1000, false, false, true),

-- Fertilizers
('INP_FERT_NPK', 'NPK Fertilizer 20-20-20', 'سماد NPK', 'fertilizer_chemical', 'Compound', 'kg', 100, false, false, true),
('INP_FERT_UREA', 'Urea 46-0-0', 'يوريا', 'fertilizer_chemical', 'Nitrogen', 'kg', 200, false, false, true),
('INP_FERT_COMPOST', 'Organic Compost', 'سماد عضوي', 'fertilizer_organic', 'Compost', 'kg', 500, false, false, true),
('INP_FERT_FISH', 'Fish Emulsion', 'مستخلص السمك', 'fertilizer_organic', 'Liquid Organic', 'liters', 50, false, false, true),

-- Feed
('INP_FEED_POULTRY', 'Poultry Feed Starter', 'علف دواجن بادئ', 'feed_livestock', 'Poultry', 'kg', 500, false, false, true),
('INP_FEED_CATTLE', 'Cattle Feed TMR', 'علف أبقار', 'feed_livestock', 'Cattle', 'kg', 1000, false, false, true),
('INP_FEED_FISH', 'Fish Feed Pellets', 'علف أسماك', 'feed_aquaculture', 'Fish', 'kg', 200, false, false, true),
('INP_FEED_SHRIMP', 'Shrimp Feed', 'علف روبيان', 'feed_aquaculture', 'Shrimp', 'kg', 100, false, false, true),

-- Veterinary
('INP_VET_VACCINE', 'Newcastle Vaccine', 'لقاح نيوكاسل', 'veterinary', 'Vaccine', 'doses', 1000, true, false, true),
('INP_VET_ANTIBIOTIC', 'Oxytetracycline', 'أوكسي تتراسيكلين', 'veterinary', 'Antibiotic', 'grams', 500, true, true, true),

-- Water Treatment
('INP_WATER_CHLORINE', 'Calcium Hypochlorite', 'هيبوكلوريت الكالسيوم', 'water_treatment', 'Disinfectant', 'kg', 50, false, false, true),
('INP_WATER_PROBIO', 'Aquaculture Probiotic', 'بروبيوتيك مائي', 'water_treatment', 'Biological', 'kg', 10, false, false, true);
