# CURRENT ARCHITECTURE - CORSYS MULTI-TENANT

## 1. Arquitetura de Banco e Multi-tenancy
- **Camada de Dados:** PostgreSQL hospedado no Supabase.
- **Isolamento Multi-tenant:** Chave `tenant_id` em todas as tabelas transacionais e cadastrais com RLS (`ROW LEVEL SECURITY`) habilitado e forçado.
- **Resolução de Tenants:** Canônica pelo campo `slug` em `public.tenants` (ex: `corsys-catalogo-demo`), propagada automaticamente para `public.tenant_public_settings` via triggers de sincronização.

## 2. Estrutura de Configurações Públicas (`public.tenant_public_settings`)
- **Evolução de Schema (Migration 000003):**
  - Coluna `wholesale_min_order_value NUMERIC(10,2)` adicionada para diferenciar o valor mínimo de pedido para atacado B2B do valor mínimo geral/varejo B2C (`min_order_value`).
  - Constraint: `chk_tenant_public_settings_wholesale_min_order` (`wholesale_min_order_value IS NULL OR wholesale_min_order_value >= 0.00`).
- **Valores Gravados para `corsys-catalogo-demo`:**
  - `public_name`: `Corsys.Catálogo`
  - `whatsapp_number`: `+5541992928033`
  - `min_order_value`: `400.00`
  - `wholesale_min_order_value`: `1000.00`
  - `allow_b2b_mode`: `true`
  - `hide_prices_without_login`: `false`
  - `delivery_methods`: `'["retirada","entrega","uber","transportadora","outro"]'::jsonb`
  - `primary_color`: `#0F172A`
  - `accent_color`: `#FF5A00`
  - `logo_url`: `NULL`
  - `banner_url`: `NULL`

## 3. Catálogo Oficial e Importação (Bootstrap 000002)
- **Pipeline de Ingestão:**
  1. Fonte bruta em CSV/texto.
  2. Armazenamento canônico em `data/imports/catalogo_oficial_20260903.csv` (exatamente 7 colunas e 520 produtos).
  3. Migration `supabase/migrations/20260903_000002_import_official_catalog.sql` autocontida com 520 tuplas literais em staging table.
  4. Validações fail-closed e INSERT direto em `public.products` (sem UPSERT).

## 4. Regras de Itens e Mínimos de Atacado (Migration 000004 & Reconciliação 000007)
- **Campos Estruturados em `public.products`:**
  - `wholesale_enabled BOOLEAN NOT NULL DEFAULT false`
  - `wholesale_min_quantity INTEGER`
- **Constraints de Integridade:**
  - `chk_products_wholesale_enabled_rules`: `wholesale_enabled = true` exige `wholesale_price IS NOT NULL` e `wholesale_min_quantity >= 1`; `wholesale_enabled = false` força `wholesale_min_quantity IS NULL`.
- **View Pública (`public.catalog_products`):**
  - Recriação determinística via `DROP VIEW IF EXISTS` + `CREATE VIEW WITH (security_invoker = true)`.
  - Oculta estritamente `wholesale_price`, `wholesale_min_quantity`, `wholesale_enabled` e `cost_price` de consultas anônimas e públicas.

## 5. Arquitetura de Acesso B2B e Credenciamento (Migrations 000005 & 000007)
- **Tabela `public.wholesale_customers`:**
  - Segregação de compradores B2B com `UNIQUE(tenant_id, cnpj)` e status (`pending`, `approved`, `rejected`, `suspended`).
  - RLS deny-by-default: zero privilégios de escrita para `PUBLIC`, `anon` e `authenticated`.
  - Policies replay-safe contra duplicação em rebuilds.
  - `service_role` com privilégios colunares restritivos (Least Privilege).
  - Sem privilégio de `DELETE` no sistema.
- **RPCs Sanitizadas (`SECURITY DEFINER` com `SET search_path = ''`):**
  - `public.get_wholesale_catalog(p_tenant_slug)`: Acesso estritamente autenticado e aprovado. Fail-closed total com `COALESCE(s.allow_b2b_mode, false)` (loja sem settings ou com allow_b2b_mode desabilitado bloqueia B2B).
  - `public.get_my_wholesale_status(p_tenant_slug)`: Consulta de estado de credenciamento.
  - `public.get_wholesale_catalog` com privilégios restritos a `authenticated` (`REVOKE ALL FROM PUBLIC, anon`).
- **Migration 000007 (Forward-Fix Oficial):**
  - Reconciliação determinística em produção de `catalog_products`, RPC `get_wholesale_catalog` fail-closed e grants de anon em `public.products`.

## 6. Estado das Edge Functions B2B
- `supabase/functions/submit-wholesale-application/index.ts`:
  - Configuração: `[functions.submit-wholesale-application]` com `verify_jwt = false`.
  - Validações: tenant por slug, tenant ativo, allow_b2b_mode, honeypot anti-spam, CNPJ módulo 11, duplicidade e status forçado = `pending`.
  - Status: Pronta, configurada e auditada no runtime B2B.
- `supabase/functions/manage-wholesale-customer/index.ts`:
  - Configuração: `[functions.manage-wholesale-customer]` com `verify_jwt = true`.
  - Validações: JWT bearer token, resolução do usuário no auth, autorização `tenant_admin` no mesmo `tenant_id`, convite Auth Admin com fail-closed e controle de transições (`approve`, `reject`, `suspend`, `reactivate`).
  - Status: Pronta, configurada e auditada no runtime B2B.

## 7. Design System e Paleta Visual
- `--primary-dark`: `#0F172A`
- `--primary-accent`: `#FF5A00`
- `--cta-text`: `#FFFFFF`
- `--bg-main`: `#F8FAFC`
- `--bg-card`: `#FFFFFF`
- `--border-color`: `#E2E8F0`
- `--cta-hover`: `#D94E00`
- `--success`: `#16A34A`
- `--text-muted`: `#475569`

## 8. Arquitetura de Storage para Branding (Migration 000006)
- **Bucket `tenant-assets`:**
  - Configuração: `public: true` (entrega pública de imagens via CDN do Supabase através de `getPublicUrl`), limite 5 MB (`5242880` bytes).
  - Tipos MIME permitidos: `image/png`, `image/jpeg`, `image/webp`.
  - Proibição estrita de SVG: `image/svg+xml` bloqueado tanto no frontend (MIME e Magic Bytes binários) quanto nas constraints do Storage (mitigação de XSS embutido).
- **Estrutura de Paths (Multi-tenancy Rígido):**
  - `<tenant_uuid>/branding/logo_<timestamp>.<ext>`
  - `<tenant_uuid>/branding/banner_<timestamp>.<ext>`
  - Fail-Closed: Validação estrita de UUID v4 (`isValidUUID`). Bloqueio total caso o tenantId seja slug, nome legado, vazio ou contenha path traversal.
- **Políticas RLS em `storage.objects` (Menor Privilégio):**
  - `tenant_assets_select_authenticated`: Restrito ao diretório do próprio tenant autenticado (`private.get_current_tenant_id()`) ou `platform_admin`. Necessário pois a API `storage.from().remove()` do Supabase exige privilégio de SELECT + DELETE. Nenhuma policy de enumeração pública em banco (anon não possui SELECT em `storage.objects`).
  - `tenant_assets_insert_tenant_admin`: Restrito a `tenant_admin` autenticado gravando no seu próprio diretório `<tenant_uuid>` ou `platform_admin`.
  - Sem policy de UPDATE: Menor privilégio. Todos os uploads são versionados por timestamp com `upsert: false`.
  - `tenant_assets_delete_tenant_admin`: Restrito a `tenant_admin` no seu próprio diretório `<tenant_uuid>` ou `platform_admin` para operações de rollback compensatório e limpeza de arquivos substituídos.
- **Consistência por Compensação (Sistemas Separados — Não ACID):**
  - Supabase Storage e PostgreSQL são subsistemas desacoplados sem suporte a transações distribuídas ACID. A integridade é garantida por fluxos compensáveis:
  - *Fluxo de Salvamento Simultâneo:*
    1. Upload do Logo no Storage (se selecionado).
    2. Upload do Banner no Storage (se selecionado). Se o banner falhar e o logo tiver sido enviado, executa rollback compensatório imediato apagando o novo logo do Storage.
    3. Atualização no banco de dados (`tenant_public_settings`). Se a gravação no banco falhar, executa rollback compensatório de ambos os novos objetos (logo e banner) no Storage, mantendo o banco intacto com os valores anteriores.
    4. Confirmação do banco: Atualiza estado da UI, revoga previews em memória (`URL.revokeObjectURL`) e realiza limpeza física das imagens substituídas no Storage.
  - *Fluxo de Remoção:*
    1. Atualização da coluna no banco para `NULL` primeiro.
    2. Atualização do estado da UI.
    3. Remoção física do objeto no Storage (se comprovadamente pertencente ao tenant).
- **Proteção contra Concorrência e Vazamento de Memória:**
  - Trava de concorrência (`isBusy = isSaving || isRemovingLogo || isRemovingBanner`): Bloqueio visual e disable em todos os botões de ação e inputs de arquivo durante mutações para impedir múltiplos uploads, duplos cliques e condições de corrida.
  - Gerenciamento de Object URLs: Execução obrigatória de `URL.revokeObjectURL(...)` ao trocar arquivo selecionado, ao remover preview, ao concluir salvamento e no unmount do componente via `useEffect`.
- **Exclusão Segura e Compatibilidade com URLs Legadas:**
  - Função `extractOwnedBrandingPath`: Antes de qualquer chamada a `storage.remove()`, valida que a URL antiga pertence estritamente ao bucket `tenant-assets` e começa exatamente com `<tenant_uuid>/branding/`.
  - Registros com URLs externas legadas (ex: `https://site-externo.com/logo.png`) ou de outros buckets são preservados sem tentativa de exclusão física, atualizando apenas o ponteiro no banco de dados (Fail-Closed).
- **Estado Real e Validação em Runtime (Supabase Hosted & Preview):**
  - Bucket `tenant-assets`: **EXISTE** e provisionado no Supabase Hosted (`public = true`, limite 5 MiB, MIME restrito a PNG, JPEG e WebP, SVG bloqueado).
  - Runtime via AI Studio Preview:
    - Logo upload: **PASS**
    - Logo reload e persistência: **PASS**
    - Banner upload: **PASS**
    - Banner reload e persistência: **PASS**
    - Substituição de assets: **PASS**
    - Remoção de assets: **PASS**
  - Validação de testes locais: 35/35 testes aprovados (`scripts/test-branding-storage-points.ts`), lint PASS, build PASS.
  - Teste Cross-tenant em runtime: **NOT TESTABLE IN CURRENT DATASET** (não declarar risco zero de forma cega; mitigado formalmente por RLS e validação de UUID no client).
- **Diferenciação Estrita de Domínio de Mídia:**
  - O bucket `tenant-assets` é destinado **exclusivamente ao branding da loja** (logo e banner do tenant).
  - Não armazena mídias de produto. O upload de imagens de produtos NÃO está implementado nesta etapa e fará parte de infraestrutura dedicada futura.

## 9. Governança de Migrations e Histórico
- **Migrations 000001 a 000007 Congeladas em Produção:**
  - `000001_initial_schema.sql`: APLICADA / CONGELADA
  - `000002_import_official_catalog.sql`: APLICADA / CONGELADA
  - `000003_public_catalog_settings.sql`: APLICADA / CONGELADA
  - `000004_wholesale_item_rules.sql`: APLICADA / CONGELADA
  - `000005_b2b_wholesale_access.sql`: APLICADA / CONGELADA
  - `000006_branding_storage.sql`: APLICADA / CONGELADA
  - `000007_reconcile_b2b_catalog_security.sql`: APLICADA / CONGELADA
  - *Nenhuma alteração é permitida nas migrations 000001–000007.*
- **Migration 000008 (Nova):**
  - `20260916_000008_product_media_storage.sql`: CRIADA NO WORKSPACE / AGUARDANDO DEPLOY

## 10. Arquitetura de Storage para Mídias de Produtos (Product Media Storage V1)
- **Status da Etapa:** **PRODUCT MEDIA STORAGE IMPLEMENTADO NO WORKSPACE AGUARDANDO DEPLOY**
- **Bucket `product-media`:**
  - Configuração em `supabase/config.toml`: `public = true`, `file_size_limit = "1MiB"`, `allowed_mime_types = ["image/png", "image/jpeg", "image/webp"]`.
  - SVG estritamente proibido (mitigação de XSS); GIF desabilitado nesta etapa.
- **Políticas RLS em `storage.objects` (Migration 000008 e Forward-Fix 000009):**
  - *Status:* **000008 aplicada no Supabase hosted; Forward-fix 000009 criado no workspace / aguardando deploy**.
  - **Bug identificado na 000008:** No banco real, dentro do subquery `EXISTS (SELECT 1 FROM public.products p ...)`, a chamada `storage.foldername(name)` sofreu shadowing pelo parser PostgreSQL, sendo resolvida como `storage.foldername(p.name)` (coluna `name` da tabela `products`).
  - **Correção Forward na 000009 (`20260917_000009_fix_product_media_policy_scope.sql`):**
    - Executa `DROP POLICY IF EXISTS` para as 3 policies de `product-media`.
    - Recria as policies qualificando explicitamente a referência da linha externa como `storage.foldername(storage.objects.name)`:
      `EXISTS (SELECT 1 FROM public.products p WHERE p.id::text = (storage.foldername(storage.objects.name))[3] AND p.tenant_id::text = (storage.foldername(storage.objects.name))[1])`.
    - Preserva rigorosamente as permissões de menor privilégio da 000008 sem nenhuma ampliação de privilégios.
    - `product_media_select_authenticated`: Restrito a `tenant_admin` no escopo do seu próprio tenant sob `/products/<product_id>` ou `platform_admin`, com produto existente e vinculado ao tenant.
    - `product_media_insert_tenant_admin`: Restrito a `tenant_admin` gravando sob `<tenant_uuid>/products/<product_uuid>` ou `platform_admin`, com produto existente e vinculado ao tenant.
    - `product_media_delete_tenant_admin`: Restrito a `tenant_admin` removendo sob `<tenant_uuid>/products/<product_uuid>` ou `platform_admin`, com produto existente e vinculado ao tenant.
    - Nenhuma policy de UPDATE (uploads versionados com `upsert: false`).
    - Nenhuma policy de SELECT público amplo em `storage.objects` (leitura pública consome CDN pública do bucket).
    - Sem DML direto em `storage.buckets` e sem `ALTER TABLE storage.objects`.
  - *Runtime de Product Media:* **Ainda aguarda validação em ambiente real após o deploy da migration 000009** (não declarar runtime PASS até confirmação do deploy da 000009).
- **Estrutura de Paths (Isolamento Multi-tenant & Multi-produto):**
  - `<tenant_uuid>/products/<product_uuid>/media_<timestamp>_<random>.<ext>`
  - Validação canônica estrita de UUID v4 para `tenant_id` e `product_id` (Fail-Closed).
- **Serviço Especializado (`src/services/productMediaStorageService.ts`):**
  - Inspeção binária de magic bytes para detecção real de PNG, JPEG e WebP.
  - Função `extractOwnedProductMediaPath` com fail-closed, rejeição de path traversal (`..`, `\`), esquemas perigosos (`blob:`, `data:`, `javascript:`) e URLs de outros tenants/produtos.
  - Rotinas compensatórias de rollback em caso de falha (`rollbackProductMediaUploads`, `removeProductMediaImage`).
- **Camada de Aplicação e Edição de Produtos (`src/components/tenantadmin/ProductEditModal.tsx`):**
  - Seção "Fotos do Produto" com upload múltiplo, preview local temporário (`URL.createObjectURL` com revogação garantida).
  - Zero uploads remotos ao selecionar arquivos ou ao cancelar o modal. Upload ocorre estritamente ao clicar em "Salvar Alterações".
  - Trava visual contra requisições concorrentes (`saving`).
  - Ordem determinística com a imagem do índice 0 atuando como destaque principal no catálogo.
  - Fluxo compensatório client-side: Validação -> Uploads -> Gravação em `public.products` -> Confirmação do Banco -> Remoção segura das mídias antigas desvinculadas.
- **Integração no Catálogo (`src/services/adminCatalogService.ts`):**
  - `AdminProductUpdatePayload` com campo `images?: string[]`.
  - Sanitização estrita HTTPS-Only: array de strings com `trim()`, sem vazios, sem duplicatas, aceitando exclusivamente URLs `https://` (legadas ou novas) e rejeitando qualquer esquema não-HTTPS (`http://`, `blob:`, `data:`, `javascript:`, `file:`, etc.).
- **Validação Automatizada:**
  - `scripts/test-product-media-storage-points.ts`: 78/78 testes aprovados.
  - `scripts/test-branding-storage-points.ts`: 35/35 testes aprovados (regressão zero).


