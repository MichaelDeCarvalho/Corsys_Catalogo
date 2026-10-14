# PR #6 — Gate de homologação e publicação (2026-10-14)

**Revisão de base (QA):** `7020c992eee261746ef000e0bd1021ed696c26f1` — inclui correção do nome da loja no acompanhamento. **Produção:** GitHub `main` permanece na baseline `d29a5a2` na consulta deste documento; não foi realizado merge/deploy.

## Evidências verificadas nesta revisão

- Quality #53 / run [38654073837](https://github.com/MichaelDeCarvalho/Corsys_Catalogo/actions/runs/38654073837) em `7020c99`: **SUCCESS**. Log: `bun run check`, TypeScript, Vite build, regressões, testes do provider React DOM (8 PASS), validação de fronteira de chave Google e `Tracking React DOM PASS: canonical tenant display ...`. Esse CI não é um E2E autenticado.
- Supabase Hosted `vlpwtdqqnecdvccxyodp`, consulta **somente leitura**: 18 migrations (última `20261009020000`), 8 Edge Functions ACTIVE e 6 pedidos preservados. `tenant_delivery_settings` e `private.google_routes_usage` ainda não existem na produção.
- Valores atuais `delivery_methods`: `retirada`, `entrega`, `uber`, `transportadora`, `outro`, compatíveis com a allowlist proposta na migration 000019.
- **Privacidade B2B / prioridade alta:** tabela `public.wholesale_tiers` tem hoje `anon` com `SELECT` concedido, política `wholesale_tiers_select_public` presente e RLS ativa. **0 registros** observados no momento da leitura, portanto **nenhuma exposição de linha existente foi constatada**. Entretanto, futuros preços por faixa ficariam acessíveis sem a correção 000020. Migration versionada: `20261010000000_000020_product_rls_and_private_wholesale_tiers.sql`.
- Os testes locais reais documentados no `SESSION_HANDOFF` até 2026-10-11 incluem 18 testes HTTP com Auth e Supabase isolado, testes RACE-01–04 de navegador, criação/recibo/tracking de varejo e regressões React DOM. **Matriz B2B completa = PARTIAL**, não `PASS` de release.

## Ordem proposta de entrega (não executada)

1. **Gate funcional:** fechar matriz B2B-01–13 e RACE-01–04 no ambiente isolado. No histórico, subcasos de usuário bloqueado, tentativa completa B2B pelo CTA, verificação integrada em navegador e testes finais entre tenants ainda precisam ser reconciliados com as evidências. Sem fixtures/dados reais de produção.
2. **Gate de segurança/custos Google:** confirmar política final de cobrança, cota real do projeto Google e restrições efetivas da credencial. O endpoint de estimativa é público por desenho do varejo; `Origin`/CORS não é autenticação. Os contadores locais `10/60s`, `250/dia`, `7500/mês` não limitam chamadas diretas com uma chave vazada nem garantem gasto máximo. A chave usada em QA não possuía restrição IP, por decisão registrada anteriormente. Manter `GOOGLE_ROUTES_ENABLED` desativado se os riscos/custos não forem aceitos expressamente para produção.
3. **Gate de banco:** validar backup/restore, bloqueios, RLS e compatibilidade e aplicar migrations forward-only, **em sequência ordenada**, após autorização de mudança em produção: `000019_delivery_settings` → `000020_product_rls_and_private_wholesale_tiers` → `google_routes_usage_limits` → `google_routes_burst_protection`. Entre cada etapa, verificar migrations aplicadas, grants/policies e invariantes de pedidos. Não editar migrations já aplicadas. Definir plano de recuperação por forward-fix; evitar rollback destrutivo de schema/negócio.
4. **Gate de integração:** publicar Edge Function `estimate-delivery` e configurar somente variáveis server-side aprovadas (sem `service_role` no browser). Manter a flag Google desativada até aprovação específica de ativação. Conferir negação `anon` à tabela `wholesale_tiers` em ambiente final e direitos de admin/tenant.
5. **Gate de release:** revisar diffs do PR #6 (inclui alterações B2B, tracking, delivery e 4 migrations), aprovar merge de `main` ciente de que Cloudflare publica a revisão, validar Cloudflare pós-publicação (rota, assets, console, checkout varejo, B2B, erros). Observar gasto/erros se Google for ativado; desabilitar flag imediatamente se houver anomalia.

## Decisões que dependem de autorização

- **Alteração do Supabase de produção e merge/deploy:** autorização de janela de publicação e plano de rollback/forward-fix, separados da aprovação de testes.
- **Google Routes em produção:** aceite consciente de risco financeiro/abuso e política de restrição/identidade ou decisão de manter desativado. Não deduzir aprovação de custos a partir de testes locais.
- **Itens 5/6:** há implementação correspondente a entrega/Google Routes na branch, mas o mapeamento exato do planejamento inicial e critérios comerciais finais ainda exigem reconciliação. Issue #5.
- **E2E incompleto:** caso não seja possível completar cenário específico no ambiente isolado, registrar `BLOCKED`, não promover para `PASS` automaticamente.

**Regra:** este documento é um plano de release e evidência read-only; não autoriza deploy, mudanças Hosted, ativação de cobrança nem criação de chaves. Seguir `docs/RELEASE_CHECKLIST.md`, `docs/qa/GOOGLE_MAPS_ACTIVATION.md` e `docs/SESSION_HANDOFF.md`.
