# 📦 OmniCatálogo SaaS & MC Distribuição - Documentação Oficial do Sistema

Bem-vindo à documentação técnica e operacional completa do **OmniCatálogo SaaS**, a plataforma B2B de catálogos digitais com pedido express via WhatsApp, gestão multitenant isolada via Supabase, integração de e-mails transacionais com Resend e infraestrutura moderna para alta performance.

---

## 📑 Sumário da Documentação

Esta documentação foi estruturada para desenvolvedores, arquitetos de software, administradores de infraestrutura e gestores comerciais:

1. **[01. Arquitetura & Engenharia de Software](./01_ARQUITETURA_E_ENGENHARIA.md)**
   - Visão geral da solução
   - Pilares de tecnologia (React 19, TypeScript, Tailwind CSS, Vite, Supabase PostgreSQL, Resend)
   - Princípios de Isolamento Multitenant (Single Database com RLS)
   - Padrão de Roteamento de Subdomínios e Custom Domains
   - Fluxo de dados e segurança da informação

2. **[02. Banco de Dados & RLS Supabase](./02_BANCO_DE_DADOS_E_RLS_SUPABASE.md)**
   - DDL completo das tabelas (`tenants`, `tenant_users`, `products`, `wholesale_tiers`, `orders`, `site_settings`)
   - Regras de Row Level Security (RLS) para isolamento por empresa
   - Funções auxiliares (Helper Functions) e Triggers
   - Índices de alta performance e integridade referencial

3. **[03. Catálogo Técnico de Produtos MC Distribuição](./03_CATALOGO_PRODUTOS_MC.md)**
   - Especificação dos 92 produtos cadastrados
   - Categorias: Brocas HSS, Brocas Vídea, SDS Plus, Madeira, Mourão, Porcelanato, Discos Flap Zircônio, Discos Diamantados Turbo e Segmentados, Rebolos Cônicos e Retos, Lixas 5 Passos e Híbridas, Cubas e Tanques Inox, Ferramentas Manuais e EPIs
   - Tabela de SKUs, especificações de polegadas/milímetros, precificação e regras de atacado

4. **[04. Manual de Operações do Administrador](./04_MANUAL_DO_ADMINISTRADOR.md)**
   - Guia de uso do Painel da Loja (Tenant Admin)
   - Cadastro e edição de produtos com upload de fotos (auto-enquadramento e compressão)
   - Definição de tabela progressiva de atacado (tabela de descontos por volume)
   - Fluxo operacional de pedidos (Pendente -> Aprovado -> Em Separação -> Despachado -> Entregue)
   - Gestão de Representantes/Vendedores (links exclusivos, rastreamento e cálculo de comissões)
   - Configurações da Loja (cores, banner, logotipo, chave PIX e políticas de frete)

5. **[05. Guia de Implantação e Deploy em Produção](./05_GUIA_DE_IMPLANTACAO_E_DEPLOY.md)**
   - Deploy no Netlify com `netlify.toml` e wildcard DNS
   - Deploy em Cloud Run / Docker / Vercel
   - Configuração de Storage Buckets no Supabase com CDN e políticas públicas
   - Checklist de variáveis de ambiente (`.env.example`) e certificados SSL

6. **[06. Integrações Externas (WhatsApp & Resend API)](./06_INTEGRACOES_WHATSAPP_E_RESEND.md)**
   - Algoritmo de geração de mensagem estruturada para o WhatsApp (carrinho B2B formatado)
   - Integração com Resend para envio de recibos de compra e notificações para o lojista
   - Tratamento de webhooks e templates HTML responsivos

7. **[07. Modelo Comercial SaaS & Projeção de Faturamento](./07_MODELO_DE_NEGOCIO_E_ROI_SAAS.md)**
   - Planos de Assinatura (Starter, Pro, Enterprise)
   - Estrutura de Custos de Infraestrutura vs. Lucratividade
   - Projeções de MRR (Receita Recorrente Mensal) e ARR
   - Roteiro de expansão e estratégias de aquisição de novos lojistas e distribuidores

---

## 🚀 Como Executar o Projeto Localmente

```bash
# 1. Instalar as dependências do projeto
npm install

# 2. Iniciar o servidor de desenvolvimento
npm run dev

# 3. Validar tipagem TypeScript
npm run lint

# 4. Gerar build de produção
npm run build
```

O dev server rodará em `http://localhost:3000`.
