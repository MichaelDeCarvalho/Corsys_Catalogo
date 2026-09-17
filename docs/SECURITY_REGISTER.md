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
- **Validação de Runtime e Risco Residual Cross-Tenant:**
  - Runtime validado no AI Studio Preview: logo upload/reload/persistência/substituição/remoção = PASS; banner upload/reload/persistência/substituição/remoção = PASS.
  - Teste em runtime de acesso Cross-tenant: **NOT TESTABLE IN CURRENT DATASET** (o dataset atual de homologação contém apenas o tenant canônico demo; não declarar risco zero. A proteção é mantida estruturalmente por RLS na migration 000006 e validação Fail-Closed no client).
- **Segregação de Escopo de Storage:**
  - O bucket `tenant-assets` atende estritamente o branding institucional da loja (logo e banner).
  - Imagens de produtos pertencem à etapa futura `PRODUCT MEDIA STORAGE` e não utilizam nem compartilham o fluxo de branding atual.

## 4. Reconciliação B2B e Governança de Migrations (000001–000007)
- **Defesa em Profundidade na Reconciliação (Migration 000007):**
  - Reafirmação explícita de grants: o papel `anon` possui SELECT apenas nas 23 colunas públicas de `public.products`, sem acesso a `cost_price`, `wholesale_price`, `wholesale_enabled` e `wholesale_min_quantity`.
  - Recriação determinística de `public.catalog_products` (`security_invoker = true`) sem qualquer coluna de atacado ou custo.
  - RPC `public.get_wholesale_catalog` com fail-closed estrito (`COALESCE(s.allow_b2b_mode, false)`), exigindo aprovação de credenciamento B2B e privilégios revogados de `PUBLIC` e `anon`.
- **Congelamento Estrito das Migrations 000001 a 000007:**
  - Todas as 7 migrations encontram-se aplicadas e congeladas no Supabase Hosted. Nenhuma alteração retroativa é permitida; evoluções futuras exigirão `000008+`.

