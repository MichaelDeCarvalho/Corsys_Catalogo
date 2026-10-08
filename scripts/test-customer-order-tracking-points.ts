/**
 * TEST SUITE: CUSTOMER ORDER TRACKING V1 (ITEM 3)
 *
 * Cobertura Completa:
 * 1. Migration 000015 (Schema public.orders: buyer_user_id, tracking_token_hash, check constraint, índices)
 * 2. RPCs Internas de Rastreamento (create_order_checkout_internal, track_order_by_token_internal, list_my_customer_orders_internal)
 * 3. Menor Privilégio & RBAC (Zero SELECT anon em orders, RPCs restritas a service_role)
 * 4. Edge Functions (track-order-by-token e list-my-customer-orders)
 * 5. submit-order-checkout (geração de trackingToken de 256 bits, SHA-256 e persistência)
 * 6. Frontend Service & Storage (customerTrackingService, localStorage sanitizado, validação de token)
 * 7. Frontend Integration & UI (CustomerOrderTrackingView, Header navigation, CartDrawer tracking persistence)
 */

import * as fs from 'fs';
import { 
  getStoredRetailTrackings, 
  storeRetailOrderTracking, 
  removeStoredRetailTracking 
} from '../src/services/customerTrackingService';
import { validateReceipt } from '../src/services/orderService';

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

console.log('======================================================');
console.log('TEST SUITE: CUSTOMER ORDER TRACKING V1 (ITEM 3)');
console.log('======================================================\n');

// 1. Arquivos de Migração e Banco de Dados
console.log('1. Auditoria de Migration 000015');

const migration15Path = 'supabase/migrations/20261008_000015_customer_order_tracking.sql';
assert(fs.existsSync(migration15Path), 'Migration 000015 existe no repositório');

const migration15Sql = fs.readFileSync(migration15Path, 'utf-8');

assert(
  migration15Sql.includes('buyer_user_id UUID NULL REFERENCES auth.users(id)') &&
  migration15Sql.includes('ON DELETE SET NULL'),
  '1.1 Coluna buyer_user_id adicionada com FK auth.users(id) e ON DELETE SET NULL'
);

assert(
  migration15Sql.includes('tracking_token_hash TEXT NULL') &&
  migration15Sql.includes("tracking_token_hash ~ '^[a-f0-9]{64}$'"),
  '1.2 Coluna tracking_token_hash com CHECK constraint estrito de 64 caracteres hex (SHA-256)'
);

assert(
  migration15Sql.includes('CREATE INDEX IF NOT EXISTS idx_orders_buyer_lookup') &&
  migration15Sql.includes('(tenant_id, buyer_user_id, created_at DESC)') &&
  migration15Sql.includes('WHERE buyer_user_id IS NOT NULL'),
  '1.3 Índice parcial idx_orders_buyer_lookup (tenant_id, buyer_user_id, created_at DESC) criado'
);

assert(
  migration15Sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_tracking_token_hash') &&
  migration15Sql.includes('WHERE tracking_token_hash IS NOT NULL'),
  '1.4 Índice UNIQUE uq_orders_tracking_token_hash parcial criado'
);

assert(
  migration15Sql.includes('CREATE OR REPLACE FUNCTION public.create_order_checkout_internal') &&
  migration15Sql.includes('p_shopping_mode = \'wholesale\'') &&
  migration15Sql.includes('v_persisted_buyer_user_id := p_buyer_user_id;') &&
  migration15Sql.includes('v_persisted_buyer_user_id := NULL;'),
  '1.5 create_order_checkout_internal persiste buyer_user_id somente quando wholesale e NULL para retail'
);

assert(
  migration15Sql.includes('CREATE OR REPLACE FUNCTION public.track_order_by_token_internal') &&
  migration15Sql.includes('SECURITY DEFINER') &&
  migration15Sql.includes('REVOKE ALL ON FUNCTION public.track_order_by_token_internal(TEXT, TEXT) FROM PUBLIC, anon, authenticated;') &&
  migration15Sql.includes('GRANT EXECUTE ON FUNCTION public.track_order_by_token_internal(TEXT, TEXT) TO service_role;'),
  '1.6 track_order_by_token_internal criada com SECURITY DEFINER e restrita a service_role'
);

assert(
  migration15Sql.includes('CREATE OR REPLACE FUNCTION public.list_my_customer_orders_internal') &&
  migration15Sql.includes('SECURITY DEFINER') &&
  migration15Sql.includes('REVOKE ALL ON FUNCTION public.list_my_customer_orders_internal(TEXT, UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;') &&
  migration15Sql.includes('GRANT EXECUTE ON FUNCTION public.list_my_customer_orders_internal(TEXT, UUID, INTEGER, INTEGER) TO service_role;'),
  '1.7 list_my_customer_orders_internal criada com SECURITY DEFINER e restrita a service_role'
);

assert(
  !migration15Sql.includes('CREATE POLICY') &&
  !migration15Sql.includes('FOR SELECT TO anon') &&
  !migration15Sql.includes('FOR SELECT TO public'),
  '1.8 Nenhuma política RLS pública ou permissão de SELECT direto em orders para anon'
);

assert(
  migration15Sql.includes('CREATE OR REPLACE FUNCTION public.set_order_tracking_token_internal') &&
  migration15Sql.includes('p_tracking_token_hash ~ \'^[a-f0-9]{64}$\'') &&
  migration15Sql.includes('o.shopping_mode = \'retail\'') &&
  migration15Sql.includes('FOR UPDATE') &&
  migration15Sql.includes('REVOKE ALL ON FUNCTION public.set_order_tracking_token_internal(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;') &&
  migration15Sql.includes('GRANT EXECUTE ON FUNCTION public.set_order_tracking_token_internal(UUID, UUID, TEXT) TO service_role;'),
  '1.9 set_order_tracking_token_internal criada com SECURITY DEFINER, FOR UPDATE e restrita a service_role'
);

// 2. Edge Functions
console.log('\n2. Auditoria de Edge Functions');

const configTomlPath = 'supabase/config.toml';
assert(fs.existsSync(configTomlPath), '2.0 supabase/config.toml existe');
const configTomlContent = fs.readFileSync(configTomlPath, 'utf-8');

assert(
  configTomlContent.includes('[functions.track-order-by-token]') &&
  configTomlContent.includes('[functions.list-my-customer-orders]'),
  '2.0b config.toml declara explicitamente track-order-by-token e list-my-customer-orders'
);

const trackOrderFunctionPath = 'supabase/functions/track-order-by-token/index.ts';
assert(fs.existsSync(trackOrderFunctionPath), '2.1 Edge Function track-order-by-token existe');
const trackOrderFunctionCode = fs.readFileSync(trackOrderFunctionPath, 'utf-8');

assert(
  trackOrderFunctionCode.includes('HEX_64_REGEX') &&
  trackOrderFunctionCode.includes('crypto.subtle.digest("SHA-256"') &&
  trackOrderFunctionCode.includes('track_order_by_token_internal'),
  '2.2 track-order-by-token valida regex de 64 hex, calcula SHA-256 e chama RPC interna'
);

const listCustomerOrdersPath = 'supabase/functions/list-my-customer-orders/index.ts';
assert(fs.existsSync(listCustomerOrdersPath), '2.3 Edge Function list-my-customer-orders existe');
const listCustomerOrdersCode = fs.readFileSync(listCustomerOrdersPath, 'utf-8');

assert(
  listCustomerOrdersCode.includes('auth.getUser(token)') &&
  listCustomerOrdersCode.includes('list_my_customer_orders_internal') &&
  listCustomerOrdersCode.includes('buyerUserId = userData.user.id'),
  '2.4 list-my-customer-orders valida JWT via auth.getUser e extrai buyerUserId server-side'
);

const submitOrderPath = 'supabase/functions/submit-order-checkout/index.ts';
const submitOrderCode = fs.readFileSync(submitOrderPath, 'utf-8');

assert(
  submitOrderCode.includes('crypto.getRandomValues(rawBytes)') &&
  submitOrderCode.includes('crypto.subtle.digest("SHA-256"') &&
  submitOrderCode.includes('set_order_tracking_token_internal') &&
  !submitOrderCode.includes('.from("orders").update({ tracking_token_hash') &&
  submitOrderCode.includes('trackingToken: trackingToken || undefined'),
  '2.5 submit-order-checkout gera token aleatório de 256 bits, vincula via RPC interna e retorna trackingToken no receipt'
);

// 3. Frontend Services & Storage
console.log('\n3. Frontend Services & Storage');

const customerTrackingServicePath = 'src/services/customerTrackingService.ts';
assert(fs.existsSync(customerTrackingServicePath), '3.1 customerTrackingService.ts existe');
const customerTrackingCode = fs.readFileSync(customerTrackingServicePath, 'utf-8');

assert(
  customerTrackingCode.includes('trackOrderByToken') &&
  customerTrackingCode.includes('listMyCustomerOrders') &&
  customerTrackingCode.includes('getStoredRetailTrackings') &&
  customerTrackingCode.includes('storeRetailOrderTracking'),
  '3.2 customerTrackingService implementa funções para retail (token) e wholesale (autenticado)'
);

// Teste de validação de receipt com trackingToken
const sampleReceiptPayload = {
  success: true,
  order: {
    id: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d',
    orderNumber: 'PED-20261008-000001',
    shoppingMode: 'retail',
    deliveryMethod: 'Retirada',
    items: [
      {
        productId: '11111111-1111-4111-8111-111111111111',
        productName: 'Produto Teste',
        productSku: 'SKU-001',
        productImage: 'https://example.com/img.jpg',
        unitPrice: 50.0,
        quantity: 2,
        unit: 'un',
        totalPrice: 100.0,
        selectedVariant: null
      }
    ],
    subtotal: 100.0,
    discount: 0.0,
    shippingFee: 0.0,
    total: 100.0,
    status: 'pending',
    paymentMethod: 'pix',
    createdAt: new Date().toISOString(),
    trackingToken: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'
  }
};

const validated = validateReceipt(sampleReceiptPayload);
assert(
  validated.trackingToken === 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
  '3.3 validateReceipt valida e preserva trackingToken no recibo oficial'
);

// 4. Componentes UI & Integração
console.log('\n4. Componentes UI & Integração');

const trackingViewPath = 'src/components/storefront/CustomerOrderTrackingView.tsx';
assert(fs.existsSync(trackingViewPath), '4.1 CustomerOrderTrackingView.tsx existe no workspace');

const trackingViewCode = fs.readFileSync(trackingViewPath, 'utf-8');
assert(
  trackingViewCode.includes('Acompanhar Meus Pedidos') &&
  trackingViewCode.includes('Atacado B2B') &&
  trackingViewCode.includes('Pedidos Recentes de Varejo') &&
  trackingViewCode.includes('Rastrear por Código Seguro'),
  '4.2 CustomerOrderTrackingView possui abas B2B e Varejo e campo de rastreamento por token'
);

const headerCode = fs.readFileSync('src/components/layout/Header.tsx', 'utf-8');
assert(
  headerCode.includes('id="header-my-orders-button"') &&
  headerCode.includes('Meus Pedidos') &&
  headerCode.includes("setViewMode('my_orders')"),
  '4.3 Header possui botão "Meus Pedidos" que alterna para viewMode my_orders'
);

const appCode = fs.readFileSync('src/App.tsx', 'utf-8');
assert(
  appCode.includes("viewMode === 'my_orders'") &&
  appCode.includes('<CustomerOrderTrackingView />'),
  '4.4 App.tsx renderiza CustomerOrderTrackingView sob viewMode my_orders'
);

const cartDrawerCode = fs.readFileSync('src/components/storefront/CartDrawer.tsx', 'utf-8');
assert(
  cartDrawerCode.includes('storeRetailOrderTracking') &&
  cartDrawerCode.includes('receipt.trackingToken'),
  '4.5 CartDrawer salva par { orderNumber, trackingToken } no localStorage ao concluir checkout retail'
);

console.log('\n======================================================');
console.log(`TOTAL DE TESTES ITEM 3: ${passed + failed}`);
console.log(`PASSOU: ${passed}`);
console.log(`FALHOU: ${failed}`);
console.log('======================================================');

if (failed > 0) {
  process.exit(1);
}
