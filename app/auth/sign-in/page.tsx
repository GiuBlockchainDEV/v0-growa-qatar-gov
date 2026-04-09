'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/browser';
import { useAuth } from '@/hooks/use-auth';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function SignInPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t, locale } = useI18n();
  const supabase = createBrowserClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Redirect if already logged in
  if (!authLoading && user) {
    router.push('/dashboard');
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setFailedAttempts((prev) => prev + 1);
        setError(signInError.message);
        console.error('[v0] Sign-in error:', signInError);
      } else {
        // Success - will redirect via useEffect
        router.push('/dashboard');
      }
    } catch (err) {
      setFailedAttempts((prev) => prev + 1);
      setError('An unexpected error occurred');
      console.error('[v0] Unexpected sign-in error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-12 ${locale === 'ar' ? 'rtl' : 'ltr'}`}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Growa Qatar</h1>
          <p className="text-sm text-muted-foreground">{t('auth.sign_in_subtitle')}</p>
        </div>

        {/* Main Card */}
        <Card className="p-8 shadow-lg">
          <form onSubmit={handleSignIn} className="space-y-6">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                {t('auth.email')}
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@organization.qa"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full"
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                {t('auth.password')}
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
                <p className="text-sm text-destructive font-medium">{error}</p>
                {failedAttempts > 0 && (
                  <p className="text-xs text-destructive/80 mt-1">
                    {t('auth.failed_attempts')}: {failedAttempts}
                  </p>
                )}
              </div>
            )}

            {/* Sign In Button */}
            <Button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-10 font-medium"
            >
              {loading ? t('common.loading') : t('auth.sign_in')}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-muted-foreground/20"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">{t('common.or')}</span>
            </div>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <Link
              href="/auth/reset-password"
              className="flex items-center justify-center text-sm text-primary hover:text-primary/80 underline transition-colors"
            >
              {t('auth.forgot_password')}
            </Link>
            <Link
              href="/auth/accept-invitation"
              className="flex items-center justify-center text-sm text-primary hover:text-primary/80 underline transition-colors"
            >
              {t('auth.have_invitation')}
            </Link>
          </div>
        </Card>

        {/* Footer Note */}
        <p className="text-xs text-muted-foreground text-center mt-6">
          {t('auth.no_account_contact_admin')}
        </p>
      </div>
    </div>
  );
}
