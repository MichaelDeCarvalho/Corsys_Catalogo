# 🗄️ 02. Banco de Dados & RLS Supabase

Este documento contém o script DDL SQL completo para criar e configurar a infraestrutura de dados no **Supabase (PostgreSQL)** com suporte a multitenancy e **Row Level Security (RLS)** ativo em 100% das tabelas.

---

## 1. Diagrama de Relacionamento de Entidades (ERD)

```
┌─────────────────────────────────┐
│            tenants              │
├─────────────────────────────────┤
│ id (PK, UUID)                   │◄────┐
│ slug (UNIQUE)                   │     │
│ name                            │     │
│ owner_email                     │     │
│ plan (starter, pro, enterprise) │     │
│ customization (JSONB)           │     │
└───────────────┬─────────────────┘     │
                │ 1                     │ 1
                │                       │
                │ N                     │ N
┌───────────────▼─────────────────┐   ┌─┴───────────────────────────────┐
│            products             │   │          tenant_users           │
├─────────────────────────────────┤   ├─────────────────────────────────┤
│ id (PK, UUID)                   │   │ id (PK, UUID -> auth.users.id)  │
│ tenant_id (FK -> tenants.id)    │   │ tenant_id (FK -> tenants.id)    │
│ name, sku, category             │   │ role (tenant_admin, sales_rep)  │
│ price, wholesale_price          │   │ seller_code, commission_rate    │
│ stock, unit, images             │   └─────────────────────────────────┘
└───────────────┬─────────────────┘
                │ 1
                │
                │ N
┌───────────────▼─────────────────┐   ┌─────────────────────────────────┐
│        wholesale_tiers          │   │             orders              │
├─────────────────────────────────┤   ├─────────────────────────────────┤
│ id (PK, UUID)                   │   │ id (PK, UUID)                   │
│ product_id (FK -> products.id)  │   │ tenant_id (FK -> tenants.id)    │
│ min_quantity                    │   │ order_number, seller_code       │
│ price, discount_percentage      │   │ customer (JSONB), items (JSONB) │
└─────────────────────────────────┘   │ subtotal, shipping_fee, total   │
                                      │ status, payment_method          │
                                      └─────────────────────────────────┘
```

---

## 2. Script SQL Completo de Implantação

Execute o script abaixo no **Supabase SQL Editor** do seu projeto:

```sql
-- =========================================================================
-- OMNICATÁLOGO SAAS - ESTRUTURA DE BANCO DE DADOS & SEGURANÇA RLS
-- =========================================================================

-- Habilitar extensão para geração de identificadores UUID v4
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------------------
-- 1. TABELA DE EMPRESAS (TENANTS)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    trade_name TEXT,
    cnpj_cpf TEXT,
    plan TEXT NOT NULL DEFAULT 'pro' CHECK (plan IN ('starter', 'pro', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'suspended', 'cancelled')),
    owner_email TEXT NOT NULL,
    owner_phone TEXT,
    owner_name TEXT,
    whatsapp_number TEXT NOT NULL,
    primary_color TEXT DEFAULT '#0284c7',
    accent_color TEXT DEFAULT '#0f172a',
    logo_url TEXT,
    banner_url TEXT,
    custom_domain TEXT UNIQUE,
    min_order_value NUMERIC(10,2) DEFAULT 0.00,
    allow_b2b_mode BOOLEAN DEFAULT true,
    hide_prices_without_login BOOLEAN DEFAULT false,
    delivery_methods JSONB DEFAULT '{"pickup": true, "carrierDelivery": true, "fixedFreight": true, "fixedFreightValue": 35.00, "freeFreightThreshold": 1000.00}',
    pix_key TEXT,
    pix_key_type TEXT DEFAULT 'cnpj',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------------------------
-- 2. TABELA DE USUÁRIOS E PERMISSÕES (TENANT_USERS)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'sales_rep' CHECK (role IN ('superadmin', 'tenant_admin', 'sales_rep', 'stock_manager')),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    seller_code TEXT,
    commission_rate NUMERIC(5,2) DEFAULT 0.00,
    active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{"canEditProducts": true, "canManageOrders": true, "canManageTeam": false, "canViewReports": true}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------------------------
-- 3. TABELA DE PRODUTOS ISOLADA POR TENANT
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    barcode TEXT,
    category TEXT NOT NULL,
    subcategory TEXT,
    brand TEXT DEFAULT 'MC Distribuição',
    description TEXT,
    technical_specs JSONB DEFAULT '{}',
    cost_price NUMERIC(10,2) DEFAULT 0.00,
    price NUMERIC(10,2) NOT NULL,
    promotional_price NUMERIC(10,2),
    wholesale_price NUMERIC(10,2),
    min_order_quantity INTEGER DEFAULT 1,
    stock INTEGER DEFAULT 0,
    unit TEXT DEFAULT 'un',
    images TEXT[] DEFAULT ARRAY[]::TEXT[],
    featured BOOLEAN DEFAULT false,
    is_new BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, sku)
);

-- -------------------------------------------------------------------------
-- 4. TABELA DE FAIXAS DE PREÇO DE ATACADO (PROGRESSIVAS)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wholesale_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    min_quantity INTEGER NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    discount_percentage NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------------------------
-- 5. TABELA DE PEDIDOS E COTAÇÕES
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES public.tenant_users(id) ON DELETE SET NULL,
    seller_code TEXT,
    customer JSONB NOT NULL,
    shipping_address JSONB NOT NULL,
    items JSONB NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL,
    discount NUMERIC(10,2) DEFAULT 0.00,
    shipping_fee NUMERIC(10,2) DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'preparing', 'dispatched', 'delivered', 'cancelled')),
    payment_method TEXT NOT NULL DEFAULT 'pix' CHECK (payment_method IN ('pix', 'boleto', 'credit_card', 'cash_on_delivery')),
    notes TEXT,
    source TEXT DEFAULT 'whatsapp' CHECK (source IN ('sales_rep', 'whatsapp', 'web_checkout')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------------------------
-- 6. ÍNDICES DE ALTO DESEMPENHO
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain ON public.tenants(custom_domain);
CREATE INDEX IF NOT EXISTS idx_products_tenant_active ON public.products(tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON public.orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_seller_code ON public.orders(tenant_id, seller_code);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON public.tenant_users(tenant_id);

-- =========================================================================
-- POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- =========================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Função Helper: recupera o tenant_id associado ao usuário logado
CREATE OR REPLACE FUNCTION get_current_user_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT tenant_id 
    FROM public.tenant_users 
    WHERE id = auth.uid() 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Função Helper: verifica se o usuário é superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.tenant_users 
    WHERE id = auth.uid() AND role = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- POLÍTICAS DA TABELA PRODUCTS
CREATE POLICY "Produtos ativos são públicos para catálogo"
ON public.products FOR SELECT
USING (active = true AND deleted_at IS NULL);

CREATE POLICY "Membros da loja gerenciam apenas seus produtos"
ON public.products FOR ALL
USING (tenant_id = get_current_user_tenant_id() OR is_superadmin());

-- POLÍTICAS DA TABELA ORDERS
CREATE POLICY "Checkout público pode inserir novos pedidos"
ON public.orders FOR INSERT
WITH CHECK (true);

CREATE POLICY "Lojistas visualizam e atualizam somente seus pedidos"
ON public.orders FOR ALL
USING (tenant_id = get_current_user_tenant_id() OR is_superadmin());

-- POLÍTICAS DA TABELA TENANTS
CREATE POLICY "Visualização pública de configurações básicas da loja"
ON public.tenants FOR SELECT
USING (status = 'active');

CREATE POLICY "Apenas admin da loja pode atualizar dados da empresa"
ON public.tenants FOR UPDATE
USING (id = get_current_user_tenant_id() OR is_superadmin());
```
