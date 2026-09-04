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

## 4. Design System e Paleta Visual (Aprovada para Etapa 5B)
A paleta completa foi homologada para aplicação nas folhas de estilo e componentes do frontend na Etapa 5B:
- `--primary-dark`: `#0F172A`
- `--primary-accent`: `#FF5A00`
- `--cta-text`: `#FFFFFF`
- `--bg-main`: `#F8FAFC`
- `--bg-card`: `#FFFFFF`
- `--border-color`: `#E2E8F0`
- `--cta-hover`: `#D94E00`
- `--success`: `#16A34A`
- `--text-muted`: `#475569`

## 5. Frontend & Runtime
- O frontend em React 18 + Vite continua intacto e desacoplado nesta fase.
- A Etapa 5B conectará o catálogo e as configurações públicas do Supabase diretamente à interface do usuário.
