# PR #6 — Revisão do diff, gate de release e rollback (16/10/2026)

**Estado:** PREPARADO PARA HOMOLOGAÇÃO FINAL / BLOQUEADO PARA MERGE E DEPLOY.
**Escopo auditado:** diff de `main` até `qa/b2b-checkout-e2e-readiness-20261008`, 71 arquivos, com alterações em frontend, Auth B2B, Edge, RLS, migrations, QA, CI, documentação e Google Routes. Conferir novamente a lista, HEAD e os checks antes de qualquer publicação.
**Ambiente de prova:** GitHub Actions com Supabase local descartável, dois tenants e contas/pedidos fictícios; não é staging Hosted nem produção.
**Última baseline integrada aprovada antes da ampliação B2B-11/13:** SHA `2051cfe42ec418dfef33ee674b97f81b06e1520d`, Quality #38975306992 PASS, Isolated Browser QA #38975306909 PASS. Alterações posteriores exigem novos checks por SHA.

## Achado crítico da revisão do diff — 16/10/2026

**GATE BLOQUEADO POR AUTORIZAÇÃO B2B / REPLAY DE IDEMPOTÊNCIA.** A RPC original de 000018 retorna pedidos já existentes antes de validar o comprador em tentativas de replay. O teste adversarial de chave de A reutilizada pelo comprador B, introduzido em `cee84b7`, falhou em [QA #38978866418](https://github.com/MichaelDeCarvalho/Corsys_Catalogo/actions/runs/38978866418); essa execução não registrou o status HTTP exato e **não prova ocorrência em Hosted**. É um risco de autorização que precisa ser fechado antes de qualquer publicação.

**Remediação em branch de QA, NÃO APLICADA NO HOSTED:** migration forward-only `20261016000000_000023_checkout_idempotency_buyer_guard.sql`, ADR 015 e Security Register. A implementação antiga da RPC é movida a `private` com EXECUTE revogado aos papéis de API; o wrapper `public` valida tenant e comprador ativo inclusive no replay, compara dono/modalidade e serializa pela chave antes de delegar. Auditorias SQL e teste negativo serão executados em Supabase descartável. Até confirmar CI completo no SHA exato, estado **NOT EVALUATED**, nunca PASS.

**Dependência de release:** 000023 sucede migrations de Google Routes `20261011*` ainda não aplicadas em produção. Não executar `supabase db push` para instalar 000023, pois isso pode aplicar as migrations pagas fora do escopo. Para eventual implantação posterior, exigir aprovação separada de migration, plano seletivo supervisionado, backup e validação de privilégios/compatibilidade.

---

## Revisão por fronteira de risco

| Superfície | Diff / controle observado | Condição de aceite |
| --- | --- | --- |
| Autenticação B2B e troca A→B | `WholesaleAccessContext` usa geração por usuário, invalida respostas antigas e revalida autorização antes da mudança de modo; `CartDrawer` descarta recibo de sessão obsoleta | Auth real e revogação/tenant negativo no backend; nenhuma PII ou preço de A exposto a B |
| Checkout e valores | `submit-order-checkout` mantém cálculo server-side por RPC; idempotência e fingerprint do recibo; QA confirma total autoritativo e contagem independente no Postgres local | Um pedido por chave, sem preço/tenant/usuário escolhidos pelo cliente |
| PDF e Storage | Bucket `order-documents` privado; Signed URL do objeto exato via `PUBLIC_SUPABASE_URL` server-side opcional, HTTPS ou loopback aprovado | Signed URL recuperável; URL pública sem token negada; nenhuma URL/token em logs |
| Catálogo e RLS | `getPublicCatalogClient` usa anon sem persistir sessão; migration 000020 restringe wholesale tiers | Revalidar privilégio `anon` e isolamento A/B; migration já aplicada em Hosted não deve ser reexecutada |
| Configuração de entrega | Migration 000019 e formulário de admin; preços/tarifas persistidos no banco com validação server-side | Verificar configuração existente e compatibilidade; migration já aplicada e congelada |
| Rotas Google e custos | Dois arquivos de migration, `estimate-delivery`, `_shared/googleRoutes` e UI foram incluídos no diff mas a função/DB não foram ativadas no Hosted; feature gate duplo | **Fora do release permitido:** não aplicar as migrations, não publicar a função, não habilitar `GOOGLE_ROUTES_ENABLED`, nem `VITE_GOOGLE_ROUTES_UI_ENABLED=true`; exigir gate próprio de custos e aprovação |
| GitHub e Cloudflare | Workflow Quality com `contents: read`; Browser QA isolada vinculada ao PR #6; `wrangler.jsonc` com previews | `main` pode iniciar deploy automaticamente; merge e publicação dependem de autorização expressa |
| Testes e documentos | 71 arquivos, incluindo runner Chromium, SQL read-only e testes unitários | Não inferir PASS a partir de script presente; cada caso deve referenciar run/commit/ambiente |

## Checklist de pré-release (somente leitura; não executar publicação)

- [x] Revisão do inventário completo do diff de 71 arquivos e inspeção de contratos críticos de auth, RLS, checkout, PDF, Google, CI e deploy.
- [x] Evidência histórica de Quality e Browser QA no SHA `2051cfe` (confirmação por job).
- [ ] **Obrigatório:** Quality e Isolated Browser QA PASS no HEAD final após ampliação dos testes, com logs sanitizados e banco fictício.
- [ ] **Obrigatório:** registrar B2B-01–13 e RACE-01–04 por subcaso, sem transformar testes parciais em aprovação integral.
- [ ] **Obrigatório:** revisão manual de comportamento com Auth real contra revogação/tenant cruzado e dos campos configuráveis ocultos no snapshot, se não cobertos por automação integral.
- [ ] **Obrigatório:** confirmar que nenhuma migration ou função Google foi aplicada/publicada por engano; `GOOGLE_ROUTES_ENABLED` ausente/falso no servidor e `VITE_GOOGLE_ROUTES_UI_ENABLED` ausente/falso no build.
- [ ] **Obrigatório:** conferir migrations 000019/000020 **já aplicadas** e compatibilidade/backup; não executar `supabase db push` indiscriminadamente.
- [ ] **Obrigatório:** verificar estado de `CHECKOUT_ENABLED` e `PUBLIC_SUPABASE_URL` com pessoal autorizado, sem exibir valores secretos.
- [ ] **Obrigatório:** validar plano de recuperação do frontend e banco com pessoa responsável, histórico de artefatos/backup e acesso para restaurar.
- [ ] **Obrigatório:** aprovação explícita para merge em `main` e para deploy Cloudflare (etapas separadas).

## Plano de implantação futura — AGUARDANDO AUTORIZAÇÃO

1. Congelar commit SHA do PR, verificar ausência de divergências com `main`, registrar runs completos de Quality e QA.
2. Capturar estado de migrations e políticas de produção **somente leitura**, confirmar backup/restore disponível e responsável pelo recovery; não migrar automaticamente.
3. Confirmar flags de Google desligadas e `estimate-delivery` não publicada, separar migrations Google ainda pendentes de qualquer operação de banco autorizada. Não habilitar nova API paga.
4. Preparar ponto de recuperação de Cloudflare: anotar deployment/commit atualmente ativo e método documentado de promover versão anterior. Não executar ainda.
5. Com autorização específica, revisar/mesclar PR; analisar o acionamento automático do pipeline de produção **antes** do merge. Após deploy autorizado, smoke test de assets/SPA, login, catálogo, modalidades, pedido/tracking e PDF sem dados sintéticos Hosted.
6. Registrar aprovação, evidências e plano de monitoramento. Qualquer falha crítica bloqueia o release.

## Rollback e resposta a falhas

- **Frontend Cloudflare:** voltar à última revisão/deployment de produção previamente validado, usando o mecanismo de recuperação disponível e confirmado no momento do release. Não assumir acesso ou comando de rollback sem verificação prévia.
- **Edge Functions:** manter versão anterior preservada e rollback somente mediante plano autorizado; o endpoint `estimate-delivery` não deve ser publicado nesta entrega.
- **Banco/RLS:** migrations 000019/000020 foram aplicadas e são forward-only; **não desfazer nem reexecutar** cegamente. Se surgir regressão, bloquear tráfego afetado conforme controles existentes, preservar evidências, avaliar correção forward-only e backup com operador responsável. Google migrations não fazem parte da implantação.
- **Pedidos e dados:** não apagar pedidos reais, não alterar idempotency keys nem criar pedidos artificiais para diagnosticar Hosted. Distinguir remediação de auditoria.
- **Segurança:** em exposição de PII, bypass de tenant, segredo ou preço indevido, interromper release e seguir procedimento de incidente, revogando acesso apenas mediante autorização adequada.
- **Recuperação validada?** **NOT EVALUATED:** este documento especifica o procedimento; nenhum rollback real ou drill foi executado.

**Veredito atual:** AGUARDANDO HOMOLOGAÇÃO FINAL; o PR deve permanecer OPEN, sem merge, escrita Hosted, deploy Cloudflare ou ativação de custos Google.
