'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './use-auth';
import { createClient } from '@/lib/supabase/browser';

interface Organization {
  id: string;
  name: string;
  country_id: string;
}

export function useOrganization() {
  const { user, loading: authLoading } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    const fetchOrganization = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();

        // Get user's membership to find organization
        const { data: membership, error: membershipError } = await supabase
          .from('memberships')
          .select('organization_id')
          .eq('user_id', user.id)
          .single();

        if (membershipError || !membership) {
          setError('No organization found');
          setLoading(false);
          return;
        }

        // Fetch organization details
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', membership.organization_id)
          .single();

        if (orgError) {
          setError(orgError.message);
        } else {
          setOrganization(org);
        }
      } catch (err) {
        console.error('[v0] Error fetching organization:', err);
        setError('Failed to fetch organization');
      } finally {
        setLoading(false);
      }
    };

    fetchOrganization();
  }, [user, authLoading]);

  return { organization, loading, error };
}
