-- Growa Qatar - Database Extensions
-- Step 1.8: Initial migration setup

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Note: These extensions provide:
-- uuid-ossp: UUID generation functions (uuid_generate_v4, etc.)
-- pgcrypto: Cryptographic functions (gen_random_uuid, crypt, etc.)
