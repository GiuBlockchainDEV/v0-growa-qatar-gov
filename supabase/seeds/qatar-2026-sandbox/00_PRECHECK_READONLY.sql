-- NFII Qatar synthetic sandbox preflight: READ ONLY.
-- Run in Supabase SQL Editor BEFORE running either seed.
-- No inserts, updates, deletes or DDL.
-- "READY FOR AUTO-SELECTION" requires one NFII named sandbox and exactly TWO active members.

WITH selected_orgs AS (
  SELECT o.id, o.name FROM public.organizations o
  WHERE o.name ~* 'nfii' AND o.name ~* '(sandbox|demo|simulation)'
), eligible AS (
  SELECT o.id AS organization_id, o.name, count(m.user_id) AS active_members,
    (SELECT u.user_id FROM public.user_organization_members u
      WHERE u.organization_id=o.id AND u.status='active'
      ORDER BY u.user_id ASC LIMIT 1) AS proposed_creator_id,
    (SELECT u.user_id FROM public.user_organization_members u
      WHERE u.organization_id=o.id AND u.status='active'
      ORDER BY u.user_id DESC LIMIT 1) AS proposed_reviewer_id,
    (SELECT count(*) FROM selected_orgs) AS candidate_organizations
  FROM selected_orgs o
  LEFT JOIN public.user_organization_members m
    ON m.organization_id=o.id AND m.status='active'
  GROUP BY o.id, o.name
)
SELECT organization_id, name, active_members,
  proposed_creator_id, proposed_reviewer_id, candidate_organizations,
  CASE WHEN candidate_organizations=1 AND active_members=2
    THEN 'READY FOR AUTO-SELECTION'
    ELSE 'STOP - create or explicitly select an NFII sandbox and active test users'
  END AS readiness
FROM eligible ORDER BY name;
