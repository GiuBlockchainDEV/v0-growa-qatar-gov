# Supabase Auth Configuration

## Step 2.1: Email+Password Auth Setup for Growa Qatar

This document outlines the Supabase Auth configuration for Growa Qatar, focusing on invitation-only email+password authentication.

## Configuration Overview

### Enabled Providers

| Provider | Status | Reason |
|----------|--------|--------|
| Email+Password | ✅ Required | Primary authentication method |
| Anonymous | ❌ Disabled | Closed platform - no public access |
| OAuth (Google, GitHub, etc) | Future | SSO roadmap (Phase 2.X) |

### Email Configuration

**Email Verification**
- Status: Required
- Verification link expiry: 24 hours
- Resend cooldown: 15 seconds
- Confirmation required before access

**Password Reset**
- Enabled via email link
- Link expiry: 1 hour
- New password set via reset link

### Auth Policies

1. **No Public Signup**: Accounts created only via invitation
2. **Email-Only Login**: Username login disabled
3. **Session Duration**: 24-hour sessions with automatic refresh
4. **Rate Limiting**: 5 failed login attempts = 15-minute lockout

## Redirect URLs Configuration

Configure these in Supabase > Project Settings > Auth > Redirect URLs:

### Local Development
```
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset-password
http://localhost:3000/auth/verify
```

### Staging
```
https://growa-qatar-staging.vercel.app/auth/callback
https://growa-qatar-staging.vercel.app/auth/reset-password
https://growa-qatar-staging.vercel.app/auth/verify
```

### Production
```
https://growa-qatar.gov.qa/auth/callback
https://growa-qatar.gov.qa/auth/reset-password
https://growa-qatar.gov.qa/auth/verify
```

## Environment Variables

Set in Vercel project settings (Vars tab):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyxx...
SUPABASE_SERVICE_ROLE_KEY=eyxx...
```

Never expose SERVICE_ROLE_KEY in client code.

## Email Templates

Customize in Supabase > Authentication > Email Templates:

### Confirmation Email
- Subject: "Confirm your email for Growa Qatar"
- Body: Include Qatar-specific branding and bilingual support

### Reset Password Email
- Subject: "Reset your Growa Qatar password"
- Body: Include security notice about password reset

### Invite Link Email
- Subject: "You're invited to Growa Qatar"
- Body: Handled by custom Edge Function (see Step 2.X)

## Security Considerations

- [ ] All auth endpoints use HTTPS only
- [ ] Passwords meet minimum 8-character requirement
- [ ] Email verification enforced before session creation
- [ ] Failed login attempts logged for audit
- [ ] Account lockout after 5 failed attempts
- [ ] No password hints or recovery questions

## Testing Auth Locally

```bash
# Start Supabase
supabase start

# View auth emails in logs
supabase logs auth --follow

# Test signup endpoint
curl -X POST http://localhost:54321/auth/v1/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456!"
  }'
```

## Next Steps

- [x] Step 2.1: Configure Auth providers
- [ ] Step 2.2: Implement Sign In page
- [ ] Step 2.3: Implement Password Reset flow
- [ ] Step 2.4: Implement Invitation acceptance
- [ ] Step 2.5: Implement Profile management
