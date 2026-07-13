-- Verrouillage PostgREST : retirer l'accès Data API aux tables Prisma (schéma public).
-- Contexte : l'app mobile n'utilise JAMAIS PostgREST pour les tables — uniquement
-- l'API NestJS + Supabase Auth/Storage. Les tables public n'ont pas de RLS ;
-- avec la clé anon embarquée, PostgREST les exposait sans filet.
-- Ne touche PAS aux schémas storage ni auth.
-- Idempotent : REVOKE / ALTER DEFAULT PRIVILEGES sont rejouables sans erreur.

-- ── Tables et séquences existantes ───────────────────────────────────────────

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- ── Futures tables / séquences (Prisma, SQL Editor, etc.) ────────────────────
-- Les default privileges Supabase accordent sinon SELECT/INSERT/... à anon
-- et authenticated dès la création. On les retire pour le rôle postgres
-- (connexion Prisma / migrations) et pour le rôle courant de la migration.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- ── Helpers Storage (20260607140000_storage_rls_hardening.sql) ───────────────
-- public.auth_user_has_farm_storage_access est SECURITY DEFINER : le corps
-- s'exécute avec les droits du propriétaire de la fonction (pas du rôle
-- appelant authenticated). Un REVOKE sur les tables pour anon/authenticated
-- n'empêche donc PAS cette fonction de lire "User", "Farm", "FarmMembership".
-- public.storage_farm_id_from_path est IMMUTABLE et ne lit aucune table : elle
-- parse uniquement le chemin objet Storage — inchangée par ce verrouillage.
--
-- Les politiques RLS storage appellent ces fonctions en tant que authenticated :
-- on conserve EXECUTE (GRANT minimal, idempotent). Si le propriétaire de
-- auth_user_has_farm_storage_access n'est pas postgres, on lui accorde le
-- SELECT minimal sur les 3 tables lues par le corps SECURITY DEFINER.

GRANT EXECUTE ON FUNCTION public.storage_farm_id_from_path(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_has_farm_storage_access(text) TO authenticated;

DO $$
DECLARE
  fn_owner text;
BEGIN
  SELECT pg_catalog.pg_get_userbyid(p.proowner)
  INTO fn_owner
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'auth_user_has_farm_storage_access'
  ORDER BY p.oid
  LIMIT 1;

  IF fn_owner IS NOT NULL AND fn_owner IS DISTINCT FROM 'postgres' THEN
    EXECUTE format(
      'GRANT SELECT ON TABLE public."User", public."Farm", public."FarmMembership" TO %I',
      fn_owner
    );
  END IF;
END $$;
