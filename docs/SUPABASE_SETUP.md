# Growa Qatar - Supabase Setup Guide

**Step 0.5: Supabase bootstrap documentation**

## Overview

Growa Qatar uses Supabase as the backend foundation:
- **Supabase Auth** for identity management
- **Postgres** for the operational database
- **Row Level Security (RLS)** for access control
- **Storage** for documents and attachments (when needed)
- **Realtime** for live operational feeds (when needed)
- **Edge Functions** for privileged operations

## Environment Setup

### 1. Local Development (Supabase CLI)

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# The CLI will output URLs and keys for local development
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anonymous (public) API key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-side only)

## Client Usage

### Browser/Client Components

```typescript
import { createClient } from '@/lib/supabase/browser'

const supabase = createClient()
const { data, error } = await supabase.from('table').select()
```

### Server Components / Server Actions

```typescript
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
const { data, error } = await supabase.from('table').select()
```

### Privileged Operations (Admin)

```typescript
import { createAdminClient, validateAdminContext } from '@/lib/supabase/admin'

validateAdminContext() // Safety check
const supabase = createAdminClient()
// Bypasses RLS - use with caution!
```

## Migration Workflow

1. Create migration file in `supabase/migrations/`
2. Test locally with `supabase db reset`
3. Apply to staging with `supabase db push --linked`
4. Review and apply to production

## Type Generation

After creating/modifying tables, regenerate types:

```bash
npx supabase gen types typescript --local > supabase/types/database.ts
```

## Security Rules

1. **Never expose service role key** to the client
2. **Always enable RLS** on tables with tenant data
3. **Use Edge Functions** for privileged mutations
4. **Audit all security-sensitive operations**
