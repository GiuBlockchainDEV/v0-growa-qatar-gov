'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/browser';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function PasswordResetRequestPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const supabase = createBrowserClient();

  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password-confirm`,
      });

      if (error) {
        setMessage({
          type: 'error',
          text: error.message || 'Failed to send reset email',
        });
      } else {
        setMessage({
          type: 'success',
          text: 'Password reset link sent to your email. Please check your inbox.',
        });
        setEmail('');
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: 'An unexpected error occurred',
      });
      console.error('[v0] Password reset error:', err);
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
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('auth.resetPassword')}</h1>
          <p className="text-sm text-muted-foreground">Enter your email to receive a password reset link</p>
        </div>

        {/* Main Card */}
        <Card className="p-8 shadow-lg">
          <form onSubmit={handleRequestReset} className="space-y-6">
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
              disabled={loading || !email}
              className="w-full h-10 font-medium"
            >
              {loading ? t('common.loading') : 'Send Reset Link'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
