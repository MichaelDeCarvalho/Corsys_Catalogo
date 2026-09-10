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

## 4. Regras de Itens e Mínimos de Atacado (Migration 000004)
- **Campos Estruturados em `public.products`:**
  - `wholesale_enabled BOOLEAN NOT NULL DEFAULT false`
  - `wholesale_min_quantity INTEGER`
- **Constraints de Integridade:**
  - `chk_products_wholesale_enabled_rules`: `wholesale_enabled = true` exige `wholesale_price IS NOT NULL` e `wholesale_min_quantity >= 1`; `wholesale_enabled = false` força `wholesale_min_quantity IS NULL`.
- **View Pública (`public.catalog_products`):**
  - Oculta `wholesale_price`, `wholesale_min_quantity`, `wholesale_enabled` e `cost_price` de consultas anônimas.

## 5. Arquitetura de Acesso B2B e Credenciamento (Migration 000005)
- **Tabela `public.wholesale_customers`:**
  - Segregação de compradores B2B com `UNIQUE(tenant_id, cnpj)` e status (`pending`, `approved`, `rejected`, `suspended`).
  - Zero privilégios de escrita para `PUBLIC`, `anon` e `authenticated`.
  - `service_role` com privilégios colunares restritivos (Least Privilege).
  - Sem privilégio de `DELETE` no sistema.
- **RPCs Sanitizadas (`SECURITY DEFINER` com `SET search_path = ''`):**
  - `public.get_wholesale_catalog(p_tenant_slug)`: Acesso estritamente autenticado e aprovado.
  - `public.get_my_wholesale_status(p_tenant_slug)`: Consulta de estado de credenciamento.

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

