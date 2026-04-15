-- Enforce one pending invite request per user and allow requester deletions.

-- Keep only the newest pending request per requester before adding the unique index.
WITH ranked_pending AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY requester_user_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.organization_invite_requests
  WHERE status = 'pending'
)
UPDATE public.organization_invite_requests req
SET
  status = 'cancelled',
  updated_at = NOW()
FROM ranked_pending rp
WHERE req.id = rp.id
  AND rp.rn > 1;

-- One pending request at a time for each requester.
CREATE UNIQUE INDEX IF NOT EXISTS org_invite_requests_one_pending_per_user_idx
  ON public.organization_invite_requests(requester_user_id)
  WHERE status = 'pending';

-- Requester can delete own requests.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organization_invite_requests'
      AND policyname = 'org_invite_requests_delete_own'
  ) THEN
    CREATE POLICY "org_invite_requests_delete_own"
      ON public.organization_invite_requests
      FOR DELETE
      USING (auth.uid() = requester_user_id);
  END IF;
END
$$;
