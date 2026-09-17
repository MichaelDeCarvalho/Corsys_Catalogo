# PROJECT CONTEXT - CORSYS CATÁLOGO B2B / B2C

## 1. Visão Geral do Projeto
- **Nome:** Corsys Catálogo Multi-tenant B2B / B2C
- **Cliente / Catálogo Oficial:** MC Distribuição
- **Tenant Principal Demo:** `corsys-catalogo-demo` (Slug canônico pré-existente)
- **Data da Importação Oficial:** 2026-09-03 / 2026-09-04
- **Ambiente de Banco:** Supabase PostgreSQL V2 com RLS Rigoroso e Multi-tenancy Nativo

## 2. Configurações Públicas Reais do Tenant (Etapa 5A.1)
- **Nome Público (`public_name`):** `Corsys.Catálogo`
- **WhatsApp Oficial (`whatsapp_number`):** `+5541992928033` (normalizado)
- **Modo B2B (`allow_b2b_mode`):** `true` (habilitado para atacado)
- **Visibilidade de Preços (`hide_prices_without_login`):** `false` (preços visíveis publicamente sem login)
- **Pedido Mínimo Varejo (`min_order_value`):** `R$ 400,00`
- **Pedido Mínimo Atacado (`wholesale_min_order_value`):** `R$ 1.000,00` (nova coluna adicionada ao schema)
- **Métodos de Entrega (`delivery_methods`):** `["retirada", "entrega", "uber", "transportadora", "outro"]`
- **Identidade Visual:**
  - `logo_url`: `NULL` (ainda não definido)
  - `banner_url`: `NULL` (ainda não definido)
  - `primary_color`: `#0F172A`
  - `accent_color`: `#FF5A00`
- **Paleta Visual Completa Aprovada (para aplicação no Frontend na Etapa 5B):**
  - `--primary-dark`: `#0F172A`
  - `--primary-accent`: `#FF5A00`
  - `--cta-text`: `#FFFFFF`
  - `--bg-main`: `#F8FAFC`
  - `--bg-card`: `#FFFFFF`
  - `--border-color`: `#E2E8F0`
  - `--cta-hover`: `#D94E00`
  - `--success`: `#16A34A`
  - `--text-muted`: `#475569`

## 3. Inventário do Catálogo Oficial
- **Arquivo Canônico Limpo:** `data/imports/catalogo_oficial_20260903.csv` (Exatamente 7 colunas, 520 produtos)
- **Total de Produtos Oficiais Únicos:** 520 produtos
- **Total de SKUs Duplicados na Entrada Bruta Desconsiderados:** 112 linhas repetidas (duplicatas idênticas de cauda do bloco CU002 a CH006)
- **Produtos com Atacado Nulo ('-'):** 21 produtos (convertidos para `wholesale_price = NULL`)
- **Estoque Principal Importado:** 100% fiel à fonte oficial
- **Campos Especiais e Metadados:**
  - `brand = NULL` (não inventado)
  - `technical_specs = '{}'::jsonb` (sem dados não oficiais)
  - `unit = 'un'`
  - `min_order_quantity = 1`
  - `images = ARRAY[]::TEXT[]` (sem mocks ou URLs inventadas)
  - `featured = false`, `is_new = false`, `active = true`, `sort_order = 0`
- **Wholesale Tiers:** Nenhuma tier fictícia gerada (respeito estrito ao escopo)

## 4. Estado das Migrations (Congeladas em Produção)
- `supabase/migrations/20260902_000001_initial_schema.sql`: **APLICADA / CONGELADA**.
- `supabase/migrations/20260903_000002_import_official_catalog.sql`: **APLICADA / CONGELADA** (bootstrap de 520 produtos).
- `supabase/migrations/20260904_000003_public_catalog_settings.sql`: **APLICADA / CONGELADA** (configurações públicas e pedido mínimo atacado).
- `supabase/migrations/20260905_000004_wholesale_item_rules.sql`: **APLICADA / CONGELADA** (regras de atacado por item e view pública sanitizada via DROP/CREATE).
- `supabase/migrations/20260907_000005_b2b_wholesale_access.sql`: **APLICADA / CONGELADA** (credenciamento B2B, tabela wholesale_customers, RPCs com fail-closed).
- `supabase/migrations/20260909_000006_branding_storage.sql`: **APLICADA / CONGELADA** (policies de autorização e menor privilégio para bucket tenant-assets).
- `supabase/migrations/20260910_000007_reconcile_b2b_catalog_security.sql`: **APLICADA / CONGELADA** (forward-fix de reconciliação determinística de catalog_products e fail-closed B2B).

*Regra de Ouro: Migrations 000001 a 000007 estão estritamente congeladas. Qualquer evolução posterior de schema exigirá 000008+.*

## 5. Próxima Etapa Oficial
- **PRODUCT MEDIA STORAGE**:
  - Infraestrutura dedicada para armazenamento de imagens reais de produtos (diferenciada do bucket `tenant-assets` de branding da loja).
  - Primeiro passo: upload e gestão individual de fotos no `ProductEditModal`.
  - Segundo passo: importação e associação de imagens em massa reutilizando a mesma infraestrutura.
