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
