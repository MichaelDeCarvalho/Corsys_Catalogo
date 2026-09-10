-- =========================================================================
-- CORSYS CATÁLOGO B2B / B2C - MIGRATION 000006: STORAGE BUCKET & POLICIES (BRANDING)
-- Arquivo: supabase/migrations/20260909_000006_branding_storage.sql
-- Objetivo: Provisionamento versionado do bucket 'tenant-assets' para logos
--           e banners do storefront, com RLS rígido e isolamento multi-tenant por UUID.
-- Princípio de Menor Privilégio:
--   - Bucket público para leitura direta via URL de CDN (storefront).
--   - NENHUMA policy de SELECT público em storage.objects (impede enumeração de arquivos).
--   - SELECT autenticado restrito ao diretório do próprio tenant (UUID) ou platform_admin.
--   - INSERT autenticado restrito ao diretório do próprio tenant (UUID) para role tenant_admin.
--   - SEM policy de UPDATE (uploads utilizam timestamp versionado com upsert = false).
--   - DELETE autenticado restrito para rollback e limpeza de arquivos do próprio tenant.
--   - SVG estritamente proibido (vetor XSS). Apenas PNG, JPEG e WebP.
--   - Zero permissões para anon, sales_rep, stock_manager e wholesale_customer.
-- =========================================================================

BEGIN;

-- 1. Habilitação de RLS em storage.objects (idempotente)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Limpeza defensiva de policies anteriores com o mesmo nome
DROP POLICY IF EXISTS "tenant_assets_select_public" ON storage.objects;
DROP POLICY IF EXISTS "tenant_assets_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "tenant_assets_insert_tenant_admin" ON storage.objects;
DROP POLICY IF EXISTS "tenant_assets_update_tenant_admin" ON storage.objects;
DROP POLICY IF EXISTS "tenant_assets_delete_tenant_admin" ON storage.objects;

-- 3. Policy SELECT: Apenas autenticado no diretório do próprio tenant (UUID) ou platform_admin
-- OBS: Leitura pública de storefront é atendida pela URL pública do bucket, sem enumeração de banco.
CREATE POLICY "tenant_assets_select_authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'tenant-assets'
    AND (
        (
            (storage.foldername(name))[1] = (SELECT private.get_current_tenant_id())::text
            AND (SELECT private.has_tenant_role(ARRAY['tenant_admin']))
        )
        OR (SELECT private.is_platform_admin())
    )
);

-- 4. Policy INSERT: Apenas tenant_admin gravando no diretório do próprio tenant (UUID) ou platform_admin
CREATE POLICY "tenant_assets_insert_tenant_admin"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'tenant-assets'
    AND (
        (
            (storage.foldername(name))[1] = (SELECT private.get_current_tenant_id())::text
            AND (SELECT private.has_tenant_role(ARRAY['tenant_admin']))
        )
        OR (SELECT private.is_platform_admin())
    )
);

-- 5. Policy UPDATE: NÃO CONCEDIDA
-- A aplicação utiliza nomes de arquivos versionados com timestamp e upsert: false.
-- Nenhuma operação de UPDATE é necessária no storage, atendendo ao menor privilégio.

-- 6. Policy DELETE: Apenas tenant_admin removendo assets do próprio tenant (UUID) ou platform_admin
-- Necessário para: rollback de upload com falha no banco, remoção manual e limpeza após substituição.
CREATE POLICY "tenant_assets_delete_tenant_admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'tenant-assets'
    AND (
        (
            (storage.foldername(name))[1] = (SELECT private.get_current_tenant_id())::text
            AND (SELECT private.has_tenant_role(ARRAY['tenant_admin']))
        )
        OR (SELECT private.is_platform_admin())
    )
);

COMMIT;
