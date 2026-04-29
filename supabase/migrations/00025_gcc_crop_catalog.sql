-- GCC crop and variety catalog for map polygon inputs.

CREATE TABLE IF NOT EXISTS public.gcc_crop_types (
  code TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ar TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gcc_crop_varieties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_code TEXT NOT NULL REFERENCES public.gcc_crop_types(code) ON DELETE CASCADE,
  variety_name TEXT NOT NULL,
  variety_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gcc_crop_types_active_idx
  ON public.gcc_crop_types(is_active);

CREATE INDEX IF NOT EXISTS gcc_crop_varieties_crop_code_idx
  ON public.gcc_crop_varieties(crop_code);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gcc_crop_varieties_crop_code_variety_key_key'
  ) THEN
    ALTER TABLE public.gcc_crop_varieties
    ADD CONSTRAINT gcc_crop_varieties_crop_code_variety_key_key
    UNIQUE (crop_code, variety_key);
  END IF;
END $$;

ALTER TABLE public.gcc_crop_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gcc_crop_varieties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gcc_crop_types_select_authenticated ON public.gcc_crop_types;
CREATE POLICY gcc_crop_types_select_authenticated
  ON public.gcc_crop_types
  FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS gcc_crop_varieties_select_authenticated ON public.gcc_crop_varieties;
CREATE POLICY gcc_crop_varieties_select_authenticated
  ON public.gcc_crop_varieties
  FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

INSERT INTO public.gcc_crop_types (code, name_en, name_ar, is_active)
VALUES
  ('alfalfa', 'Alfalfa', 'برسيم', TRUE),
  ('barley', 'Barley', 'شعير', TRUE),
  ('wheat', 'Wheat', 'قمح', TRUE),
  ('maize', 'Maize', 'ذرة', TRUE),
  ('sorghum', 'Sorghum', 'ذرة رفيعة', TRUE),
  ('millet', 'Millet', 'دخن', TRUE),
  ('rice', 'Rice', 'أرز', TRUE),
  ('chickpea', 'Chickpea', 'حمص', TRUE),
  ('lentil', 'Lentil', 'عدس', TRUE),
  ('faba_bean', 'Faba Bean', 'فول', TRUE),
  ('sesame', 'Sesame', 'سمسم', TRUE),
  ('sunflower', 'Sunflower', 'دوار الشمس', TRUE),
  ('tomato', 'Tomato', 'طماطم', TRUE),
  ('cucumber', 'Cucumber', 'خيار', TRUE),
  ('pepper', 'Pepper', 'فلفل', TRUE),
  ('eggplant', 'Eggplant', 'باذنجان', TRUE),
  ('onion', 'Onion', 'بصل', TRUE),
  ('potato', 'Potato', 'بطاطس', TRUE),
  ('okra', 'Okra', 'بامية', TRUE),
  ('zucchini', 'Zucchini', 'كوسا', TRUE),
  ('watermelon', 'Watermelon', 'بطيخ', TRUE),
  ('melon', 'Melon', 'شمام', TRUE),
  ('date_palm', 'Date Palm', 'نخيل', TRUE),
  ('citrus', 'Citrus', 'حمضيات', TRUE),
  ('olive', 'Olive', 'زيتون', TRUE)
ON CONFLICT (code) DO UPDATE
SET
  name_en = EXCLUDED.name_en,
  name_ar = EXCLUDED.name_ar,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO public.gcc_crop_varieties (crop_code, variety_name, variety_key, is_active)
SELECT
  v.crop_code,
  v.variety_name,
  LOWER(TRIM(v.variety_name)) AS variety_key,
  TRUE
FROM (
  VALUES
    ('alfalfa', 'CUF 101'),
    ('alfalfa', 'Saranac'),
    ('alfalfa', 'Rhizoma'),
    ('barley', 'Rihane-03'),
    ('barley', 'Giza 2000'),
    ('barley', 'ACSAD 176'),
    ('wheat', 'Yecora Rojo'),
    ('wheat', 'Sakha 93'),
    ('wheat', 'Bohoth 10'),
    ('maize', 'Pioneer 30Y87'),
    ('maize', 'DKC 6664'),
    ('maize', 'Giza 352'),
    ('sorghum', 'Dorado'),
    ('sorghum', 'Shandaweel 6'),
    ('sorghum', 'Gadam'),
    ('millet', 'ICMV 221'),
    ('millet', 'HHB 67'),
    ('millet', 'Dembi'),
    ('rice', 'IR64'),
    ('rice', 'Sakha 101'),
    ('rice', 'Jasmine'),
    ('chickpea', 'Kabuli'),
    ('chickpea', 'Desi'),
    ('chickpea', 'Giza 531'),
    ('lentil', 'Giza 9'),
    ('lentil', 'Idlib 3'),
    ('lentil', 'Red Chief'),
    ('faba_bean', 'Giza 843'),
    ('faba_bean', 'Sakha 4'),
    ('faba_bean', 'Nubaria 1'),
    ('sesame', 'Shandweel 3'),
    ('sesame', 'Giza 32'),
    ('sesame', 'Sohag 1'),
    ('sunflower', 'Sakha 53'),
    ('sunflower', 'Giza 102'),
    ('sunflower', 'Hysun 33'),
    ('tomato', 'Roma VF'),
    ('tomato', 'Super Marmande'),
    ('tomato', 'Money Maker'),
    ('cucumber', 'Beit Alpha'),
    ('cucumber', 'Marketmore 76'),
    ('cucumber', 'Poinsett 76'),
    ('pepper', 'California Wonder'),
    ('pepper', 'Anaheim'),
    ('pepper', 'Jalapeno M'),
    ('eggplant', 'Black Beauty'),
    ('eggplant', 'Long Purple'),
    ('eggplant', 'Classic'),
    ('onion', 'Texas Early Grano'),
    ('onion', 'Red Creole'),
    ('onion', 'Giza 20'),
    ('potato', 'Spunta'),
    ('potato', 'Desiree'),
    ('potato', 'Cara'),
    ('okra', 'Clemson Spineless'),
    ('okra', 'Balady'),
    ('okra', 'Emerald'),
    ('zucchini', 'Grey Zucchini'),
    ('zucchini', 'Black Beauty'),
    ('zucchini', 'Caserta'),
    ('watermelon', 'Crimson Sweet'),
    ('watermelon', 'Charleston Gray'),
    ('watermelon', 'Sugar Baby'),
    ('melon', 'Galia'),
    ('melon', 'Honeydew'),
    ('melon', 'Ananas'),
    ('date_palm', 'Khalas'),
    ('date_palm', 'Barhi'),
    ('date_palm', 'Medjool'),
    ('citrus', 'Valencia'),
    ('citrus', 'Navel'),
    ('citrus', 'Eureka'),
    ('olive', 'Arbequina'),
    ('olive', 'Picual'),
    ('olive', 'Koroneiki')
) AS v(crop_code, variety_name)
ON CONFLICT (crop_code, variety_key) DO UPDATE
SET
  variety_name = EXCLUDED.variety_name,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
