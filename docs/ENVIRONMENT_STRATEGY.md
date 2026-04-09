# Growa Qatar - Environment Strategy

**Step 0.3: Environment configuration documentation**
**Step 1.2: Supabase environment strategy confirmation**

## Project-Per-Country Production Isolation

**Critical Rule**: Each country deployment gets its own isolated Supabase production project.

| Country | Production Project | Data Isolation |
|---------|-------------------|----------------|
| Qatar | `growa-qatar-prod` | Complete isolation |
| Saudi (future) | `growa-saudi-prod` | Complete isolation |
| UAE (future) | `growa-uae-prod` | Complete isolation |

This ensures:
- Sovereign data stays within country boundaries
- No accidental cross-country data leakage
- Independent scaling and maintenance
- Country-specific backup and recovery

## Environment Isolation

The Growa Qatar deployment follows a strict environment isolation strategy:

| Environment | Purpose | Supabase Project |
|-------------|---------|------------------|
| `local` | Local development | Local Supabase CLI |
| `preview` | PR preview deployments | Shared preview project |
| `staging` | Pre-production validation | Dedicated staging project |
| `production` | Live Qatar deployment | **Isolated production project** |

## Critical Rules

1. **Production Isolation**: Production data for Qatar MUST live in a dedicated Supabase project.
2. **Never Mix Environments**: Preview deployments must NEVER point to production secrets.
3. **Country Isolation**: Future country deployments (Saudi, UAE, etc.) will get separate production projects.

## Environment Variables

See `.env.example` for the complete list of environment variables.

### Required Variables

| Variable | Description | Server/Client |
|----------|-------------|---------------|
| `NEXT_PUBLIC_DEPLOYMENT_ENV` | Current environment | Client |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Client |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | **Server only** |

## Naming Convention

- `growa-qatar-local` - Local development
- `growa-qatar-preview` - Preview deployments
- `growa-qatar-staging` - Staging environment
- `growa-qatar-prod` - Production environment

## Vercel Configuration

Each environment should have its own set of environment variables in Vercel:

1. **Preview**: Uses preview-specific Supabase credentials
2. **Production**: Uses isolated production Supabase credentials

Never configure a preview branch to use production database credentials.

## Local Development Approach

### Using Supabase CLI

```bash
# Install Supabase CLI globally
npm install -g supabase

# Initialize (if not already done)
supabase init

# Start local Supabase stack
supabase start

# Output includes:
# - API URL: http://localhost:54321
# - Anon Key: eyJ...
# - Service Role Key: eyJ...
# - Studio URL: http://localhost:54323
```

### Local Development Workflow

1. Start local Supabase: `supabase start`
2. Run migrations: `supabase db reset`
3. Generate types: `supabase gen types typescript --local`
4. Start Next.js: `pnpm dev`

### Environment Variables for Local

```env
NEXT_PUBLIC_DEPLOYMENT_ENV=local
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=[from supabase start output]
SUPABASE_SERVICE_ROLE_KEY=[from supabase start output]
```

## Preview/Staging Strategy

### Preview Deployments (PR-based)

- Triggered automatically on pull requests
- Use shared `growa-qatar-preview` Supabase project
- Database state may be reset between PRs
- For testing features before merge

### Staging Environment

- Mirrors production configuration
- Uses `growa-qatar-staging` Supabase project
- Full data migration testing
- Pre-release validation checkpoint

### Staging Checklist

Before promoting to production:
- [ ] All migrations applied successfully
- [ ] RLS policies tested with representative roles
- [ ] Auth flows validated (sign-in, invitation, reset)
- [ ] Cross-organization isolation verified
- [ ] Performance acceptable under load
- [ ] Audit logging functioning

## Deployment Responsibilities

| Responsibility | Owner |
|---------------|-------|
| Local Supabase setup | Developer |
| Preview project configuration | DevOps |
| Staging project management | DevOps |
| Production project access | Limited (Admin only) |
| Migration approval | Tech Lead |
| Production deployment | Authorized deployers only |
