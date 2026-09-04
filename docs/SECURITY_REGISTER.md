# SECURITY REGISTER - PRIVACIDADE E RLS

## 1. Tratamento de Dados Financeiros e de Custo (`cost_price`)
- **Status do Campo:** O campo `cost_price` foi carregado para os 520 produtos na tabela `public.products`.
- **Diagnóstico Atual das Camadas de Acesso:**
  - **Acesso Anônimo (`anon`):** Não recebe `cost_price` ao consultar a VIEW pública `public.catalog_products` (que projeta apenas as colunas públicas do catálogo).
  - **View Pública (`public.catalog_products`):** NÃO contém e não expõe a coluna `cost_price`.
  - **Usuários Autenticados (`authenticated`):** Atualmente possuem grant de `SELECT` completo na tabela base `public.products` (restringidos por `tenant_id` via RLS). Consequentemente, qualquer usuário autenticado com acesso às linhas do tenant pode ler a coluna `cost_price`.
- **Risco Pendente Registrado:** Exposição do preço de custo a perfis autenticados que não deveriam ter visibilidade financeira irrestrita (como clientes B2C logados, `sales_rep` e `stock_manager`).
- **Resolução Planejada:** A correção de autorização e granularidade de acesso à coluna `cost_price` será implementada em uma migration de segurança dedicada ANTES da criação de usuários reais (`sales_rep`, `stock_manager`, clientes), mantendo a migration 000002 estritamente focada no bootstrap de produtos sem alterar grants ou RLS.

## 2. Isolamento de Tenants
- Nenhuma consulta ou mutação pode omitir `tenant_id`.
- Todas as operações administrativas continuam filtradas por `private.get_current_tenant_id()` e validadas contra `tenant_users`.
- A migration `20260903_000002_import_official_catalog.sql` não cria tenants e não altera `tenant_public_settings`.
