# CURRENT ARCHITECTURE - CORSYS MULTI-TENANT

## 1. Arquitetura de Banco e Multi-tenancy
- **Camada de Dados:** PostgreSQL hospedado no Supabase.
- **Isolamento Multi-tenant:** Chave `tenant_id` em todas as tabelas transacionais e cadastrais com RLS (`ROW LEVEL SECURITY`) habilitado e forçado.
- **Resolução de Tenants:** Canônica pelo campo `slug` em `public.tenants` (ex: `corsys-catalogo-demo`), propagada automaticamente para `public.tenant_public_settings` via triggers de sincronização.

## 2. Catálogo Oficial e Importação (Bootstrap 000002)
- **Pipeline de Ingestão:**
  1. Fonte bruta em CSV/texto.
  2. Validação prévia (contagem de linhas, SKUs únicos, validação de tipos, sanitização de números e strings).
  3. Armazenamento canônico em `data/imports/catalogo_oficial_20260903.csv` (exatamente 7 colunas e 520 produtos).
  4. Migration `supabase/migrations/20260903_000002_import_official_catalog.sql` utilizando tabela temporária staging (`staging_official_catalog ON COMMIT DROP`).
  5. Validações fail-closed dentro do bloco PL/pgSQL:
     - 520 linhas e 520 SKUs distintos.
     - Validação de existência única e status ativo do tenant `corsys-catalogo-demo` (sem provisionamento).
     - Precondição fail-closed se o tenant já possuir produtos cadastrados (`COUNT(*) > 0` aborta).
  6. INSERT direto e simples em `public.products` (sem UPSERT / sem ON CONFLICT).

## 3. Estrutura de Campos Mapeados no Bootstrap
| Coluna Planilha | Coluna Banco `public.products` | Tipo | Tratamento Bootstrap |
|---|---|---|---|
| `Família` | `category` | `TEXT` | Categoria de 1º nível |
| `Cod.Prod.` | `sku` | `TEXT` | SKU único por tenant |
| `Produto` | `name` | `TEXT` | Nome do produto limpo de aspas |
| `Estoque` | `stock` | `INTEGER` | Saldo de estoque físico |
| `Valor custo mercadoria` | `cost_price` | `NUMERIC(10,2)`| Custo real |
| `Valor varejo` | `price` | `NUMERIC(10,2)`| Preço base B2C |
| `Valor atacado` | `wholesale_price` | `NUMERIC(10,2)`| Preço B2B (`NULL` quando '-') |
| *(Sem fonte)* | `brand` | `TEXT` | `NULL` (não inventado) |
| *(Sem fonte)* | `barcode` | `TEXT` | `NULL` |
| *(Sem fonte)* | `subcategory` | `TEXT` | `NULL` |
| *(Sem fonte)* | `description` | `TEXT` | `NULL` |
| *(Sem fonte)* | `technical_specs` | `JSONB` | `'{}'::jsonb` |
| *(Sem fonte)* | `promotional_price`| `NUMERIC(10,2)`| `NULL` |
| *(Negócio)* | `min_order_quantity`| `INTEGER` | `1` |
| *(Negócio)* | `unit` | `TEXT` | `'un'` |
| *(Sem fonte)* | `images` | `TEXT[]` | `ARRAY[]::TEXT[]` (sem mocks) |
| *(Status)* | `active` | `BOOLEAN` | `true` |
| *(Status)* | `featured` | `BOOLEAN` | `false` |
| *(Status)* | `is_new` | `BOOLEAN` | `false` |
| *(Status)* | `sort_order` | `INTEGER` | `0` |

## 4. Frontend & Runtime
- O frontend em React 18 + Vite continua intacto e desacoplado na Etapa 5A.
- A Etapa 5B conectará os provedores ao Supabase real do tenant demo.
