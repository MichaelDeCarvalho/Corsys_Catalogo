# Checkout B2B — plano de homologação E2E (navegador + Supabase isolado)

**Data de preparação:** 2026-10-08  
**Baseline:** `main` após Item 4 (ADR 012, migration `20261009020000_000018_checkout_field_settings.sql`).  
**Situação:** `NOT EVALUATED` para execução de navegador; este documento é um **roteiro**, não prova de PASS.

**Evidência adicional em 2026-10-09:** `scripts/test-wholesale-context.mjs` monta o provider real com React DOM/jsdom, mocks explícitos de Auth/App/rede e cliques no DOM. Sete casos PASS após correção de troca direta de identidade (baseline 5 PASS / 2 FAIL). Isto é teste de componente, não execução B2B-01–13 ou RACE-01–04 com Supabase real. Veja o início de `SESSION_HANDOFF.md` para ambiente, release e recuperação parcial do escopo 5/6.

## 1. Pré-condições obrigatórias (fail-closed)

- [ ] Ambiente Supabase **isolado da produção** disponível, autorizado e com custo aprovado quando aplicável. Branching do Supabase pode depender de plano pago; não provisionar implicitamente.
- [ ] Schema com migrations 000001–000018 e Edge Functions pertinentes, incluindo `submit-order-checkout`, `get-wholesale-catalog`, `submit-wholesale-application` e `manage-wholesale-customer`.
- [ ] Frontend apontando **exclusivamente** ao ambiente isolado, com variáveis públicas adequadas: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_PUBLIC_TENANT_SLUG`. Nunca usar `service_role` no browser nem copiar segredos para CI ou documentação.
- [ ] Dois tenants fictícios distintos (A e B), lojas com regras comerciais independentes, entregas ativas e produtos fictícios com estoque e regras de mínimo B2B.
- [ ] Usuário Auth de teste com `wholesale_customers.status = 'approved'` e `wholesale_customers.user_id` vinculado **no tenant A**. Segundo usuário pendente/bloqueado e usuário ligado ao tenant B para cenários negativos.
- [ ] Ambiente de mensageria neutro. **Não enviar** mensagem real de WhatsApp, e-mail transacional ou pedido comercial durante o teste.
- [ ] Registrar contagem prévia de pedidos **apenas no ambiente isolado**, para confrontar a geração de recibos.

Não executar o happy path B2B com credenciais de um cliente real, nem criar cliente aprovado artificialmente em produção. Se qualquer pré-condição faltar, registrar `BLOCKED`, sem inferir `PASS`.

## 2. Casos de teste do navegador

| ID | Cenário | Resultado esperado |
| --- | --- | --- |
| B2B-01 | Usuário não autenticado tenta abrir a modalidade atacado | Não obtém catálogo/preço privado nem conclui pedido |
| B2B-02 | Usuário autenticado com solicitação pendente ou bloqueada tenta comprar atacado | Acesso e checkout negados |
| B2B-03 | Comprador aprovado do tenant A autentica, seleciona atacado e abre catálogo | Modo atacado liberado; preços somente dos produtos autorizados da loja A |
| B2B-04 | Produto exige quantidade mínima atacadista; informar valor abaixo do mínimo | Interface impede avanço; servidor rejeita tentativa manipulada |
| B2B-05 | Pedido abaixo de `wholesale_min_order_value` | Bloqueio antes da rede e no backend |
| B2B-06 | Checkout com campos opcionais ocultos na política de A | UI omite campos; nenhum valor oculto é persistido no snapshot |
| B2B-07 | Campo opcional configurado como visível/obrigatório (ex.: `email`) | Validação obrigatória respeitada na UI e no servidor |
| B2B-08 | Comprador B2B aprovado conclui o carrinho fictício, revisa e clica CTA | Um pedido `wholesale` em `pending`, com total calculado no banco e recibo válido |
| B2B-09 | Tentar enviar nome, CNPJ, razão social, userId, tenantId ou preço forjados no body | Gateway rejeita campos de autoridade proibidos ou banco ignora identidade comercial fornecida e usa `wholesale_customers` aprovado |
| B2B-10 | Repetir a mesma tentativa com a mesma `idempotency_key` | Retorno do mesmo pedido; sem criação duplicada |
| B2B-11 | Verificar aba do WhatsApp gerada após receipt validado | Mensagem **textual**, itens e valores do recibo oficial; não contém URL de PDF; não clicar em enviar |
| B2B-12 | Sessão do comprador A tenta catálogo/pedido de B; aprovação revogada no backend durante a sessão | Negação server-side, sem vazamento de preços privados/PII; não basta bloquear só na UI |
| B2B-13 | Varejo da mesma loja continua operacional com política padrão | Regressão de PF/PJ, recibo, tracking e filtros preservados |

O teste deve registrar explicitamente resposta de rede HTTP, ausência de dados sensíveis, identificador sintético do pedido (somente no ambiente isolado) e evidência visual **sem PII**. Não salvar JWT, cookies, senhas, PDFs privados, URLs assinadas ou dados de cliente nos artefatos.

### Cenários adicionais — ciclo de sessão B2B (RACE-01 a RACE-04)

| ID | Operação concorrente em navegador QA | Resultado esperado |
| --- | --- | --- |
| RACE-01 | Iniciar consulta de status aprovada e deslogar antes da resposta | Modalidade volta a varejo; resultado atrasado não restaura aprovação nem dados comerciais |
| RACE-02 | Iniciar carregamento de preços do comprador A, alternar para B e só então receber resposta de A | Nenhum preço ou identidade privada de A aparece na sessão de B; pedido de B continua sujeito ao backend |
| RACE-03 | Catálogo B2B aprovado com **zero** produtos atacadistas acessíveis | Sem loop de requisições após resposta vazia; aplicação mantém estado vazio coerente |
| RACE-04 | Abrir modal de confirmação para atacado com carrinho; alterar sessão/revogar acesso antes da confirmação | Confirmar não ativa atacado nem limpa o carrinho por uma aprovação obsoleta |

Registrar pedidos de rede e resultado visual sanitizados, nunca tokens. Testes unitários de versão/Promise ou CI **não** substituem estes quatro testes de navegador.

## 3. Evidências de aceitação

Para cada caso: `PASS` / `FAIL` / `BLOCKED` / `NOT EVALUATED`, data, revisão GitHub testada, ambiente, navegador, pré-condições e resultado observado. Prints sanitizados opcionais; evidência de uma asserção não substitui execução completa do fluxo.

No banco isolado, validar: `shopping_mode='wholesale'`, `buyer_user_id` correto para A, identidade comercial derivada do cadastro aprovado, preço e total oficiais, `status='pending'`, estoque só movimentado quando aplicável ao ciclo de status; garantir que tenant B não lê o pedido de A.

Na finalização, executar o `bun run check` no commit testado e testes SQL transacionais da pasta `supabase/tests/database/` no **ambiente isolado**. Asserções sintéticas no banco principal existentes no histórico não equivalem a happy path autenticado via navegador.

## 4. Baseline verificado em 2026-10-08 (somente leitura)

- Hosted Supabase `vlpwtdqqnecdvccxyodp`: 18 migrations aplicadas, última `20261009020000`; 8 Edge Functions `ACTIVE`.
- Contagem de `public.orders`: 6; `tenant_public_settings`: 1 política válida de 1.
- Cadastros `wholesale_customers` aprovados com `user_id IS NOT NULL`: **0**. Sem identidade autenticável de teste aprovada no conjunto atual.
- RPCs `create_order_checkout_internal` e `get_wholesale_catalog_internal`: `anon_execute=false`, `authenticated_execute=false`, `service_execute=true`.
- Supabase `list_branches` mostrou somente `main` (nenhum Preview dedicado disponível).
- Security Advisor: somente aviso preexistente `auth_leaked_password_protection` desabilitada.
- Esses resultados **não** provam o E2E do navegador. Nenhum pedido foi criado e nenhuma política foi alterada por esta verificação.

## 5. Critério de fechamento

Somente marcar a pendência **B2B E2E CLOSED / RUNTIME PASS** após executar B2B-01–13 no navegador contra ambiente isolado com evidências, confirmar `bun run check`, verificar isolamento de tenant e anexar registro sanitizado em `docs/SESSION_HANDOFF.md`. A validação do Supabase Preview exige ambiente realmente provisionado e testado, não basta criar branch GitHub.

**Itens 5/6:** especificação funcional não consta nas fontes versionadas inspecionadas (`docs/SESSION_HANDOFF.md`, `docs/PROJECT_CONTEXT.md`, `docs/CURRENT_ARCHITECTURE.md` e ADR 012). Não desenvolver sob rótulos 5/6 até haver escopo e critérios de aceitação identificáveis.
