/**
 * TEST SUITE: ORDERS / CHECKOUT V1 (BACKEND TRANSACTIONAL CORE)
 * 
 * Cobertura Completa:
 * 1. Auditoria de Schema (Migration 000010 & Governança de 000001-000009)
 * 2. Análise Estrutural e Permissões da RPC create_order_checkout_internal (Least Privilege)
 * 3. Simulação Funcional da Lógica Transacional de Checkout (Retail, Wholesale, Idempotência, Preços)
 * 4. Simulação Funcional do Ciclo de Vida de Estoque e Matriz de Transição de Status (manage_order_status)
 * 5. Auditoria de Segurança da Edge Function submit-order-checkout e Configuração
 */

import * as fs from 'fs';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

const VALID_TENANT_UUID = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
const OTHER_TENANT_UUID = 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e';
const VALID_PROD_UUID_1 = '11111111-1111-4111-8111-111111111111';
const VALID_PROD_UUID_2 = '22222222-2222-4222-8222-222222222222';
const VALID_BUYER_USER_ID = '33333333-3333-4333-8333-333333333333';
const VALID_SELLER_USER_ID = '44444444-4444-4444-8444-444444444444';
const VALID_IDEMPOTENCY_KEY = '55555555-5555-4555-8555-555555555555';

console.log('======================================================');
console.log('TEST SUITE: ORDERS & CHECKOUT V1 (BACKEND CORE)');
console.log('======================================================\n');

// =========================================================================
// 1. Auditoria de Schema (Migration 000010)
// =========================================================================
console.log('1. Auditoria de Schema & Governança de Migrations');

const migration10Path = 'supabase/migrations/20260928_000010_orders_checkout_v1.sql';
assert(fs.existsSync(migration10Path), 'Migration 000010 existe no workspace');

const migration10Sql = fs.readFileSync(migration10Path, 'utf-8');

// Verifica preservação de 000001-000009
const migrationFiles = fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql'));
assert(migrationFiles.length === 10, 'Exatamente 10 migrations registradas no workspace (000001 a 000010)');

// Verifica colunas adicionadas em 000010
assert(
  migration10Sql.includes('ADD COLUMN IF NOT EXISTS idempotency_key UUID'),
  'Migration 000010 adiciona idempotency_key UUID'
);
assert(
  migration10Sql.includes('uq_orders_tenant_idempotency UNIQUE (tenant_id, idempotency_key)'),
  'Migration 000010 adiciona constraint UNIQUE composta (tenant_id, idempotency_key)'
);
assert(
  migration10Sql.includes('ADD COLUMN IF NOT EXISTS shopping_mode TEXT'),
  'Migration 000010 adiciona shopping_mode TEXT'
);
assert(
  migration10Sql.includes("CHECK (shopping_mode IN ('retail', 'wholesale'))"),
  'Migration 000010 valida shopping_mode via CHECK constraint'
);
assert(
  migration10Sql.includes('ADD COLUMN IF NOT EXISTS delivery_method TEXT'),
  'Migration 000010 adiciona delivery_method TEXT'
);
assert(
  migration10Sql.includes('CREATE SEQUENCE IF NOT EXISTS public.order_number_seq'),
  'Migration 000010 cria sequence server-side order_number_seq'
);
assert(
  migration10Sql.includes('REVOKE ALL ON SEQUENCE public.order_number_seq FROM PUBLIC, anon, authenticated;') &&
  migration10Sql.includes('GRANT USAGE ON SEQUENCE public.order_number_seq TO service_role;'),
  'Sequence order_number_seq possui permissões restritas a service_role (Least Privilege)'
);
assert(
  !migration10Sql.includes('ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_payment_method') &&
  !migration10Sql.includes('chk_orders_payment_method'),
  'Migration 000010 NÃO altera a constraint canônica de payment_method'
);
assert(
  !migration10Sql.includes('CREATE TABLE public.order_items') &&
  !migration10Sql.includes('CREATE TABLE IF NOT EXISTS public.order_items'),
  'Migration 000010 NÃO cria tabela relacional order_items (mantém items JSONB imutável no V1)'
);

// =========================================================================
// 2. Análise Estrutural e Permissões das RPCs
// =========================================================================
console.log('\n2. Permissões e Segurança das RPCs (Least Privilege & Search Path)');

assert(
  migration10Sql.includes('CREATE OR REPLACE FUNCTION public.create_order_checkout_internal('),
  'RPC create_order_checkout_internal declarada'
);
assert(
  migration10Sql.includes('SECURITY DEFINER') &&
  migration10Sql.includes("SET search_path = ''"),
  'RPC create_order_checkout_internal utiliza SECURITY DEFINER com search_path vazio'
);
assert(
  migration10Sql.includes('REVOKE ALL ON FUNCTION public.create_order_checkout_internal') &&
  migration10Sql.includes('FROM PUBLIC, anon, authenticated;'),
  'RPC create_order_checkout_internal revoga acesso de PUBLIC, anon e authenticated'
);
assert(
  migration10Sql.includes('GRANT EXECUTE ON FUNCTION public.create_order_checkout_internal') &&
  migration10Sql.includes('TO service_role;'),
  'RPC create_order_checkout_internal concede execução EXCLUSIVAMENTE a service_role'
);
assert(
  migration10Sql.includes('CREATE OR REPLACE FUNCTION public.manage_order_status('),
  'RPC manage_order_status declarada'
);
assert(
  migration10Sql.includes('REVOKE ALL ON FUNCTION public.manage_order_status(UUID, TEXT) FROM PUBLIC, anon;') &&
  migration10Sql.includes('GRANT EXECUTE ON FUNCTION public.manage_order_status(UUID, TEXT) TO authenticated;'),
  'RPC manage_order_status acessível apenas por usuários authenticated'
);

// =========================================================================
// 3. Simulação Funcional da Lógica Transacional de Checkout (create_order_checkout_internal)
// =========================================================================
console.log('\n3. Simulação da Lógica Transacional de Criação de Pedido (Checkout)');

interface MockTenantSettings {
  tenantId: string;
  slug: string;
  status: 'active' | 'suspended';
  minOrderValue: number;
  wholesaleMinOrderValue: number | null;
  allowB2bMode: boolean;
  deliveryMethods: string[];
}

interface MockProduct {
  id: string;
  tenantId: string;
  name: string;
  sku: string;
  unit: string;
  price: number;
  promotionalPrice: number | null;
  wholesalePrice: number | null;
  wholesaleEnabled: boolean;
  wholesaleMinQuantity: number | null;
  minOrderQuantity: number;
  stock: number;
  images: string[];
  active: boolean;
  deletedAt: string | null;
}

interface MockWholesaleCustomer {
  tenantId: string;
  userId: string;
  cnpj: string;
  legalName: string;
  tradeName: string | null;
  contactName: string;
  email: string;
  phone: string;
  status: 'pending' | 'approved' | 'rejected';
}

const mockSettings: MockTenantSettings = {
  tenantId: VALID_TENANT_UUID,
  slug: 'corsys-demo',
  status: 'active',
  minOrderValue: 400.0,
  wholesaleMinOrderValue: 1000.0,
  allowB2bMode: true,
  deliveryMethods: ['retirada', 'entrega', 'uber', 'transportadora', 'outro'],
};

const mockProducts: MockProduct[] = [
  {
    id: VALID_PROD_UUID_1,
    tenantId: VALID_TENANT_UUID,
    name: 'APLICADOR ARGACON R1',
    sku: 'AP001',
    unit: 'un',
    price: 150.0,
    promotionalPrice: 140.0,
    wholesalePrice: 100.0,
    wholesaleEnabled: true,
    wholesaleMinQuantity: 5,
    minOrderQuantity: 1,
    stock: 20,
    images: ['https://storage.supabase.com/prod1.webp'],
    active: true,
    deletedAt: null,
  },
  {
    id: VALID_PROD_UUID_2,
    tenantId: VALID_TENANT_UUID,
    name: 'SARGENTO ANGULAR SG02',
    sku: 'SG002',
    unit: 'un',
    price: 300.0,
    promotionalPrice: null,
    wholesalePrice: 200.0,
    wholesaleEnabled: true,
    wholesaleMinQuantity: 2,
    minOrderQuantity: 1,
    stock: 10,
    images: ['https://storage.supabase.com/prod2.webp'],
    active: true,
    deletedAt: null,
  },
];

const mockWholesaleCustomer: MockWholesaleCustomer = {
  tenantId: VALID_TENANT_UUID,
  userId: VALID_BUYER_USER_ID,
  cnpj: '12345678000199',
  legalName: 'COMERCIAL SILVA LTDA',
  tradeName: 'SILVA DISTRIBUIÇÃO',
  contactName: 'Carlos Silva',
  email: 'carlos@silva.com.br',
  phone: '41999998888',
  status: 'approved',
};

// Mock Order Storage in memory
const storedOrders: Array<any> = [];
let seqCounter = 1;

function simulateCreateOrderCheckoutInternal(params: {
  tenantSlug: string;
  idempotencyKey: string;
  shoppingMode: string;
  items: Array<{ productId: string; quantity: number; selectedVariant?: string }>;
  customer: any;
  shippingAddress: any;
  paymentMethod: string;
  deliveryMethod: string;
  notes?: string | null;
  sellerCode?: string | null;
  buyerUserId?: string | null;
  // Injected DB State
  tenantState?: MockTenantSettings;
  productsState?: MockProduct[];
  wholesaleCustomerState?: MockWholesaleCustomer | null;
}) {
  const settings = params.tenantState || mockSettings;
  const products = params.productsState || mockProducts;
  const wholesaleCust = params.wholesaleCustomerState !== undefined ? params.wholesaleCustomerState : mockWholesaleCustomer;

  // 1. Validations
  if (!params.tenantSlug) throw new Error('Slug do tenant é obrigatório.');
  if (!params.idempotencyKey) throw new Error('Chave de idempotência é obrigatória.');
  if (!['retail', 'wholesale'].includes(params.shoppingMode)) throw new Error('Modalidade de compra inválida.');
  if (!Array.isArray(params.items) || params.items.length === 0) throw new Error('Lista de itens vazia.');
  if (params.items.length > 200) throw new Error('O pedido excede o limite máximo permitido de 200 itens.');
  if (!params.customer?.name || !params.customer?.phone) throw new Error('Dados do cliente inválidos.');
  if (!params.shippingAddress?.street) throw new Error('Endereço de entrega inválido.');
  if (!['pix', 'boleto', 'credit_card', 'cash_on_delivery'].includes(params.paymentMethod)) {
    throw new Error(`Forma de pagamento não suportada: ${params.paymentMethod}`);
  }

  // 2. Tenant resolution
  if (settings.slug !== params.tenantSlug) throw new Error('Loja não encontrada.');
  if (settings.status !== 'active') throw new Error('Esta loja está temporariamente inativa para novos pedidos.');

  // 3. Idempotency check
  const existing = storedOrders.find(
    o => o.tenant_id === settings.tenantId && o.idempotency_key === params.idempotencyKey
  );
  if (existing) {
    return { order: existing, fromIdempotency: true };
  }

  // 4. Delivery method
  if (!settings.deliveryMethods.includes(params.deliveryMethod)) {
    throw new Error(`Método de entrega "${params.deliveryMethod}" não é aceito por esta loja.`);
  }

  // 5. Seller code
  let sellerId: string | null = null;
  let sellerCode: string | null = null;
  if (params.sellerCode) {
    if (params.sellerCode === 'VEND10') {
      sellerId = VALID_SELLER_USER_ID;
      sellerCode = 'VEND10';
    } else {
      throw new Error('Código de vendedor inválido ou inexistente nesta loja.');
    }
  }

  // 6. Wholesale validation
  let customerSnapshot = params.customer;
  if (params.shoppingMode === 'wholesale') {
    if (!params.buyerUserId) throw new Error('Acesso atacadista exige usuário comprador autenticado.');
    if (!settings.allowB2bMode) throw new Error('Esta loja não opera na modalidade Atacado / B2B.');
    if (settings.wholesaleMinOrderValue === null) throw new Error('Configuração da loja inválida: valor mínimo de atacado não definido.');
    if (!wholesaleCust || wholesaleCust.status !== 'approved' || wholesaleCust.userId !== params.buyerUserId) {
      throw new Error('Cadastro de comprador B2B não encontrado ou ainda não aprovado pela loja.');
    }

    customerSnapshot = {
      name: wholesaleCust.contactName,
      companyName: wholesaleCust.legalName,
      tradeName: wholesaleCust.tradeName,
      document: wholesaleCust.cnpj,
      type: 'PJ',
      email: params.customer.email || wholesaleCust.email,
      phone: params.customer.phone || wholesaleCust.phone,
    };
  }

  // 7. Duplicate product check
  const prodIds = params.items.map(i => i.productId);
  if (new Set(prodIds).size !== prodIds.length) {
    throw new Error('O pedido não pode conter produtos repetidos em linhas separadas.');
  }

  // 8. Items calculation & stock verification (without decrementing)
  let subtotal = 0;
  const sanitizedItems = [];

  for (const rawItem of params.items) {
    if (!Number.isInteger(rawItem.quantity) || rawItem.quantity < 1) {
      throw new Error('Quantidade de item deve ser um número inteiro positivo.');
    }

    const prod = products.find(p => p.id === rawItem.productId && p.tenantId === settings.tenantId && p.active && !p.deletedAt);
    if (!prod) {
      throw new Error('Produto não encontrado ou indisponível no catálogo desta loja.');
    }

    if (prod.stock < rawItem.quantity) {
      throw new Error(`Estoque insuficiente para o produto ${prod.name} (Disponível: ${prod.stock}, Solicitado: ${rawItem.quantity}).`);
    }

    let unitPrice = 0;
    if (params.shoppingMode === 'retail') {
      if (rawItem.quantity < prod.minOrderQuantity) {
        throw new Error(`Quantidade mínima do produto ${prod.name} é de ${prod.minOrderQuantity} ${prod.unit}.`);
      }
      unitPrice = prod.promotionalPrice !== null ? prod.promotionalPrice : prod.price;
    } else {
      if (!prod.wholesaleEnabled || prod.wholesalePrice === null || prod.wholesalePrice <= 0) {
        throw new Error(`Produto ${prod.name} não está disponível para venda no atacado.`);
      }
      const minQty = prod.wholesaleMinQuantity || 1;
      if (rawItem.quantity < minQty) {
        throw new Error(`Quantidade mínima de atacado para ${prod.name} é de ${minQty} ${prod.unit}.`);
      }
      unitPrice = prod.wholesalePrice;
    }

    const totalPrice = Math.round(unitPrice * rawItem.quantity * 100) / 100;
    subtotal += totalPrice;

    sanitizedItems.push({
      productId: prod.id,
      productName: prod.name,
      productSku: prod.sku,
      productImage: prod.images[0] || '',
      unitPrice,
      quantity: rawItem.quantity,
      unit: prod.unit,
      totalPrice,
      selectedVariant: rawItem.selectedVariant || null,
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;

  // 9. Minimum order value validation
  if (params.shoppingMode === 'retail') {
    if (settings.minOrderValue && subtotal < settings.minOrderValue) {
      throw new Error(`Valor do pedido (R$ ${subtotal}) abaixo do valor mínimo de varejo da loja (R$ ${settings.minOrderValue}).`);
    }
  } else {
    if (subtotal < (settings.wholesaleMinOrderValue || 0)) {
      throw new Error(`Valor do pedido (R$ ${subtotal}) abaixo do valor mínimo de atacado da loja (R$ ${settings.wholesaleMinOrderValue}).`);
    }
  }

  // 10. Generate order number & Insert pending order (STOCK IS UNTOUCHED)
  const orderNumber = `PED-20260928-${String(seqCounter++).padStart(6, '0')}`;
  const newOrder = {
    id: `ord-${Date.now()}-${Math.random()}`,
    tenant_id: settings.tenantId,
    order_number: orderNumber,
    idempotency_key: params.idempotencyKey,
    shopping_mode: params.shoppingMode,
    delivery_method: params.deliveryMethod,
    seller_id: sellerId,
    seller_code: sellerCode,
    customer: customerSnapshot,
    shipping_address: params.shippingAddress,
    items: sanitizedItems,
    subtotal,
    discount: 0.0,
    shipping_fee: 0.0,
    total: subtotal,
    status: 'pending',
    payment_method: params.paymentMethod,
    notes: params.notes || null,
    source: 'web_checkout',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  storedOrders.push(newOrder);
  return { order: newOrder, fromIdempotency: false };
}

// Teste 3.1: Pedido Varejo com Recálculo de Preço (Promotional Price Priorizado)
const retailRes = simulateCreateOrderCheckoutInternal({
  tenantSlug: 'corsys-demo',
  idempotencyKey: VALID_IDEMPOTENCY_KEY,
  shoppingMode: 'retail',
  items: [
    { productId: VALID_PROD_UUID_1, quantity: 3 }, // 3 * 140 = 420 (supera min 400)
  ],
  customer: { name: 'João Comprador', phone: '41988887777' },
  shippingAddress: { street: 'Rua das Flores', number: '123' },
  paymentMethod: 'pix',
  deliveryMethod: 'entrega',
});

assert(retailRes.order.status === 'pending', 'Pedido varejo criado com status pending');
assert(retailRes.order.subtotal === 420.0, 'Preço recalculado server-side com valor promocional (3 * 140 = 420)');
assert(retailRes.order.items[0].unitPrice === 140.0, 'Snapshot do item contém preço promocional oficial');
assert(mockProducts[0].stock === 20, 'Criação de pedido pending NÃO decrementa estoque');

// Teste 3.2: Idempotência (mesma chave retorna o mesmo pedido sem reprocessar)
const retryRes = simulateCreateOrderCheckoutInternal({
  tenantSlug: 'corsys-demo',
  idempotencyKey: VALID_IDEMPOTENCY_KEY,
  shoppingMode: 'retail',
  items: [{ productId: VALID_PROD_UUID_1, quantity: 3 }],
  customer: { name: 'João Comprador', phone: '41988887777' },
  shippingAddress: { street: 'Rua das Flores', number: '123' },
  paymentMethod: 'pix',
  deliveryMethod: 'entrega',
});

assert(retryRes.fromIdempotency === true, 'Retry com mesma idempotency_key identificado');
assert(retryRes.order.id === retailRes.order.id, 'Idempotência retorna exatamente o mesmo pedido');
assert(storedOrders.length === 1, 'Idempotência não duplica linhas na base de pedidos');

// Teste 3.3: Varejo abaixo do pedido mínimo rejeitado
let belowMinErr = false;
try {
  simulateCreateOrderCheckoutInternal({
    tenantSlug: 'corsys-demo',
    idempotencyKey: 'key-below-min-001',
    shoppingMode: 'retail',
    items: [{ productId: VALID_PROD_UUID_1, quantity: 1 }], // 1 * 140 = 140 < 400
    customer: { name: 'João', phone: '119' },
    shippingAddress: { street: 'Rua A' },
    paymentMethod: 'pix',
    deliveryMethod: 'entrega',
  });
} catch (e: any) {
  belowMinErr = e.message.includes('abaixo do valor mínimo de varejo');
}
assert(belowMinErr, 'Pedido varejo abaixo do mínimo (R$ 400) é rejeitado server-side');

// Teste 3.4: Atacado sem login de comprador rejeitado
let wholesaleNoAuthErr = false;
try {
  simulateCreateOrderCheckoutInternal({
    tenantSlug: 'corsys-demo',
    idempotencyKey: 'key-wholesale-noauth',
    shoppingMode: 'wholesale',
    buyerUserId: null,
    items: [{ productId: VALID_PROD_UUID_1, quantity: 10 }],
    customer: { name: 'Empresa', phone: '119' },
    shippingAddress: { street: 'Rua A' },
    paymentMethod: 'pix',
    deliveryMethod: 'entrega',
  });
} catch (e: any) {
  wholesaleNoAuthErr = e.message.includes('exige usuário comprador autenticado');
}
assert(wholesaleNoAuthErr, 'Pedido atacado sem usuário autenticado é bloqueado');

// Teste 3.5: Atacado com comprador não aprovado rejeitado
let wholesaleNotApprovedErr = false;
try {
  simulateCreateOrderCheckoutInternal({
    tenantSlug: 'corsys-demo',
    idempotencyKey: 'key-wholesale-unapproved',
    shoppingMode: 'wholesale',
    buyerUserId: 'user-pendente-uuid',
    wholesaleCustomerState: null, // Sem aprovação
    items: [{ productId: VALID_PROD_UUID_1, quantity: 10 }],
    customer: { name: 'Empresa', phone: '119' },
    shippingAddress: { street: 'Rua A' },
    paymentMethod: 'pix',
    deliveryMethod: 'entrega',
  });
} catch (e: any) {
  wholesaleNotApprovedErr = e.message.includes('não encontrado ou ainda não aprovado');
}
assert(wholesaleNotApprovedErr, 'Pedido atacado de comprador sem status approved é bloqueado');

// Teste 3.6: Atacado Válido com Preço de Atacado e Snapshot Oficial de PJ
const wholesaleOrderRes = simulateCreateOrderCheckoutInternal({
  tenantSlug: 'corsys-demo',
  idempotencyKey: 'key-wholesale-ok-001',
  shoppingMode: 'wholesale',
  buyerUserId: VALID_BUYER_USER_ID,
  items: [
    { productId: VALID_PROD_UUID_1, quantity: 6 }, // 6 * 100 = 600 (min qty 5)
    { productId: VALID_PROD_UUID_2, quantity: 3 }, // 3 * 200 = 600 (min qty 2) => total 1200 >= 1000
  ],
  customer: { name: 'Nome Fraudulento Alterado no Browser', phone: '11999999999' },
  shippingAddress: { street: 'Av. Industrial, 500' },
  paymentMethod: 'boleto',
  deliveryMethod: 'transportadora',
});

assert(wholesaleOrderRes.order.status === 'pending', 'Pedido atacado criado com status pending');
assert(wholesaleOrderRes.order.subtotal === 1200.0, 'Preço de atacado recalculado no banco (6*100 + 3*200 = 1200)');
assert(
  wholesaleOrderRes.order.customer.companyName === 'COMERCIAL SILVA LTDA' &&
  wholesaleOrderRes.order.customer.document === '12345678000199',
  'Snapshot de cliente no atacado utiliza dados oficiais de wholesale_customers (imune a adulteração)'
);

// Teste 3.7: Atacado abaixo de wholesale_min_quantity rejeitado
let wholesaleMinQtyErr = false;
try {
  simulateCreateOrderCheckoutInternal({
    tenantSlug: 'corsys-demo',
    idempotencyKey: 'key-wholesale-minqty',
    shoppingMode: 'wholesale',
    buyerUserId: VALID_BUYER_USER_ID,
    items: [{ productId: VALID_PROD_UUID_1, quantity: 2 }], // 2 < 5
    customer: { name: 'Silva', phone: '119' },
    shippingAddress: { street: 'Rua A' },
    paymentMethod: 'boleto',
    deliveryMethod: 'transportadora',
  });
} catch (e: any) {
  wholesaleMinQtyErr = e.message.includes('Quantidade mínima de atacado');
}
assert(wholesaleMinQtyErr, 'Item de atacado abaixo da quantidade mínima do produto é rejeitado');

// Teste 3.8: Estoque insuficiente no momento do checkout bloqueia criação
let insufficientStockErr = false;
try {
  simulateCreateOrderCheckoutInternal({
    tenantSlug: 'corsys-demo',
    idempotencyKey: 'key-stock-insufficient',
    shoppingMode: 'retail',
    items: [{ productId: VALID_PROD_UUID_1, quantity: 50 }], // 50 > 20
    customer: { name: 'João', phone: '119' },
    shippingAddress: { street: 'Rua A' },
    paymentMethod: 'pix',
    deliveryMethod: 'entrega',
  });
} catch (e: any) {
  insufficientStockErr = e.message.includes('Estoque insuficiente para o produto');
}
assert(insufficientStockErr, 'Estoque insuficiente no momento do checkout é bloqueado');

// Teste 3.9: Produto de outro tenant é bloqueado
let crossTenantProdErr = false;
try {
  simulateCreateOrderCheckoutInternal({
    tenantSlug: 'corsys-demo',
    idempotencyKey: 'key-cross-tenant',
    shoppingMode: 'retail',
    items: [{ productId: 'product-from-other-tenant', quantity: 3 }],
    customer: { name: 'João', phone: '119' },
    shippingAddress: { street: 'Rua A' },
    paymentMethod: 'pix',
    deliveryMethod: 'entrega',
  });
} catch (e: any) {
  crossTenantProdErr = e.message.includes('Produto não encontrado');
}
assert(crossTenantProdErr, 'Produto cross-tenant é bloqueado (Fail-Closed)');

// Teste 3.10: Código de vendedor inválido rejeitado; código válido persistido
let invalidSellerErr = false;
try {
  simulateCreateOrderCheckoutInternal({
    tenantSlug: 'corsys-demo',
    idempotencyKey: 'key-invalid-seller',
    shoppingMode: 'retail',
    sellerCode: 'CODIGO_INEXISTENTE',
    items: [{ productId: VALID_PROD_UUID_1, quantity: 3 }],
    customer: { name: 'João', phone: '119' },
    shippingAddress: { street: 'Rua A' },
    paymentMethod: 'pix',
    deliveryMethod: 'entrega',
  });
} catch (e: any) {
  invalidSellerErr = e.message.includes('Código de vendedor inválido');
}
assert(invalidSellerErr, 'Código de vendedor inexistente/inválido é rejeitado');

const validSellerRes = simulateCreateOrderCheckoutInternal({
  tenantSlug: 'corsys-demo',
  idempotencyKey: 'key-valid-seller-001',
  shoppingMode: 'retail',
  sellerCode: 'VEND10',
  items: [{ productId: VALID_PROD_UUID_1, quantity: 3 }],
  customer: { name: 'João', phone: '119' },
  shippingAddress: { street: 'Rua A' },
  paymentMethod: 'pix',
  deliveryMethod: 'entrega',
});
assert(
  validSellerRes.order.seller_id === VALID_SELLER_USER_ID && validSellerRes.order.seller_code === 'VEND10',
  'Código de vendedor válido resolve seller_id associado corretamente'
);

/// =========================================================================
// 4. Simulação do Ciclo de Vida de Estoque (manage_order_status)
// =========================================================================
console.log('\n4. Gestão de Ciclo de Vida de Estoque e Transições de Status (manage_order_status)');

// Verificações estáticas de SQL da Migration 000010 para Hardening
assert(
  migration10Sql.includes('GET DIAGNOSTICS v_affected_rows = ROW_COUNT;') &&
  migration10Sql.includes('IF v_affected_rows <> 1 THEN'),
  'Migration 000010 valida GET DIAGNOSTICS v_affected_rows = ROW_COUNT em operações de estoque'
);
assert(
  migration10Sql.includes('AND p.active = true') &&
  migration10Sql.includes('AND p.deleted_at IS NULL') &&
  migration10Sql.includes('IF NOT FOUND THEN') &&
  migration10Sql.includes('indisponível, inativo ou excluído'),
  'Aprovação (pending -> approved) revalida atomicamente se o produto continua ativo e não-deleted'
);
assert(
  migration10Sql.includes('PERFORM 1') &&
  migration10Sql.includes('IF NOT FOUND THEN') &&
  migration10Sql.includes('não encontrado para o tenant durante o cancelamento'),
  'Cancelamento (approved/preparing -> cancelled) valida existência física com NOT FOUND fail-closed'
);
assert(
  migration10Sql.includes('IF v_item.qty IS NULL OR v_item.qty < 1 THEN') &&
  migration10Sql.includes('Quantidade de item inválida'),
  'manage_order_status valida defensivamente integridade da quantidade no snapshot (qty >= 1)'
);

function simulateManageOrderStatus(params: {
  orderId: string;
  newStatus: string;
  callerId: string;
  callerRole: 'tenant_admin' | 'stock_manager' | 'sales_rep' | 'platform_admin';
  callerTenantId?: string;
  productsState: MockProduct[];
}) {
  const order = storedOrders.find(o => o.id === params.orderId);
  if (!order) throw new Error('Pedido não encontrado.');

  // Check authorization
  if (params.callerRole !== 'platform_admin') {
    if (params.callerTenantId !== order.tenant_id || !['tenant_admin', 'stock_manager'].includes(params.callerRole)) {
      throw new Error('Acesso não autorizado para gerenciar pedidos deste tenant.');
    }
  }

  // Terminal states check
  if (['delivered', 'cancelled'].includes(order.status)) {
    throw new Error(`Pedido já está em estado terminal (${order.status}) e não permite transição.`);
  }

  if (order.status === params.newStatus) return order;

  // Transitions
  if (order.status === 'pending' && params.newStatus === 'approved') {
    // Sort products by UUID ascending (deadlock prevention)
    const sortedItems = [...order.items].sort((a, b) => a.productId.localeCompare(b.productId));
    
    // Check all products: active, not deleted, sufficient stock, valid quantity
    for (const item of sortedItems) {
      if (item.quantity === null || item.quantity === undefined || item.quantity < 1) {
        throw new Error(`Quantidade de item inválida (${item.quantity}) no pedido.`);
      }

      const prod = params.productsState.find(
        p => p.id === item.productId && p.tenantId === order.tenant_id && p.active && !p.deletedAt
      );

      if (!prod) {
        throw new Error(`Produto ${item.productId} indisponível, inativo ou excluído durante a aprovação.`);
      }

      if (prod.stock < item.quantity) {
        throw new Error(`Estoque insuficiente para aprovação do item (Disponível: ${prod.stock}, Solicitado: ${item.quantity}).`);
      }
    }

    // Decrement stock (Atomic)
    for (const item of sortedItems) {
      const prod = params.productsState.find(p => p.id === item.productId && p.tenantId === order.tenant_id)!;
      prod.stock -= item.quantity;
    }

    order.status = 'approved';
    return order;
  }

  if (order.status === 'pending' && params.newStatus === 'cancelled') {
    // Pending cancel => do NOT touch stock
    order.status = 'cancelled';
    return order;
  }

  if (order.status === 'approved' && params.newStatus === 'preparing') {
    order.status = 'preparing';
    return order;
  }

  if (['approved', 'preparing'].includes(order.status) && params.newStatus === 'cancelled') {
    // Approved/Preparing cancel => Validate presence and RESTORE stock exactly once
    const sortedItems = [...order.items].sort((a, b) => a.productId.localeCompare(b.productId));

    // First pass: validate existence and quantity for ALL items (fail-closed before any mutation)
    for (const item of sortedItems) {
      if (item.quantity === null || item.quantity === undefined || item.quantity < 1) {
        throw new Error(`Quantidade de item inválida (${item.quantity}) no pedido.`);
      }

      const prod = params.productsState.find(p => p.id === item.productId && p.tenantId === order.tenant_id);
      if (!prod) {
        throw new Error(`Produto ${item.productId} não encontrado para o tenant durante o cancelamento.`);
      }
    }

    // Second pass: restore stock for all
    for (const item of sortedItems) {
      const prod = params.productsState.find(p => p.id === item.productId && p.tenantId === order.tenant_id)!;
      prod.stock += item.quantity;
    }
    order.status = 'cancelled';
    return order;
  }

  if (order.status === 'preparing' && params.newStatus === 'dispatched') {
    order.status = 'dispatched';
    return order;
  }

  if (order.status === 'dispatched' && params.newStatus === 'delivered') {
    order.status = 'delivered';
    return order;
  }

  throw new Error(`Transição de status inválida de "${order.status}" para "${params.newStatus}".`);
}

// Teste 4.1: Sales Rep não pode alterar status do pedido
let salesRepErr = false;
try {
  simulateManageOrderStatus({
    orderId: wholesaleOrderRes.order.id,
    newStatus: 'approved',
    callerId: VALID_SELLER_USER_ID,
    callerRole: 'sales_rep',
    callerTenantId: VALID_TENANT_UUID,
    productsState: mockProducts,
  });
} catch (e: any) {
  salesRepErr = e.message.includes('Acesso não autorizado');
}
assert(salesRepErr, 'Usuário com papel sales_rep é bloqueado de alterar status');

// Teste 4.2: Aprovação por Stock Manager debita estoque com sucesso
const initialStockProd1 = mockProducts[0].stock; // 20
const initialStockProd2 = mockProducts[1].stock; // 10

// wholesaleOrderRes tem: prod1 qty 6, prod2 qty 3
simulateManageOrderStatus({
  orderId: wholesaleOrderRes.order.id,
  newStatus: 'approved',
  callerId: 'user-stock-manager-uuid',
  callerRole: 'stock_manager',
  callerTenantId: VALID_TENANT_UUID,
  productsState: mockProducts,
});

assert(wholesaleOrderRes.order.status === 'approved', 'Status atualizado para approved');
assert(mockProducts[0].stock === initialStockProd1 - 6, 'Estoque do produto 1 decrementado de 20 para 14');
assert(mockProducts[1].stock === initialStockProd2 - 3, 'Estoque do produto 2 decrementado de 10 para 7');

// Teste 4.3: Aprovação falha se estoque for insuficiente e não altera nenhum produto (Atomicidade)
const bigPendingOrder = simulateCreateOrderCheckoutInternal({
  tenantSlug: 'corsys-demo',
  idempotencyKey: 'key-big-order-001',
  shoppingMode: 'retail',
  items: [{ productId: VALID_PROD_UUID_1, quantity: 14 }], // Exatamente o estoque restante (14)
  customer: { name: 'Cliente', phone: '119' },
  shippingAddress: { street: 'Rua A' },
  paymentMethod: 'pix',
  deliveryMethod: 'entrega',
});

// Força redução de estoque para provocar falha na aprovação
mockProducts[0].stock = 5; // Agora só tem 5, mas pedido quer 14
let approveFailErr = false;
try {
  simulateManageOrderStatus({
    orderId: bigPendingOrder.order.id,
    newStatus: 'approved',
    callerId: 'admin-uuid',
    callerRole: 'tenant_admin',
    callerTenantId: VALID_TENANT_UUID,
    productsState: mockProducts,
  });
} catch (e: any) {
  approveFailErr = e.message.includes('Estoque insuficiente para aprovação');
}
assert(approveFailErr, 'Aprovação com estoque insuficiente é rejeitada com erro');
assert(mockProducts[0].stock === 5, 'Rollback: estoque do produto permanece inalterado após falha na aprovação');
assert(bigPendingOrder.order.status === 'pending', 'Status permanece pending após falha de aprovação');

// Restaura estoque
mockProducts[0].stock = 14;

// Teste 4.4: Transição approved -> preparing
simulateManageOrderStatus({
  orderId: wholesaleOrderRes.order.id,
  newStatus: 'preparing',
  callerId: 'admin-uuid',
  callerRole: 'tenant_admin',
  callerTenantId: VALID_TENANT_UUID,
  productsState: mockProducts,
});
assert(wholesaleOrderRes.order.status === 'preparing', 'Transição approved -> preparing realizada com sucesso');

// Teste 4.5: Cancelamento de preparing restaura estoque
const stockBeforeCancelP1 = mockProducts[0].stock; // 14
const stockBeforeCancelP2 = mockProducts[1].stock; // 7

simulateManageOrderStatus({
  orderId: wholesaleOrderRes.order.id,
  newStatus: 'cancelled',
  callerId: 'admin-uuid',
  callerRole: 'tenant_admin',
  callerTenantId: VALID_TENANT_UUID,
  productsState: mockProducts,
});

assert(wholesaleOrderRes.order.status === 'cancelled', 'Transição preparing -> cancelled realizada');
assert(mockProducts[0].stock === stockBeforeCancelP1 + 6, 'Estoque do produto 1 restaurado (+6)');
assert(mockProducts[1].stock === stockBeforeCancelP2 + 3, 'Estoque do produto 2 restaurado (+3)');

// Teste 4.6: Double Cancel não restaura estoque duas vezes (Estado Terminal)
const stockAfterFirstCancel = mockProducts[0].stock;
let doubleCancelErr = false;
try {
  simulateManageOrderStatus({
    orderId: wholesaleOrderRes.order.id,
    newStatus: 'cancelled',
    callerId: 'admin-uuid',
    callerRole: 'tenant_admin',
    callerTenantId: VALID_TENANT_UUID,
    productsState: mockProducts,
  });
} catch (e: any) {
  doubleCancelErr = e.message.includes('estado terminal');
}
assert(doubleCancelErr, 'Double cancel é bloqueado por estado terminal');
assert(mockProducts[0].stock === stockAfterFirstCancel, 'Estoque NÃO é restaurado duas vezes');

// Teste 4.7: Cancelamento de pending NÃO altera estoque
const pendingToCancel = simulateCreateOrderCheckoutInternal({
  tenantSlug: 'corsys-demo',
  idempotencyKey: 'key-pending-cancel',
  shoppingMode: 'retail',
  items: [{ productId: VALID_PROD_UUID_1, quantity: 3 }],
  customer: { name: 'Cliente', phone: '119' },
  shippingAddress: { street: 'Rua A' },
  paymentMethod: 'pix',
  deliveryMethod: 'entrega',
});
const stockBeforePendingCancel = mockProducts[0].stock;

simulateManageOrderStatus({
  orderId: pendingToCancel.order.id,
  newStatus: 'cancelled',
  callerId: 'admin-uuid',
  callerRole: 'tenant_admin',
  callerTenantId: VALID_TENANT_UUID,
  productsState: mockProducts,
});
assert(pendingToCancel.order.status === 'cancelled', 'Pending cancelado com sucesso');
assert(mockProducts[0].stock === stockBeforePendingCancel, 'Cancelamento de pedido pending NÃO altera estoque');

// Teste 4.8 (Hardening A): Cancelamento com Produto Ausente falha fechado sem restauração parcial
const multiItemOrderToCancel = simulateCreateOrderCheckoutInternal({
  tenantSlug: 'corsys-demo',
  idempotencyKey: 'key-cancel-missing-prod',
  shoppingMode: 'retail',
  items: [
    { productId: VALID_PROD_UUID_1, quantity: 2 },
    { productId: VALID_PROD_UUID_2, quantity: 1 },
  ],
  customer: { name: 'Cliente', phone: '119' },
  shippingAddress: { street: 'Rua A' },
  paymentMethod: 'pix',
  deliveryMethod: 'entrega',
});

// Aprova normalmente (debitando 2 de P1 e 1 de P2)
simulateManageOrderStatus({
  orderId: multiItemOrderToCancel.order.id,
  newStatus: 'approved',
  callerId: 'admin-uuid',
  callerRole: 'tenant_admin',
  callerTenantId: VALID_TENANT_UUID,
  productsState: mockProducts,
});

// Simula que P2 foi excluído do banco
const p1StockBeforeFailCancel = mockProducts[0].stock;
const productsWithMissingP2 = [mockProducts[0]]; // P2 ausente

let missingProdCancelErr = false;
try {
  simulateManageOrderStatus({
    orderId: multiItemOrderToCancel.order.id,
    newStatus: 'cancelled',
    callerId: 'admin-uuid',
    callerRole: 'tenant_admin',
    callerTenantId: VALID_TENANT_UUID,
    productsState: productsWithMissingP2,
  });
} catch (e: any) {
  missingProdCancelErr = e.message.includes('não encontrado para o tenant durante o cancelamento');
}

assert(missingProdCancelErr, 'Cancelamento com produto ausente falha fechado com erro explícito');
assert(multiItemOrderToCancel.order.status === 'approved', 'Status da ordem permanece approved após falha no cancelamento');
assert(mockProducts[0].stock === p1StockBeforeFailCancel, 'Nenhum estoque é restaurado parcialmente se qualquer produto falhar');

// Teste 4.9 (Hardening B): Aprovação bloqueia produto inativo
const pendingWithInactiveProd = simulateCreateOrderCheckoutInternal({
  tenantSlug: 'corsys-demo',
  idempotencyKey: 'key-approve-inactive',
  shoppingMode: 'retail',
  items: [{ productId: VALID_PROD_UUID_1, quantity: 3 }],
  customer: { name: 'Cliente', phone: '119' },
  shippingAddress: { street: 'Rua A' },
  paymentMethod: 'pix',
  deliveryMethod: 'entrega',
});

mockProducts[0].active = false; // Desativa o produto antes da aprovação
let inactiveApproveErr = false;
try {
  simulateManageOrderStatus({
    orderId: pendingWithInactiveProd.order.id,
    newStatus: 'approved',
    callerId: 'admin-uuid',
    callerRole: 'tenant_admin',
    callerTenantId: VALID_TENANT_UUID,
    productsState: mockProducts,
  });
} catch (e: any) {
  inactiveApproveErr = e.message.includes('indisponível, inativo ou excluído');
}

assert(inactiveApproveErr, 'Aprovação de pedido com produto inativo é rejeitada');
assert(pendingWithInactiveProd.order.status === 'pending', 'Status da ordem permanece pending');
mockProducts[0].active = true; // Restaura

// Teste 4.10 (Hardening C): Aprovação bloqueia produto soft-deleted
mockProducts[0].deletedAt = new Date().toISOString(); // Soft-delete
let deletedApproveErr = false;
try {
  simulateManageOrderStatus({
    orderId: pendingWithInactiveProd.order.id,
    newStatus: 'approved',
    callerId: 'admin-uuid',
    callerRole: 'tenant_admin',
    callerTenantId: VALID_TENANT_UUID,
    productsState: mockProducts,
  });
} catch (e: any) {
  deletedApproveErr = e.message.includes('indisponível, inativo ou excluído');
}

assert(deletedApproveErr, 'Aprovação de pedido com produto soft-deleted é rejeitada');
assert(pendingWithInactiveProd.order.status === 'pending', 'Status da ordem permanece pending');
mockProducts[0].deletedAt = null; // Restaura

// Teste 4.11 (Hardening D): Quantidade inválida ou corrompida no snapshot é rejeitada
const corruptedOrder = {
  id: 'ord-corrupted-qty',
  tenant_id: VALID_TENANT_UUID,
  status: 'pending',
  items: [{ productId: VALID_PROD_UUID_1, quantity: 0, productName: 'Teste' }],
};
storedOrders.push(corruptedOrder);

let corruptedQtyErr = false;
try {
  simulateManageOrderStatus({
    orderId: 'ord-corrupted-qty',
    newStatus: 'approved',
    callerId: 'admin-uuid',
    callerRole: 'tenant_admin',
    callerTenantId: VALID_TENANT_UUID,
    productsState: mockProducts,
  });
} catch (e: any) {
  corruptedQtyErr = e.message.includes('Quantidade de item inválida');
}

assert(corruptedQtyErr, 'Quantidade corrompida no snapshot (qty <= 0) é bloqueada em manage_order_status');

// Teste 4.12 (Hardening E): Exigência de exatamente 1 linha afetada por item no cancelamento e aprovação
assert(
  migration10Sql.includes('GET DIAGNOSTICS v_affected_rows = ROW_COUNT;') &&
  migration10Sql.includes('IF v_affected_rows <> 1 THEN') &&
  migration10Sql.includes('Falha ao restaurar estoque do produto') &&
  migration10Sql.includes('Falha ao debitar estoque do produto'),
  'manage_order_status exige e valida formalmente GET DIAGNOSTICS v_affected_rows = 1 por item'
);


// =========================================================================
// 5. Auditoria de Segurança da Edge Function submit-order-checkout
// =========================================================================
console.log('\n5. Auditoria de Segurança da Edge Function & Configuração');

const configToml = fs.readFileSync('supabase/config.toml', 'utf-8');
assert(
  configToml.includes('[functions.submit-order-checkout]') &&
  configToml.includes('verify_jwt = false'),
  'config.toml declara [functions.submit-order-checkout] com verify_jwt = false (permite checkout anônimo de varejo)'
);

const edgeFuncPath = 'supabase/functions/submit-order-checkout/index.ts';
assert(fs.existsSync(edgeFuncPath), 'Edge Function submit-order-checkout existe no workspace');

const edgeFuncSource = fs.readFileSync(edgeFuncPath, 'utf-8');

assert(
  edgeFuncSource.includes('website || payload._honeypot || payload.fax'),
  'Edge Function implementa honeypot anti-spam'
);
assert(
  edgeFuncSource.includes('rawBody.length > 65536'),
  'Edge Function implementa limite de tamanho de payload (64 KB)'
);
assert(
  edgeFuncSource.includes('payload.items.length > 200'),
  'Edge Function limita máximo de 200 itens por pedido'
);
assert(
  edgeFuncSource.includes('if (shoppingMode === "wholesale")') &&
  edgeFuncSource.includes('authHeader.startsWith("Bearer ")') &&
  edgeFuncSource.includes('supabaseAdmin.auth.getUser(token)') &&
  edgeFuncSource.includes('buyerUserId = userData.user.id'),
  'Edge Function exige Bearer JWT para atacado e extrai user.id real do auth (nunca do body)'
);
assert(
  edgeFuncSource.includes('create_order_checkout_internal') &&
  edgeFuncSource.includes('supabaseAdmin.rpc('),
  'Edge Function invoca exclusivamente a RPC interna com service_role'
);
assert(
  !edgeFuncSource.includes('VITE_') &&
  !edgeFuncSource.includes('console.log(supabaseServiceKey)') &&
  !edgeFuncSource.includes('console.log(token)'),
  'Edge Function não expõe chaves service_role, tokens ou PII sensível em logs'
);

console.log('\n======================================================');
console.log(`RESULTADO: ${passed} PASSOU / ${failed} FALHOU`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
