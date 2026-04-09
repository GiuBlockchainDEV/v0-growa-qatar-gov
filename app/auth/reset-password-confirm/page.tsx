'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/browser';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function ResetPasswordConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const supabase = createBrowserClient();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasToken, setHasToken] = useState(true);

  useEffect(() => {
    // Check if we have the auth token from the reset link
    const hash = window.location.hash;
    if (!hash.includes('access_token')) {
      setHasToken(false);
      setMessage({
        type: 'error',
        text: 'Invalid or expired password reset link. Please request a new one.',
      });
    }
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage({
        type: 'error',
        text: 'Passwords do not match',
      });
      return;
    }

    if (password.length < 8) {
      setMessage({
        type: 'error',
        text: 'Password must be at least 8 characters long',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMessage({
          type: 'error',
          text: error.message || 'Failed to reset password',
        });
      } else {
        setMessage({
          type: 'success',
          text: 'Password reset successfully!',
        });
        // Redirect to sign-in after success
        setTimeout(() => router.push('/auth/sign-in'), 2000);
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: 'An unexpected error occurred',
      });
      console.error('[v0] Password confirmation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-12 ${locale === 'ar' ? 'rtl' : 'ltr'}`}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link href="/auth/sign-in" className="inline-flex items-center text-sm text-primary hover:text-primary/80 mb-4">
            ← {t('common.back')}
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">Set New Password</h1>
          <p className="text-sm text-muted-foreground">Enter your new password below</p>
        </div>

        {/* Main Card */}
        <Card className="p-8 shadow-lg">
          {!hasToken ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">{t('common.error')}</p>
              <Link href="/auth/reset-password">
                <Button variant="outline" className="w-full">
                  Request New Reset Link
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              {/* New Password Input */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                  New Password
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
                <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters</p>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full"
                />
              </div>

              {/* Message */}
              {message && (
                <div className={`p-4 rounded-lg ${
                  message.type === 'success'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-destructive/10 border border-destructive'
                }`}>
                  <p className={`text-sm font-medium ${
                    message.type === 'success'
                      ? 'text-green-800'
                      : 'text-destructive'
                  }`}>
                    {message.text}
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || !password || !confirmPassword}
                className="w-full h-10 font-medium"
              >
                {loading ? t('common.loading') : 'Reset Password'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
