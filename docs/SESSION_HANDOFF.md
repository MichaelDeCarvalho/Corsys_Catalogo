# SESSION HANDOFF - ETAPA B2B MIGRATIONS 000004 & 000005 CONCLUÍDA

## 1. O Que Foi Realizado na Etapa B2B
- **Migration 000004 (`wholesale_item_rules.sql`):**
  - Campos `wholesale_enabled` e `wholesale_min_quantity` adicionados a `public.products`.
  - Constraint atômica `chk_products_wholesale_enabled_rules`.
  - View pública `public.catalog_products` sanitizada (sem colunas de atacado ou custo para anon).
  - Regra de incremento unitário (0 -> mín -> mín+1 -> mín+2) sem múltiplos forçados.
- **Migration 000005 (`b2b_wholesale_access.sql`):**
  - Tabela `public.wholesale_customers` com RLS estrito (deny-by-default).
  - Concessões colunares restritivas para `service_role` (Least Privilege Auditado).
  - Nenhuma concessão de `DELETE` no sistema.
  - RPCs `public.get_wholesale_catalog` e `public.get_my_wholesale_status` com `SECURITY DEFINER` e `SET search_path = ''`.
- **Frontend & UX de Troca de Modo:**
  - `B2BSwitchModeConfirmModal` com proteção explícita contra expurgo de carrinho.
  - Contextos `AppContext` e `WholesaleAccessContext` integrados.
- **Auditoria de Segurança:**
  - Zero exposição de chaves privadas ou service_role no client.
  - Zero bypass de RLS.

## 2. Status das Migrations
- `supabase/migrations/20260902_000001_initial_schema.sql`: **CONGELADA E APLICADA**.
- `supabase/migrations/20260903_000002_import_official_catalog.sql`: **CONGELADA E APLICADA**.
- `supabase/migrations/20260904_000003_public_catalog_settings.sql`: **CONGELADA E APLICADA**.
- `supabase/migrations/20260905_000004_wholesale_item_rules.sql`: **CORRIGIDA NO WORKSPACE** (Recriação determinística com DROP VIEW IF EXISTS para resolução do erro 42P16; aguardando próximo deploy via GitHub integration no Supabase Hosted).
- `supabase/migrations/20260907_000005_b2b_wholesale_access.sql`: **CORRIGIDA NO WORKSPACE** (Recriação determinística com DROP VIEW IF EXISTS, policies replay-safe e Fail-Closed B2B COALESCE(s.allow_b2b_mode, false); aguardando próximo deploy via GitHub integration no Supabase Hosted).
- `supabase/migrations/20260909_000006_branding_storage.sql`: **PREPARADA NO WORKSPACE** (Policies de storage.objects com menor privilégio; aguardando próximo deploy via GitHub integration no Supabase Hosted).
- `supabase/migrations/20260910_000007_reconcile_b2b_catalog_security.sql`: **CRIADA NO WORKSPACE** (Forward-fix oficial para produção: reconciliação determinística de catalog_products, get_wholesale_catalog fail-closed e grants estritos de anon).

## 3. Estado do Storage de Branding (`tenant-assets`)
- **Configuração (`supabase/config.toml`):** Bucket `tenant-assets` público (CDN via `getPublicUrl`), 5 MB limite, MIME restrito a `image/png`, `image/jpeg`, `image/webp` (SVG expressamente bloqueado).
- **Policies (`20260909_000006_branding_storage.sql`):**
  - RLS em `storage.objects` com Menor Privilégio.
  - SELECT autenticado restrito ao diretório `<tenant_uuid>` ou platform_admin (exigido por `storage.remove()`). Sem SELECT público em banco.
  - INSERT e DELETE restritos a `tenant_admin` do próprio tenant ou platform_admin.
  - Sem policy de UPDATE (uploads versionados por timestamp e `upsert: false`).
- **Segurança e Consistência:**
  - Validação profunda com Magic Bytes binários no client para prevenção de spoofing e XSS.
  - Validação de UUID canônico v4 Fail-Closed em todas as rotas e remoções (`extractOwnedBrandingPath`).
  - Consistência por compensação (rollback de logo/banner se banco ou upload falhar).
  - Trava de concorrência (`isBusy`) e ciclo de vida de Object URLs (`URL.revokeObjectURL`).
- **Suíte de Testes:** 35/35 testes aprovados (`scripts/test-branding-storage-points.ts`).

## 4. Estado das Edge Functions
- `supabase/functions/submit-wholesale-application/index.ts`: Configurada (`verify_jwt = false`), auditada e testada no fluxo E2E B2B.
- `supabase/functions/manage-wholesale-customer/index.ts`: Configurada (`verify_jwt = true`), auditada e testada no fluxo E2E B2B.

## 4. Próximos Passos
- Monitoramento contínuo das solicitações B2B no painel administrativo.
- Sincronização e publicação conforme pipelines do projeto.

