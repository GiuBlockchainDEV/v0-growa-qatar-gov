'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function AcceptInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();

  const inviteToken = searchParams.get('token') || '';
  const inviteEmail = searchParams.get('email') || '';

  const [formData, setFormData] = useState({
    firstName: '',
    firstNameAr: '',
    lastName: '',
    lastNameAr: '',
    email: inviteEmail,
    password: '',
    confirmPassword: '',
    phone: '',
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validate
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setMessage({
        type: 'error',
        text: 'Please fill in all required fields',
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setMessage({
        type: 'error',
        text: 'Passwords do not match',
      });
      return;
    }

    if (formData.password.length < 8) {
      setMessage({
        type: 'error',
        text: 'Password must be at least 8 characters long',
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/accept-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: inviteToken,
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          firstNameAr: formData.firstNameAr,
          lastName: formData.lastName,
          lastNameAr: formData.lastNameAr,
          phone: formData.phone || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to accept invitation',
        });
      } else {
        setMessage({
          type: 'success',
          text: 'Account created successfully! Redirecting to sign in...',
        });
        // Redirect to sign-in after success
        setTimeout(() => router.push('/auth/sign-in'), 2000);
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: 'An unexpected error occurred',
      });
      console.error('[v0] Accept invitation error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!inviteToken) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 py-12 ${locale === 'ar' ? 'rtl' : 'ltr'}`}>
        <Card className="p-8 max-w-md w-full text-center">
          <p className="text-sm text-muted-foreground mb-4">No invitation token provided</p>
          <Link href="/auth/sign-in">
            <Button className="w-full">{t('auth.sign_in')}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-12 ${locale === 'ar' ? 'rtl' : 'ltr'}`}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Create Your Account</h1>
          <p className="text-sm text-muted-foreground">Complete your profile to get started</p>
        </div>

        {/* Main Card */}
        <Card className="p-8 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Names Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  First Name (EN)
                </label>
                <Input
                  type="text"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  الاسم الأول (AR)
                </label>
                <Input
                  type="text"
                  placeholder="جون"
                  value={formData.firstNameAr}
                  onChange={(e) => setFormData({ ...formData, firstNameAr: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Last Name (EN)
                </label>
                <Input
                  type="text"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  اسم العائلة (AR)
                </label>
                <Input
                  type="text"
                  placeholder="دو"
                  value={formData.lastNameAr}
                  onChange={(e) => setFormData({ ...formData, lastNameAr: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email (read-only from invitation) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t('auth.email')}
              </label>
              <Input
                type="email"
                value={formData.email}
                disabled
                className="bg-muted cursor-not-allowed"
              />
            </div>

            {/* Phone (optional) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Phone (Optional)
              </label>
              <Input
                type="tel"
                placeholder="+974 1234 5678"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t('auth.password')}
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Confirm Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                disabled={loading}
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
              disabled={loading}
              className="w-full h-10 font-medium"
            >
              {loading ? t('common.loading') : 'Create Account & Accept'}
            </Button>
          </form>
        </Card>

        {/* Footer */}
        <p className="text-xs text-muted-foreground text-center mt-6">
          Already have an account?{' '}
          <Link href="/auth/sign-in" className="text-primary hover:text-primary/80 underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
