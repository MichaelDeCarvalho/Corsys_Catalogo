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

## 3. Segurança no Supabase Storage (`tenant-assets`)
- **Prevenção contra XSS:**
  - Formato SVG (`image/svg+xml`) expressamente rejeitado no frontend por MIME e magic bytes (`<svg`), e restrito a `image/png, image/jpeg, image/webp` na configuração do bucket. Hardening client-side complementado por restrições no bucket (`allowed_mime_types`).
- **Proteção contra Path Traversal e Spoofing Multi-tenant:**
  - O primeiro segmento da URI de storage é estritamente o UUID canônico do tenant (`<tenant_uuid>/branding/...`).
  - Falha fechada (`isValidUUID`): Nenhum upload ou deleção é aceito se o tenant autenticado não tiver um UUID v4 válido. Slugs ou fallbacks arbitrários são recusados.
- **Princípio do Menor Privilégio nas Policies RLS:**
  - `SELECT`: Concedido estritamente a usuários autenticados para objetos do seu próprio `tenant_id` (`tenant_admin`) ou `platform_admin`. Esta política é indispensável pois a API `storage.remove()` do Supabase requer verificação via SELECT + DELETE. Não há policy SELECT pública em `storage.objects` (anon não pode enumerar arquivos; imagens são entregues via URL pública de CDN do bucket).
  - `INSERT`: Restrito estritamente a `tenant_admin` autenticado no diretório do seu próprio `tenant_id` ou `platform_admin`.
  - `UPDATE`: Não concedido a nenhuma role. Todos os arquivos são versionados por timestamp com `upsert: false`.
  - `DELETE`: Restrito estritamente a `tenant_admin` no diretório do seu próprio `tenant_id` ou `platform_admin` para fluxos compensatórios e substituição de mídia.
- **Deleção Segura e Compatibilidade com Registros Legados:**
  - Validação estrita via `extractOwnedBrandingPath`: Apenas URLs/paths comprovadamente originados do bucket `tenant-assets` e dentro do diretório `<tenant_uuid>/branding/` são passíveis de exclusão física.
  - Registros antigos ou URLs externas (ex: `https://site-externo.com/logo.png`) são substituídos no banco de dados sem tentativa de remoção no Storage, evitando erros e tentativas de acesso fora do boundary do tenant.

