# PROJECT CONTEXT - CORSYS CATÁLOGO B2B / B2C

## 1. Visão Geral do Projeto
- **Nome:** Corsys Catálogo Multi-tenant B2B / B2C
- **Cliente / Catálogo Oficial:** MC Distribuição
- **Tenant Principal Demo:** `corsys-catalogo-demo` (Slug canônico pré-existente)
- **Data da Importação Oficial:** 2026-09-03
- **Ambiente de Banco:** Supabase PostgreSQL V2 com RLS Rigoroso e Multi-tenancy Nativo

## 2. Inventário do Catálogo Oficial
- **Arquivo Canônico Limpo:** `data/imports/catalogo_oficial_20260903.csv` (Exatamente 7 colunas, 520 produtos)
- **Migration Oficial Gerada:** `supabase/migrations/20260903_000002_import_official_catalog.sql`
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

## 3. Estado das Migrations
- `supabase/migrations/20260902_000001_initial_schema.sql`: **CONGELADA E INTOCADA** (760 linhas).
- `supabase/migrations/20260903_000002_import_official_catalog.sql`: **CORRIGIDA**, contendo staging temporária de 7 colunas, asserções fail-closed estritas, validação de tenant pré-existente e ativo, aborto se já existirem produtos (`COUNT(*) > 0`), e `INSERT` direto sem UPSERT/ON CONFLICT.

## 4. Próximos Passos
- Etapa 5B: Leitura real do Supabase e sincronização no frontend (sem dados de teste misturados).
- Painel Administrativo:
  - Edição individual de produto (incluindo upload/gestão de fotos).
  - Edição em massa com checkbox de seleção.
  - Download de modelo de planilha padronizada para importação/atualização em massa.
  - Cadastro e upload de imagens em massa.
