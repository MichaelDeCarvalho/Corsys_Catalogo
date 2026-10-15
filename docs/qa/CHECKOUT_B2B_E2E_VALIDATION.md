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


Atualização final deste registro: 18 testes de API local PASS; pedido do navegador PED-20261010-000006 confirmado no banco (wholesale/pending/R). Cobertura consolidada PARTIAL, com limites por caso em docs/qa/LOCAL_RUNTIME_20261010.md. RACE com fronteiras reais de navegador e alguns subcasos UI/retail/tracking permanecem pendentes. Inspeção da aba externa WhatsApp foi bloqueada pela revisão automática; nenhum envio efetuado. Sem merge/deploy de produção.


## 6. Matriz reconciliada para pré-release — 2026-10-14

**Status global: PARTIAL / NÃO LIBERADO PARA MERGE.** Evidências abaixo são das execuções locais de **10–11/10/2026** documentadas em `docs/qa/LOCAL_RUNTIME_20261010.md` e `docs/SESSION_HANDOFF.md`. **Não são uma nova execução E2E em 14/10.** O ambiente anterior era Supabase local isolado com Auth/Edge reais, não Preview Hosted. CI de componente é uma camada distinta.

| ID | Evidência documentada | Faltante para aceite integral |
| --- | --- | --- |
| B2B-01 | Anônimo negado no percurso local/API | Reteste na revisão final |
| B2B-02 | Pendente bloqueado na UI; backend nega | Bloqueado/suspenso no navegador e reteste final |
| B2B-03 | Aprovado A com preço R$20 no navegador | Reteste na revisão final |
| B2B-04 | Quantidade mínima 5 na UI e backend | Reteste na revisão final |
| B2B-05 | Mínimo R$500 demonstrado na UI/API | Reteste na revisão final |
| B2B-06 | Parcial: e-mail oculto na UI e dados de backend testados | Demais campos ocultos e snapshot do percurso integral |
| B2B-07 | Parcial: e-mail visível/obrigatório validado UI/backend | Demais campos obrigatórios |
| B2B-08 | Pedido fictício de R$100, atacado/pending confirmado no banco QA | Reteste na revisão final |
| B2B-09 | Forja de identidade/preço negada no HTTP local | Revalidar tenant A/B no head final |
| B2B-10 | Idempotência PASS no HTTP Auth real local | Reteste final |
| B2B-11 | Parcial: mensagem textual sem PDF gerada | Aba externa de atacado não validada; não enviar mensagem |
| B2B-12 | Isolamento A/B/revogação no HTTP + RACE navegador | Cobrir jornada final completa após troca de sessão |
| B2B-13 | Parcial: PF e recibo/tracking reais em QA; PJ até revisão | PJ completo, filtros e tracking em navegador QA |
| RACE-01 | PASS: status RPC atrasado 20s + logout sem reabrir aprovação | Reavaliar se lógica mudar |
| RACE-02 | PASS: catálogo A atrasado 45s + logout/login B, sem preço A | Troca direta A→B só tem teste de componente |
| RACE-03 | PASS observado por 20s: uma chamada com catálogo vazio | Janela observada finita |
| RACE-04 | PASS depois de correção: revogação com modal aberto preserva carrinho | Backend continua sendo controle contra TOCTOU |

**Regressão incremental de 14/10:** seis casos adicionais de componente no `scripts/test-wholesale-context.mjs`: pending/suspended/rejected, falha na revalidação, confirmação duplicada e revogação com catálogo já carregado. CI Quality #59 (https://github.com/MichaelDeCarvalho/Corsys_Catalogo/actions/runs/38656900813) SUCCESS em `de6109d`. O cálculo Google na UI exige `VITE_GOOGLE_ROUTES_UI_ENABLED === 'true'`; sem opt-in fica oculto. Quality #62 (https://github.com/MichaelDeCarvalho/Corsys_Catalogo/actions/runs/38657056819) SUCCESS em `a44e7a6`. **Nenhum navegador com Auth real foi executado nesta rodada.**

**Hosted somente leitura (14/10):** 20 migrations, versões 000019/000020 alinhadas; 6 pedidos, 520 produtos; `anon` sem SELECT em `wholesale_tiers`; 1 configuração privada de entrega, `estimateEnabled=false`. Migrations de Google Routes/Edge Function de estimativa ainda não aplicadas/publicadas. Não criar comprador ou pedidos artificiais em Hosted.

**Gate de conclusão:** reexecutar os subcasos pendentes em browser QA contra Supabase local isolado atualizado, registrar HTTP/estado final e evidência sanitizada; depois reavaliar issue #4 e decisão de release. Não declarar a matriz integral PASS com CI de componente.


## 7. Retomada browser QA automatizável — 2026-10-14/15

**GATE: BLOCKED para conclusão E2E nesta sessão.** A estação Windows/WSL da validação de 10–11/10 não está montada neste runtime; não há checkout local do repositório, Supabase CLI/serviços Docker ou Auth fixtures da QA anterior. Chromium e Python Playwright estão presentes, mas **isso não cria o aplicativo nem o backend isolado**. A sessão atual pode consultar GitHub privado e Supabase **Hosted produção**; este último não deve receber dados de teste. Nenhum cenário de navegador com backend real foi executado aqui. Não contar esse bloqueio como FAIL de código ou como PASS de E2E.

Criado no PR #6: `scripts/qa-browser/test_b2b_access_browser.py`, roteiro automatizado read-only para Chromium via Python Playwright. Testa B2B-01 anônimo e B2B-02 nas três contas fictícias distintas (`pending`, `suspended` e `rejected`) por login visual/consulta de status/negativa de atacado. O script **recusa** URLs que não sejam localhost/127.0.0.1/::1, aborta qualquer requisição HTTP(S) externa antes de prosseguir, não cria pedidos, não navega ao WhatsApp e não publica credenciais no log. Por desenho, **não cobre** os subcasos restantes B2B-03–13 nem RACE-01–04. O passo adicional no Quality apenas verifica sintaxe Python; **não** executa a QA Browser sem fixtures.

### Execução reproduzível na estação QA isolada anterior

1. Recuperar a branch atual do PR #6 na estação Windows/WSL; inicializar **somente** Supabase local e os dois tenants/usuários fictícios conforme `docs/qa/LOCAL_RUNTIME_20261010.md`, sem vincular o projeto Hosted. Conferir Postgres 17, funções de Auth e as migrations locais conforme requisitos do checkout; mudanças específicas de Google podem ficar desativadas para a bateria B2B.
2. Iniciar o frontend Vite apontado exclusivamente à URL local do Supabase. Conferir no navegador a ausência de chamadas a `*.supabase.co` e outras origens externas. Sem serviço local/fixtures, registrar BLOCKED; não alterar URL para produção para fazer o teste passar.
3. Instalar Playwright Python e Chromium na estação QA se ainda não existentes (`python -m pip install playwright`; `python -m playwright install chromium`). Definir as variáveis de ambiente somente na sessão local, nunca commitar credenciais ou colocá-las em issues:
   - `QA_BASE_URL=http://127.0.0.1:3000` (ou a porta Vite local efetiva)
   - `QA_SUPABASE_URL=http://127.0.0.1:54321`
   - `QA_B2B_PENDING_EMAIL` / `QA_B2B_PENDING_PASSWORD`
   - `QA_B2B_SUSPENDED_EMAIL` / `QA_B2B_SUSPENDED_PASSWORD`
   - `QA_B2B_REJECTED_EMAIL` / `QA_B2B_REJECTED_PASSWORD`
   - Opcional: `QA_CHROMIUM_EXECUTABLE` apontando ao Chromium da estação.
4. Executar `python scripts/qa-browser/test_b2b_access_browser.py`. Registrar somente PASS/FAIL/BLOCKED e revisão de HEAD (não salvar URLs de pedidos, JWT, senhas, screenshot com PII ou tokens). O teste nunca deve ser redirecionado para Cloudflare ou Hosted. Se uma fixture não existir ou qualquer URL não for local, ele falha fechado (BLOCKED).
5. Concluir manualmente/em navegador QA os subcasos B2B-06/07, 11, 12, 13 ainda incompletos; conferir criação de pedido apenas com fixture local e aceitação explícita de abertura da URL WhatsApp sintética, sem envio. Registrar observação de requests/DB e controle de isolamento por tenant. Atualizar a matriz e somente então reconsiderar o gate para merge.

**Importante:** não inserir scripts Playwright de login Auth com credenciais em CI público e não publicar a instância QA Docker no domínio produtivo. Este roteiro sozinho **não** fecha a matriz B2B.


## 8. Continuação de QA — PF/PJ somente leitura (2026-10-14)

Esta sessão **não reativou** o backend Supabase QA local (as portas 3000/5173/54321 estão indisponíveis). O Chromium instalado pôde iniciar, porém o navegador foi bloqueado com `ERR_BLOCKED_BY_ADMINISTRATOR` ao navegar inclusive para um servidor temporário em `127.0.0.1`. Não substituir por produção ou forçar o bloqueio. Nenhum teste E2E Auth/Edge de B2B-01–13 foi executado nesta sessão; permanecem os PASS históricos de 10–11/10 no ambiente/revisão anteriores.

Foi adicionado `scripts/qa-browser/test_retail_identity_browser.py`, um teste Chromium **sem envio de pedido**: visita frontend/Supabase estritamente loopback, usa produto fictício disponível na vitrine, entra no checkout de varejo, alterna PF→PJ→PF, valida campos CPF/CNPJ/razão social e afirma que não houve `submit-order-checkout`, consulta privada B2B ou request a origin externo. O script reutiliza o guard de rede do runner B2B. Este subcaso cobrirá **apenas a UI de B2B-13**, não o pedido PJ, rastreamento, filtros ou o fluxo geral. Depende de produto/estoque, política default da loja e mínimo de varejo compatível em QA; se pré-condição falhar, marcar BLOCKED em vez de alterar a produção.

O pipeline Quality verifica `python3 -m py_compile` de ambos os scripts, mas **não** inicia um navegador nem provê banco/usuários. Para executar na estação QA anterior, configurar `QA_BASE_URL` e `QA_SUPABASE_URL` exclusivamente localhost, iniciar frontend+Supabase isolados com fixtures fictícias e usar:

```bash
python scripts/qa-browser/test_retail_identity_browser.py
python scripts/qa-browser/test_b2b_access_browser.py
```

O segundo script exige `QA_B2B_PENDING_*`, `QA_B2B_SUSPENDED_*` e `QA_B2B_REJECTED_*` fornecidos **somente na sessão privada** do ambiente QA, nunca em CI/repositório. Para ambos, registrar resultado efetivo, HEAD testado e evidências sanitizadas. Sem execução real, o status global continua **PARTIAL / BLOCKED**, e o PR #6 permanece sem autorização de merge.


## 9. Execução seletiva e contrato de segurança do runner — 2026-10-14

A execução padrão de `test_b2b_access_browser.py` continua cobrindo os quatro cenários (`anon,pending,suspended,rejected`), com fixtures obrigatórias para as três identidades. Para executar apenas um subconjunto na estação QA isolada, usar `QA_B2B_CASES` com nomes separados por vírgula. Exemplo: `QA_B2B_CASES=anon` não exige login nem senhas; `QA_B2B_CASES=pending,suspended` exige somente as duas contas sintéticas correspondentes. Valores desconhecidos, lista vazia e duplicatas falham fechado. **Executar somente um subconjunto não altera o status dos casos não executados: permanecem NOT EVALUATED.**

Os dois runners recusam URLs de frontend/backend fora das origens HTTP(S) loopback explícitas. A sessão Playwright bloqueia Service Workers e intercepta HTTP(S) e WebSockets para impedir conexões *diretas* a origens que não sejam as duas origens QA configuradas. Requer Playwright Python **1.48+** para interceptação de WebSockets. Os testes de contrato em `scripts/qa-browser/test_browser_preflight.py` validam seleção, preflight de origem e interceptação de HTTP/WebSocket sem executar navegador, usar credenciais ou tocar em rede. O Quality executa esses testes Python stdlib após `bun run check`.

**Limitação importante:** o interceptador Playwright não equivale a firewall de rede/namespace. A própria documentação Playwright informa que redirecionamentos podem ser seguidos após a primeira requisição roteada. Portanto a QA efetiva precisa também permanecer em ambiente de rede isolado de produção (sem secrets/URL Hosted), e a execução do browser com Auth real continua sendo uma etapa separada. Referências: https://playwright.dev/python/docs/network e https://playwright.dev/python/docs/api/class-browsercontext .

**Escopo da evidência:** sucesso de `python3 -m unittest discover -s scripts/qa-browser -p 'test_browser_preflight.py' -v` comprova regras dos runners em objetos sintéticos, **não** B2B-01–13, login real, RLS, checkout ou tracking de navegador. Nenhuma autorização implícita de merge ou deploy.


## 10. Revisão PF/PJ e matriz de campos — 2026-10-14

- **Correção funcional na branch QA:** a mudança de comprador varejo PJ→PF limpa o CNPJ anterior, a razão social mantida em memória e os respectivos erros de validação; a mudança PF→PJ limpa CPF anterior. Reescolher o mesmo tipo conserva o documento já digitado. Mudança localizada em `src/components/storefront/CartDrawer.tsx`; regressão estrutural `81s` em `scripts/test-orders-frontend-integration-points.ts`.
- **Quality #98 SUCCESS** na revisão estável pós-remoção de harness React DOM experimental e **Quality #100 SUCCESS** incluindo limpeza da razão social PF. **Quality #101 SUCCESS** ([run](https://github.com/MichaelDeCarvalho/Corsys_Catalogo/actions/runs/38671426663), commit `96833a92e0ab94d90341a460f9d27f38ea2cbfa6`) com `bun run check`: 40 validações de regras de ocultação/obrigatoriedade para 10 campos opcionais em `scripts/test-checkout-fields.ts` (varejo PJ e atacado B2B, incluindo ausência de required em campos inaplicáveis), 14/14 React DOM sintéticos B2B e 5/5 testes de preflight Python.
- **Limite exato da evidência:** regras `parseCheckoutFields`, `checkoutRequiredErrors` e `projectCheckoutValues` verificadas em testes puros; alternância PF/PJ e cleanup de razão social garantidos somente por regressão estrutural de wiring do componente. **Não houve novo teste de navegação/checkout persistido com navegador e Supabase Auth local**, nem foi verificada a matriz completa de campos dinâmicos no DOM. O teste experimental `test-retail-document-switch.mjs` foi removido por execução de CI inconclusiva; não contá-lo como PASS.
- **Gate B2B-06/07** continua PARTIAL no nível E2E: visitar checkout com configurações de campos reais alteradas na instância local isolada e verificar visibilidade, validação inline e projeção/persistência. **Gate B2B-13** continua PARTIAL: alternância PF/PJ, pedido PJ fictício, filtros e tracking em navegador. Não usar Supabase Hosted para fixtures ou pedidos de teste, não fazer merge/deploy e manter Google Routes desativado.


## 11. Recibo vinculado ao pedido original após popup fechado — 2026-10-14

- **Falha de consistência identificada por revisão do fluxo:** após `submitOrderCheckout` criar o pedido, se a aba neutra do WhatsApp fosse fechada, `createdOrder` era preservado sem vinculação ao conteúdo do `draft`. Em nova tentativa, dados/carrinho/usuário podiam estar diferentes e o mesmo recibo seria reutilizado para handoff. **Não há evidência de exploração nem de ocorrência em produção**; código era alcançável a partir do ramo `if (prepWindow.closed)`.
- **Mitigação na branch:** `CartDrawer` guarda em memória somente o SHA-256 da intenção associada ao recibo, por `computeOrderFingerprint(draft, user?.id || 'anonymous')`. Uma nova tentativa reutiliza `createdOrder` apenas quando o hash canônico permanece igual; alterações de usuário, tenant, modalidade, itens, dados de contato, endereço ou pagamento impedem a reutilização, com mensagem de erro e sem redirecionar a janela para WhatsApp. `resetCheckoutLifecycle` apaga o vínculo. A Edge Function permanece a fonte autoritativa do recibo e da idempotência.
- **Verificação executada:** [Quality #107](https://github.com/MichaelDeCarvalho/Corsys_Catalogo/actions/runs/38672256780) **SUCCESS**, incluindo asserção estrutural `67c` e casos criptográficos com variação de usuário/tenant/endereço/pagamento/contato/itens/modalidade; 14/14 DOM sintético de autorização, 40 regras de campos e 5/5 preflight Python. **Não** houve browser com popup, Auth real nem pedido real nesta rodada.
- **Gate ainda pendente:** caso de aba fechada/retry com mesmo `draft`, alteração do `draft` entre tentativas e troca de login durante a criação do pedido devem ser cobertos no navegador QA isolado. O hash no frontend **não substitui** autorização no servidor ou isolamento entre sessões em toda a aplicação. Sem merge/deploy/Google Routes até conclusão de aceite.
