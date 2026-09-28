# SESSION HANDOFF - PRODUCT MEDIA STORAGE V1 — RUNTIME PASS

## Status Atual
**PRODUCT MEDIA STORAGE V1 — RUNTIME PASS (SUPABASE HOSTED + WORKSPACE VALIDADO)**  
*(Migration 000009 aplicada e congelada. Fluxo completo de upload, persistência, reordenação de principal e remoção física validado em runtime no SKU BR022.)*

---

## 1. O Que Foi Implementado e Validado no Workspace
- **Bucket `product-media` em `supabase/config.toml`:**
  - Configurado: `public = true`, `file_size_limit = "1MiB"`, `allowed_mime_types = ["image/png", "image/jpeg", "image/webp"]`.
  - SVG expressamente bloqueado (mitigação de XSS); GIF animado desabilitado nesta etapa.
- **Migration 000008 (`supabase/migrations/20260916_000008_product_media_storage.sql`):**
  - *Status:* **APLICADA NO SUPABASE HOSTED / CONGELADA** (SHA-256: `991566a46952cf2a7873f6e86393ef7d153e0ff780e79074ce997b775cb1883f`).
  - No banco real, foi identificado que `storage.foldername(name)` dentro de `EXISTS (SELECT 1 FROM public.products p ...)` sofreu shadowing para `p.name` (coluna da tabela `products`).
- **Migration 000009 (`supabase/migrations/20260917_000009_fix_product_media_policy_scope.sql`):**
  - *Status:* **APLICADA NO SUPABASE HOSTED / CONGELADA** (SHA-256: `0a160dba2a7da7b6fd5fab1516afe9bd0c579820c127608bac98721696244051`).
  - Dropa as 3 policies de 000008 e as recria com qualificação explícita do outer row: `storage.foldername(storage.objects.name)`.
  - Preserva integralmente as permissões e lógica de menor privilégio da 000008, sem qualquer ampliação de privilégios.
  - *Runtime de Product Media:* **VALIDADO COM SUCESSO (PASS)** em ambiente real.
  - Policies em `storage.objects` com Menor Privilégio:
    - `product_media_select_authenticated`: SELECT autenticado restrito ao namespace do próprio tenant sob `/products/<product_id>` ou platform_admin, com produto existente e pertencente ao tenant.
    - `product_media_insert_tenant_admin`: INSERT restrito a tenant_admin no diretório `<tenant_uuid>/products/<product_uuid>` ou platform_admin, com produto existente e pertencente ao tenant.
    - `product_media_delete_tenant_admin`: DELETE restrito a tenant_admin no diretório `<tenant_uuid>/products/<product_uuid>` ou platform_admin, com produto existente e pertencente ao tenant.
    - Nenhuma policy de UPDATE (uploads com versionamento determinístico e `upsert: false`).
    - Nenhuma policy de SELECT público amplo em `storage.objects` (acesso público via CDN do bucket).
    - Nenhum DML direto em `storage.buckets` e sem `ALTER TABLE storage.objects`.
- **Serviço de Mídias de Produto (`src/services/productMediaStorageService.ts`):**
  - Inspeção binária de magic bytes (PNG, JPEG, WebP).
  - Validação rigorosa de UUID v4 para `tenant_id` e `product_id` (Fail-Closed).
  - Extração segura de paths (`extractOwnedProductMediaPath`) com rejeição de path traversal (`..`, `\`), schemas perigosos (`blob:`, `data:`, `javascript:`) e isolamento cross-tenant / cross-product.
  - Funções de compensação (`rollbackProductMediaUploads`, `removeProductMediaImage`).
- **Integração no `AdminCatalogService` (`src/services/adminCatalogService.ts`):**
  - `AdminProductUpdatePayload` com campo `images?: string[]`.
  - Sanitização estrita HTTPS-Only em `updateAdminProduct`: aceita exclusivamente `https://` (URLs novas ou legadas), rejeita schemas não-HTTPS (`http://`, `blob:`, `data:`, `javascript:`, `file:`, etc.), sem duplicatas mantendo ordem e sem strings vazias.
- **Interface Administrativa (`src/components/tenantadmin/ProductEditModal.tsx`):**
  - Seção "Fotos do Produto" com upload múltiplo, preview local temporário (`URL.createObjectURL` com revogação via `URL.revokeObjectURL`).
  - Zero uploads remotos ao selecionar arquivos ou cancelar modal. Upload somente ao clicar em "Salvar Alterações".
  - Trava de concorrência (`saving`), reordenação determinística e destaque na posição 0.
  - Fluxo compensatório client-side com rollback automático de uploads em caso de falha no banco.
- **Atualização de Placeholders (`src/utils/productImages.ts` e `ProductManager.tsx`):**
  - Mensagem do SVG placeholder atualizada de "Aguardando ativação Storage V2" para "Sem foto cadastrada".
  - Badge em `ProductManager.tsx` atualizado para "Importação em massa pendente".
- **ADR 003 (`docs/adr/ADR_003_PRODUCT_MEDIA_STORAGE.md`):** Criado com especificações completas de arquitetura, isolamento e segurança.
- **Hotfix Consolidado de Performance do Catálogo (Admin & Serviços):**
  - `ProductManager.tsx`: Paginação client-side simples com `ITEMS_PER_PAGE = 40`.
  - Tabela principal renderiza estritamente `paginatedProducts.map` (redução drástica do DOM de ~520 nós de produto para 40 simultâneos).
  - Memoização com `useMemo` em `categories`, `categoryCounts` (contagem em passagem única O(N)), `filteredProducts` e `paginatedProducts`.
  - Reset automático de `currentPage` para 1 ao modificar filtros ou busca.
  - Seleção em massa na página visível opera sobre `paginatedProducts`, preservando IDs de produtos selecionados em outras páginas.
  - Atributos `loading="lazy"` e `decoding="async"` nos thumbnails da listagem administrativa.
  - `variantCatalogService.ts`: `buildCatalogDisplayItems` purificada, removendo o loop de `console.warn` por SKU não mapeado/ausente durante o ciclo de render/memoização.
  - `ProductEditModal.tsx`: Trava de compensação idempotente (`performRollbackOnce`) garantindo que `rollbackProductMediaUploads` execute no máximo uma vez em caso de falha de persistência no banco.
- **Validação Runtime do Hotfix de Performance:**
  - Performance Profile pós-hotfix capturado no AI Studio Preview com `No throttling`.
  - Entrada no Painel Loja: **~99 ms** (baseline anterior: ~169 ms).
  - Abrir `Editar Produto`: **~269 ms** (baseline anterior: ~2,37 s; melhora aproximada de 89%).
  - Fechar `Editar Produto`: **~329 ms** (baseline anterior: ~5,55 s; melhora aproximada de 94%).
  - Pico de DOM observado caiu de ~64.304 para ~20.154 nós (redução aproximada de 69%).
  - Nenhuma ocorrência de mensagens `[Variações]` observada no trace pós-hotfix.
  - Heap JavaScript observado entre ~19 MB e ~37,7 MB durante o teste; sem evidência de pressão equivalente ao baseline.
  - Extensões Kaspersky ainda estavam presentes no Preview, porém não explicaram o custo residual das interações do modal.
- **Hotfix Tenant UUID / Product Media:**
  - `TenantDashboard` passa explicitamente o tenant UUID administrativo real ao `ProductManager`.
  - `ProductManager` deriva `effectiveTenantId` apenas de UUIDs válidos.
  - Removido fallback de escrita para `currentTenant.id` / IDs legados.
  - Edição individual bloqueia fail-closed se `product.tenantId` não corresponder ao `effectiveTenantId`.
  - Edição em massa valida que todos os `selectedProductIds` existem e pertencem ao mesmo `effectiveTenantId` antes de abrir o modal.
  - `productMediaStorageService` e sua validação UUID permaneceram inalterados.
  - O erro runtime anterior confirmou que o fail-closed bloqueou corretamente um tenant ID legado antes do upload.
- **Validação Funcional Runtime de Product Media (SKU BR022) — RUNTIME PASS:**
  - **Upload real no bucket `product-media`:** PASS.
  - **Path canônico isolado `<tenant_uuid>/products/<product_uuid>/...`:** PASS.
  - **Persistência em `public.products.images[]`:** PASS.
  - **Reload administrativo:** Imagens persistem integralmente: PASS.
  - **Exposição via `catalog_products`:** PASS.
  - **Exibição na Storefront / Vitrine:** PASS.
  - **Adição de segunda imagem:** PASS.
  - **Troca de imagem principal (promoção para `images[0]`):** PASS.
  - **Nova imagem principal refletida na vitrine:** PASS.
  - **Remoção lógica da imagem antiga:** `public.products.images[]` atualizado: PASS.
  - **Remoção física no Storage:** Objeto físico deletado do bucket `product-media`: PASS.
  - **Objeto principal preservado no Storage:** PASS.
  - **Estado final do BR022 no Supabase:** Exatamente 1 imagem em `images[]` e exatamente 1 objeto no namespace do produto (zero imagens órfãs): PASS.
  - *(Nota: Rollback forçado por erro de persistência no banco não foi testado em runtime no teste produtivo; a cobertura de consistência compensatória permanece assegurada pelas suítes de testes automatizados e unitários).*
- **Hotfix Imagem de Família / Variante na Storefront:**
  - Gap de apresentação identificado durante validação runtime: famílias selecionavam cegamente o primeiro item ordenado (que podia não ter imagem).
  - Corrigido em `variantCatalogService.ts`: a família agora seleciona como representativa a primeira variante real da lista que possua imagem cadastrada (sem inventar fotos e sem mutar produtos).
  - Em `VariantGroupCard.tsx`: quando houver busca por SKU (`highlightedSkus`), o card prioriza visualmente a foto do SKU pesquisado e passa `highlightedInitialSku` ao abrir o modal de detalhes (`ProductDetailModal`).
  - Sem `highlightedSku`, mantém comportamento normal da família sem seleção artificial de variante.
- **Importador de Imagens em Massa por SKU (V1 Fail-Closed & Persistência Atômica):**
  - Product Media V1 continua **RUNTIME PASS**.
  - Lote piloto de 17 imagens (AP001, EP003, SG002, CH001, JG002, VE001, LA001, GZ001, FT004, FT002, DS018, FL004, SR021, SR006, SR007, SR008, SR009) foi validado visualmente pelo usuário (arquivos WebP < 1 MiB).
  - Bulk image importer implementado no workspace (`src/services/bulkImageImportService.ts` e `src/components/tenantadmin/ProductBulkImageImportModal.tsx`).
  - Associação estrita por SKU com leitura e validação de `manifest.json`.
  - Dry-run obrigatório de segurança em memória (zero uploads, zero updates, zero deletes).
  - Revalidação de tenant ownership e preservação de produtos que já possuem fotos (`SKIPPED_EXISTING_IMAGE`).
  - **Correção Pré-Sync: Persistência Atômica Condicional (Prevenção TOCTOU):**
    - Criada função `updateAdminProductImagesIfEmpty` em `src/services/adminCatalogService.ts`.
    - Executa UPDATE condicional estrito via PostgREST: `tenant_id = tenantId`, `id = productId`, `deleted_at IS NULL` e `images = '{}'` (array vazio).
    - Elimina completamente a janela de corrida onde outra sessão pudesse adicionar imagem entre o dry-run e a persistência remota.
    - Se zero linhas forem atualizadas, o upload recém-enviado é imediatamente compensado no Storage e o item é classificado como `SKIPPED_CONCURRENT_IMAGE`, preservando intacta a foto preexistente.
    - Se ocorrer erro de persistência no banco, o upload daquele item é compensado cirurgicamente e classificado como `FAILED`.
  - **Execução e Resultados do Lote Piloto de 17 SKUs:**
    - Lote executado com arquivos WebP (< 1 MiB) e `manifest.json`.
    - **17 SUCCESS**
    - **0 FAILED**
    - **0 SKIPPED**
    - **17 URLs** persistidas em `public.products.images[]`
    - **17 objetos físicos** correspondentes criados no bucket `product-media`
    - **0 imagens órfãs** observadas no teste realizado.
  - O importador em massa utiliza persistência condicional atômica via `updateAdminProductImagesIfEmpty` (`images = '{}'`, `deleted_at IS NULL`, `tenant_id` e `id`).
  - Em condição concorrente (imagem adicionada por outra sessão após o dry-run), a gravação condicional atômica resulta em `SKIPPED_CONCURRENT_IMAGE` com rollback imediato do upload recém-criado e preservação da imagem existente.
  - Novas fotos continuam podendo ser adicionadas individualmente pelo painel administrativo através do `ProductEditModal`.
  - *(Nota de governança: o número total de produtos com foto no catálogo reflete estritamente as evidências dos testes executados — SKU BR022 individual + 17 SKUs do lote piloto —, sem assunção de risco zero em cenários não cobertos).*
- **Suítes de Testes Automatizados:**
  - `scripts/test-product-media-storage-points.ts`: **153/153 PASSOU (0 FALHOU)** (inclui testes de parsing de manifest, dry-run, upload sequencial, compensação por item, relatório, filtros atômicos de `updateAdminProductImagesIfEmpty`, mitigação TOCTOU e `SKIPPED_CONCURRENT_IMAGE`).
  - `scripts/test-catalog-performance-points.ts`: **34/34 PASSOU (0 FALHOU)**.
  - `scripts/test-branding-storage-points.ts`: **35/35 PASSOU (0 FALHOU - Regressão Zero)**.
  - `npm run lint` (`tsc --noEmit`): **PASSOU**.
  - `npm run build` (`vite build`): **PASSOU**.

---

## 2. Histórico e Governança de Migrations
- `supabase/migrations/20260902_000001_initial_schema.sql`: **APLICADA / CONGELADA**
- `supabase/migrations/20260903_000002_import_official_catalog.sql`: **APLICADA / CONGELADA**
- `supabase/migrations/20260904_000003_public_catalog_settings.sql`: **APLICADA / CONGELADA**
- `supabase/migrations/20260905_000004_wholesale_item_rules.sql`: **APLICADA / CONGELADA**
- `supabase/migrations/20260907_000005_b2b_wholesale_access.sql`: **APLICADA / CONGELADA**
- `supabase/migrations/20260909_000006_branding_storage.sql`: **APLICADA / CONGELADA**
- `supabase/migrations/20260910_000007_reconcile_b2b_catalog_security.sql`: **APLICADA / CONGELADA**
- `supabase/migrations/20260916_000008_product_media_storage.sql`: **APLICADA NO SUPABASE HOSTED / CONGELADA** (SHA-256: `991566a46952cf2a7873f6e86393ef7d153e0ff780e79074ce997b775cb1883f`)
- `supabase/migrations/20260917_000009_fix_product_media_policy_scope.sql`: **APLICADA NO SUPABASE HOSTED / CONGELADA** (SHA-256: `0a160dba2a7da7b6fd5fab1516afe9bd0c579820c127608bac98721696244051`)
- `supabase/migrations/20260928_000010_orders_checkout_v1.sql`: **APLICADA NO SUPABASE HOSTED / CONGELADA**
- `supabase/migrations/20260928_000011_orders_checkout_hardening.sql`: **CRIADA NO WORKSPACE / AGUARDANDO DEPLOY HOSTED**

*Regra de Ouro: Migrations 000001 a 000010 estão estritamente congeladas e aplicadas no Supabase Hosted. A migration 000011 foi criada no workspace e aguarda homologação/deploy. Push para GitHub main deve ser tratado como potencial gatilho de deploy Supabase; não usar main como simples backup para mudanças ainda não aprovadas de migration ou Edge Function.*

---

## 3. Estado de Orders / Checkout V1 (Hardening & Feature Gate)
- **ADR 004:** Registrado formalmente em `docs/adr/ADR_004_ORDERS_CHECKOUT_V1.md`.
- **Migration 000010 (Aplicada / Congelada):**
  - `idempotency_key UUID NOT NULL` com `UNIQUE (tenant_id, idempotency_key)`.
  - `shopping_mode TEXT NOT NULL CHECK IN ('retail', 'wholesale')`.
  - `delivery_method TEXT NOT NULL`.
  - `public.order_number_seq` (sequence server-side).
  - RPC `public.create_order_checkout_internal` (service_role-only).
  - RPC `public.manage_order_status` (authenticated, tenant_admin / stock_manager / platform_admin, locks pessimistas determinísticos, decremento atômico na aprovação, restauração atômica em cancelamento com `GET DIAGNOSTICS v_affected_rows = 1`).
- **Migration 000011 (Criada no Workspace):**
  - Transação `BEGIN / COMMIT` explícita.
  - Reafirmação de constraints scoped em `pg_constraint.conrelid = 'public.orders'::regclass`.
  - Validação estrita de UUID v4 para `p_idempotency_key` via regex.
  - Snapshots canônicos estritos para `customer` e `shippingAddress` (sem JSON arbitrário).
  - Limites de tamanho de strings na RPC (slug <= 120, seller_code <= 64, delivery_method <= 64, notes <= 1000, name <= 160, street <= 200, selectedVariant <= 160).
- **Edge Function `submit-order-checkout` (Hospedada & Ativa):**
  - Modernizada com `Deno.serve` e `npm:@supabase/supabase-js@2`.
  - Chave de autorização via `SUPABASE_SECRET_KEYS` (extração segura da chave default; `SUPABASE_SERVICE_ROLE_KEY` legada removida).
  - **Feature Gate Fail-Closed:** `CHECKOUT_ENABLED !== "true"` bloqueia qualquer requisição pública com HTTP 503 (`Checkout temporariamente indisponível.`).
  - Limite de 64 KB aferido por bytes UTF-8 (`TextEncoder.encode(rawBody).byteLength`).
  - Whitelist de campos sanitizados antes da chamada da RPC.
  - Rejeição de campos de autoridade financeira (`subtotal`, `total`, `discount`, `unitPrice`, etc.) e `buyerUserId` no body com HTTP 400.
  - Autenticação Bearer obrigatória para `wholesale` (extração do `user.id` real do JWT; nunca do body).
  - Mapeamento e sanitização de erros SQLSTATE conhecidos e HTTP 500 para desconhecidos.
  - **Minimização de Resposta:** Não expõe `tenant_id`, `seller_id`, `idempotency_key` ou `customer`/`shipping_address` brutos.
- **Frontend e Storefront:**
  - `CartDrawer.tsx`, `OrderManager.tsx` e `AppContext.tsx` ainda não integrados nesta etapa (fluxo de pedidos reais ainda não habilitado; não declarar runtime PASS).
  - `public.orders` continha exatamente 0 pedidos no momento da validação pré-hardening.




