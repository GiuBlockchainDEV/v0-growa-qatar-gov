# Growa Qatar - Agricultural Operations Platform

Sovereign agricultural operations platform for Qatar built with Next.js, Supabase, and TypeScript.

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase account (integrated via v0)
- npm, pnpm, or yarn

### Installation

```bash
# Clone or download the repository
cd growa-qatar

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Add your Supabase credentials to .env.local
```

### Development

```bash
# Start development server
pnpm dev

# Open http://localhost:3000 in your browser
```

### Database Setup

1. **Connect Supabase via v0 Settings**
   - Click Settings (top right)
   - Select "Integrations"
   - Connect Supabase
   
2. **Run Migrations**
   ```bash
   # Migrations are in supabase/migrations/
   # They will be applied automatically when you connect Supabase
   ```

3. **Create Test Organization (if needed)**
   - Sign up with a test email
   - After email verification, create an organization in the dashboard
   - Add farms to test the platform

### First Steps

1. **Sign Up**
   - Go to http://localhost:3000
   - Click "Create Account"
   - Enter email and password
   - Verify your email (check mailbox or Supabase dashboard)

2. **Sign In**
   - After email verification, go to /auth/login
   - Use your credentials
   - You'll be redirected to /dashboard

3. **Create Organization (if needed)**
   - Visit /dashboard/settings
   - Create a new organization
   - You'll be assigned as owner

4. **Add Farms**
   - Go to /dashboard/farms
   - Click "Add Farm"
   - Fill in farm details (bilingual support available)

## Project Structure

```
growa-qatar/
├── app/
│   ├── auth/                    # Authentication pages
│   │   ├── login/
│   │   ├── sign-up/
│   │   ├── callback/            # Email verification callback
│   │   └── error/
│   ├── dashboard/               # Protected dashboard
│   │   ├── farms/               # Farm management
│   │   ├── cycles/              # Production cycles
│   │   ├── inventory/           # Inventory management
│   │   ├── analytics/           # Analytics dashboard
│   │   ├── team/                # Team management
│   │   └── settings/            # Organization settings
│   ├── api/                     # API routes
│   │   └── operations/
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home page
│   └── providers.tsx            # Context providers
├── components/
│   ├── dashboard/               # Dashboard components
│   └── ui/                      # shadcn UI components
├── features/
│   └── auth-access/             # Auth context and hooks
├── hooks/                       # Custom React hooks
│   ├── use-auth.ts
│   └── use-organization.ts
├── lib/
│   ├── supabase/                # Supabase clients
│   ├── i18n/                    # Internationalization
│   ├── config/                  # Configuration
│   └── utils.ts
├── supabase/
│   └── migrations/              # Database migrations
├── docs/                        # Documentation
└── middleware.ts                # Next.js middleware for auth
```

## Key Features

### Authentication
- Email + password authentication
- Email verification required
- Password reset via email link
- Session management with Supabase Auth
- Protected routes

### Multi-tenancy
- Organization-based data scoping
- Role-based access control
- User organization membership
- Automatic profile creation on signup

### Internationalization
- English and Arabic support
- RTL/LTR layout switching
- Language toggle in user menu
- All UI strings translated

### Operations Management
- Farm management (CRUD)
- Production cycles tracking (placeholder)
- Inventory management (placeholder)
- Analytics dashboard (placeholder)
- Team management (placeholder)

### Security
- Row Level Security (RLS) on all tables
- Organization-scoped data isolation
- Email verification before access
- Secure session management
- No hardcoded credentials

## Environment Variables

```env
# Supabase (provided by v0 integration)
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_[key]

# For local Supabase development (optional)
# NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback
```

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
4. Deploy!

### Deploy to Other Platforms

The app runs on any Node.js 18+ compatible platform:
- Netlify
- Heroku
- AWS
- DigitalOcean
- etc.

Ensure environment variables are set correctly on deployment.

## API Routes

### Farms Management
- `GET /api/operations/farms` - List farms
- `POST /api/operations/farms` - Create farm
- `GET /api/operations/farms/[id]` - Get farm details
- `PUT /api/operations/farms/[id]` - Update farm
- `DELETE /api/operations/farms/[id]` - Delete farm

All routes require authentication and enforce RLS.

## Testing

### Test Scenarios

1. **Sign Up Flow**
   - Create new account
   - Verify email
   - Auto-profile creation verified

2. **Sign In/Out**
   - Sign in with credentials
   - Verify session persistence
   - Test sign out

3. **Organization Access**
   - Organization loads in sidebar
   - User can access farms

4. **Multi-language**
   - Toggle between English/Arabic
   - RTL layout applies
   - All strings translated

5. **Data Security**
   - Try accessing other users' data (should fail)
   - Try accessing farms without organization membership (should fail)

### Manual Testing

```bash
# Test with curl
curl -H "Authorization: Bearer [token]" \
  https://localhost:3000/api/operations/farms

# Test RLS (should fail without auth)
curl https://localhost:3000/api/operations/farms
```

## Troubleshooting

### "Supabase environment variables missing"
- Check .env.local has `NEXT_PUBLIC_SUPABASE_URL` and key
- Restart dev server after adding environment variables

### "Email verification required"
- Check your email inbox for verification link
- If not received, check Supabase email settings
- For local development, verify manually in Supabase dashboard

### "Authentication not working"
- Ensure /auth/callback route exists
- Check Supabase auth configuration
- Verify redirect URL matches your domain

### "Organization not showing"
- Ensure organization exists and user is member
- Check user_organization_members table
- Verify RLS policies are enabled

## Documentation

- [Implementation Status](./docs/IMPLEMENTATION_STATUS.md)
- [Environment Strategy](./docs/ENVIRONMENT_STRATEGY.md)
- [Auth Strategy](./docs/AUTH_STRATEGY.md)
- [RLS Strategy](./docs/RLS_STRATEGY.md)
- [Data Models](./docs/DATA_MODEL_AUTH_ACCESS.md)

## Stack

- **Frontend:** Next.js 16, React 19, TypeScript
- **Authentication:** Supabase Auth
- **Database:** PostgreSQL (Supabase)
- **UI Framework:** shadcn/ui, Tailwind CSS
- **Internationalization:** Custom i18n context
- **Deployment:** Vercel

## License

Proprietary - Ministry of Social Development & Family, Qatar

## Support

For issues, questions, or contributions, contact the development team or open an issue in the repository.

---

**Last Updated:** April 9, 2026  
**Version:** 0.1.0  
**Status:** Active Development
