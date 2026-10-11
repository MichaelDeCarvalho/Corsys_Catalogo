# Validação local autenticada — 2026-10-10

Status consolidado: **PARTIAL**, não fechar toda a matriz B2B/RACE como PASS.

Ambiente: Windows/WSL 2.7.13, Rancher Desktop 1.24.0, Docker Moby 29.5.3; Kubernetes, telemetria e início automático desativados. Supabase CLI 2.116.0, PostgreSQL 17.6, Auth 2.196.0, Edge Runtime 1.74.3. Stack `corsys-pr6-local-qa`, rede com host_binding_ipv4=127.0.0.1. Nenhum projeto Hosted vinculado, custo contratado ou dado de produção importado.

Migrations 000001–000018 e correção 000020 aplicadas no banco local. Import comercial 000002 substituído por dois tenants fictícios; bootstrap 000003 usa nome e telefone fictícios. Edge Function local adapta somente a origem interna da URL assinada do PDF. Demais regras do gateway permanecem; isto não equivale a homologar a configuração Hosted.

## Resultados comprovados

- SQL `01_rls_security_test.sql`: PASS após atualizar fixtures com idempotency_key e aplicar 000020. Sem 000020, soft delete do próprio produto pelo admin falhava e tiers continham dados legíveis anon.
- SQL `02_checkout_fields_test.sql`: PASS antes e depois da correção; RLS, campos obrigatórios/ocultos, autoridade comercial, idempotência, estoque e preço. Rollback dos dados de ambas as suítes.
- 18 testes HTTP locais com Auth real: anon/pending negados, comprador aprovado A, isolamento de catálogo e checkout A/B, total forjado, mínimos de item/pedido, pedido total oficial, idempotência com uma única linha, tiers protegidos, e-mail obrigatório/oculto, revogação com token antigo e pedido varejo de R$30. PASS. Fixtures administradas diretamente no container local, não por privilégios Hosted.
- Navegador real: login comprador A, autorização B2B, preço R$20, mínimo 5 unidades (UI impede decremento), revisão e pedido oficial de R$100. Pedido `PED-20261010-000006`, `wholesale`, `pending`, confirmado no banco; carrinho limpo após resposta válida.
- URL de handoff criada com texto de itens, total e forma de pagamento, sem PDF. Nenhuma mensagem enviada. Inspeção/interação com aba externa WhatsApp bloqueada pela revisão automática; não contornar nem afirmar que envio/recebimento foi validado.
- Reload do comprador autenticado reproduziu catálogo vazio. Cliente público exclusivo anon corrigiu carregamento para um produto; usa storageKey próprio e sem persistência/refresh de sessão. Nenhum grant de products foi ampliado a compradores.
- Bun check inclui testes de recibos: HTTP negado em produção; somente origin loopback configurado e caminho de assinatura order-documents permitido em desenvolvimento.

## Cobertura da matriz

| Casos | Evidência | Limite |
|---|---|---|
| B2B-01/03/04/08 | Navegador + API/banco real | Caminho principal executado |
| B2B-02/05/06/07/09/10/12 | HTTP/SQL real | Não marcar todos os subcasos de UI como executados |
| B2B-11 | URL textual gerada; pedido confirmado | Aba externa bloqueada; sem envio |
| B2B-13 | API varejo PASS, catálogo varejo após reload | PF/PJ e tracking completos no navegador pendentes |
| RACE-01–04 | Provider React DOM 7/7 + guards existentes | Fronteiras sintéticas; não alegar corrida de rede real no navegador |

Ao retomar os subcasos, controles do browser deixaram de produzir mudanças observáveis, tanto por AX quanto por locators na aba local e em uma segunda página local. Não alterar lógica de negócio por esse sintoma sem reprodução independente. Precisa revalidar a interface interativa local antes de fechar a matriz.

## Entrega e riscos

ADR 013 documenta as mudanças. A migration 000020 deve ser revisada e implantada separadamente sob autorização antes de afirmar que Hosted possui o novo controle. 000019 está reservada ao rascunho de entrega preservado no checkout original. Sem merge ou publicação de produção.

Itens 5/6: texto original recuperado; numeração e critérios finais ainda precisam validação do usuário. Não implementar serviço pago de distância nem inferir autorização de instalação como aprovação funcional.

Evidências detalhadas e segredos exclusivamente locais ficam fora do Git: logs sanitizados de testes, status CLI, fixtures de Auth e helper API. Não anexar tokens, URLs assinadas ou credenciais ao PR.


Teste adicional 03_private_wholesale_tiers_test.sql: PASS em papéis reais, com duas faixas não vazias. Comprador aprovado não consulta tiers/produtos privados; administrador consulta somente tiers próprios e arquiva produto próprio; anon negado. Fixtures e alterações revertidas na transação.

## Continuidade de navegador — 2026-10-11, head b6d9691

VERIFIED no navegador local com Auth real: comprador A abriu atacado, preço R$20 e mínimo 5. Carrinho com 5 unidades/R$100 foi encerrado via logout. Após conclusão assíncrona: botão Entrar, carrinho sem contagem, catálogo varejo R$30, sem identificação comercial/preço atacadista. Isso comprova logout normal; não é o cenário RACE de resposta deliberadamente atrasada.

VERIFIED B2B-02 (subcaso pending): login pending-a fictício, status Em análise. Clique no atacado manteve varejo R$30 e exibiu aviso de análise administrativa. Nenhum pedido criado ou mensagem enviada. Evidência visual privada: qa-b2b-pending-blocked.png fora do Git. Subcaso blocked ainda não executado no navegador.

Quality #44 SUCCESS para b6d96910dc310c497bce566f4828b534d887a9c9 foi confirmado na etapa anterior. Alterações desta etapa são apenas documentação de evidência. Matriz geral continua PARTIAL. Após carregamento, IAM confirmou Permissões do projeto Catalogo: uma identidade de usuário visível, Michael Carvalho, papel Proprietário. Sem outros usuários/grupos na tabela sem filtros. Concessões de papel fornecidas pelo Google não incluídas (checkbox desmarcado); revisão limitada aos acessos exibidos. 2FA não avaliada. Nenhuma permissão modificada.
## Campos e mínimo na interface — 2026-10-11

Head b6d9691, usuário aprovado fictício A, Supabase local. B2B-05: mínimo temporário R$500, carrinho 5 x R$20=R$100; interface informou faltam R$400 e desabilitou Avançar. Quantidade 25 atingiu R$500 e permitiu abrir entrega. B2B-07 (email): política visible/required true, email exibido com asterisco; Validar orçamento com campo vazio produziu E-mail é obrigatório e manteve entrega, sem envio de pedido. Evidência local qa-b2b-required-email.png fora do Git.

Configurações restauradas do snapshot privado local: mínimo R$100 e email visible/required false, conferidos no banco. Recarregamento e nova abertura B2B da tela de entrega confirmaram ausência do textbox E-mail (B2B-06, subcaso email oculto). Não estender resultado a todos os campos configuráveis. Nenhum pedido ou chamada Google foi gerado. Snapshot de recuperação mantido somente no banco QA local. Matriz geral continua PARTIAL, especialmente PF/PJ/tracking completo e RACE com atrasos controlados de rede real.
## Acompanhamento e resposta antiga — 2026-10-11

Navegador local real listou 11 pedidos B2B do comprador A e abriu PED-20261011-000018: pending/Aguardando Aprovação, 5 unidades x R$20, subtotal/total R$100, frete a combinar. Nenhum novo pedido criado. Identificação visual da loja no tracking ainda usa nome legado do AppContext (MC Distribuição), apesar do catálogo QA; não é evidência de acesso a dados de outro tenant (consulta usa PUBLIC_TENANT_SLUG). Ajuste dessa identificação permanece pendente.

Revisão encontrou ausência de descarte de resposta antiga em loadB2bOrders. Remediação: identidade atual e geração de requisição guardam resultados/erros/loading; dados privados só são renderizados para a identidade que os carregou; mudança de identidade limpa seleção e cache. Teste React DOM real com fronteiras de Auth/rede sintéticas PASS: resposta A atrasada após troca para B não aparece, resposta B aparece, logout remove pedidos. Não declarar RACE com rede real PASS. Teste incluído em check. Cobertura PF/PJ e varejo por token continua pendente.