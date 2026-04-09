# Supabase Type Generation

## Overview

TypeScript types are generated directly from the Supabase schema. This ensures type safety and keeps the types in sync with the actual database structure.

## Generation Workflow

### Local Development

After modifying the schema (migrations), regenerate types:

```bash
# Start local Supabase
supabase start

# Generate types
supabase gen types typescript --local > supabase/types/database.ts

# Or using the helper script
./scripts/generate-types.sh
```

### After Production Migrations

```bash
# Generate types from production
supabase gen types typescript --project-id [your-project-id] > supabase/types/database.ts
```

## Type Usage in Components

```typescript
import type { Database } from '@/supabase/types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export function UserCard({ profile }: { profile: Profile }) {
  return <div>{profile.email}</div>;
}
```

## Type Files Structure

- `supabase/types/database.ts` - Main database types (auto-generated)
- `supabase/types/enums.ts` - Enum types (optional, for easier imports)
- `supabase/types/custom.ts` - Custom application types built on database types

## Checking In Types

Always commit the generated `supabase/types/database.ts` file to version control. This allows:
- Reviewers to see schema changes
- CI/CD to validate type compatibility
- Team members to work offline with accurate types

## Type Safety Checklist

- [ ] Ran type generation after migrations
- [ ] Types compile without errors
- [ ] Imports use correct table names
- [ ] Insert/Update types match API payloads
- [ ] Row types match component props
