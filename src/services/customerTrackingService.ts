/**
 * Serviço de Acompanhamento Seguro de Pedidos pelo Cliente (Customer Order Tracking V1)
 *
 * ARQUITETURA DE ACESSO:
 * 1. Retail Anônimo:
 *    - Rastreamento seguro via token criptográfico de 256 bits (64 hex lowercase).
 *    - O token é armazenado no cliente (localStorage) apenas como par { orderNumber, trackingToken }.
 *    - Invocação da Edge Function 'track-order-by-token' que valida o hash SHA-256 no backend.
 *    - ZERO consulta exposta por CPF, e-mail, telefone ou order_number desprotegido.
 *
 * 2. Atacado (B2B) Autenticado:
 *    - Listagem autenticada dos pedidos do próprio comprador logado.
 *    - Invocação da Edge Function 'list-my-customer-orders' que valida o token JWT e consulta buyer_user_id.
 *    - Suporte a paginação segura (limit/offset).
 */

import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { PaymentMethod } from '../types';

export interface CustomerTrackedOrderItem {
  productId: string;
  productName: string;
  productSku: string;
  productImage: string;
  unitPrice: number;
  quantity: number;
  unit: string;
  totalPrice: number;
  selectedVariant?: string | null;
}

export interface CustomerTrackedOrder {
  id: string;
  orderNumber: string;
  status: 'pending' | 'approved' | 'preparing' | 'dispatched' | 'delivered' | 'cancelled';
  shoppingMode: 'retail' | 'wholesale';
  deliveryMethod: string;
  paymentMethod: PaymentMethod;
  items: CustomerTrackedOrderItem[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  customerName?: string | null;
  shippingAddress: {
    street: string;
    number?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CustomerOrderListResult {
  orders: CustomerTrackedOrder[];
  total: number;
  limit: number;
  offset: number;
}

export interface StoredRetailOrderTracking {
  orderNumber: string;
  trackingToken: string;
  tenantSlug: string;
  createdAt: string;
}

const RETAIL_TRACKING_STORAGE_KEY = 'corsys_customer_retail_orders_v1';

/**
 * Lê pedidos de varejo salvos localmente no dispositivo para rastreamento
 */
export function getStoredRetailTrackings(): StoredRetailOrderTracking[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(RETAIL_TRACKING_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => 
      item &&
      typeof item.orderNumber === 'string' &&
      typeof item.trackingToken === 'string' &&
      /^[a-f0-9]{64}$/i.test(item.trackingToken)
    );
  } catch {
    return [];
  }
}

/**
 * Salva novo par { orderNumber, trackingToken } de varejo após checkout bem-sucedido
 */
export function storeRetailOrderTracking(item: StoredRetailOrderTracking): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const current = getStoredRetailTrackings();
    const filtered = current.filter(t => t.orderNumber !== item.orderNumber);
    const updated = [item, ...filtered].slice(0, 50); // Mantém últimos 50 pedidos locais
    window.localStorage.setItem(RETAIL_TRACKING_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silencioso em caso de restrição de storage
  }
}

/**
 * Remove rastreamento local de um pedido
 */
export function removeStoredRetailTracking(orderNumber: string): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const current = getStoredRetailTrackings();
    const updated = current.filter(t => t.orderNumber !== orderNumber);
    window.localStorage.setItem(RETAIL_TRACKING_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silencioso
  }
}

/**
 * Consulta pedido seguro por token de varejo via Edge Function 'track-order-by-token'
 */
export async function trackOrderByToken(tenantSlug: string, trackingToken: string): Promise<CustomerTrackedOrder> {
  if (!isSupabaseConfigured()) {
    throw new Error('Serviço de rastreamento temporariamente indisponível.');
  }

  const cleanToken = trackingToken.trim();
  if (!/^[a-f0-9]{64}$/i.test(cleanToken)) {
    throw new Error('Token de rastreamento inválido (deve conter 64 caracteres hexadecimais).');
  }

  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke('track-order-by-token', {
    body: {
      tenantSlug: tenantSlug.trim(),
      trackingToken: cleanToken.toLowerCase(),
    },
  });

  if (error) {
    const message = error.message || 'Não foi possível localizar o pedido.';
    throw new Error(message);
  }

  if (!data?.success || !data?.order) {
    throw new Error(data?.error || 'Pedido não encontrado.');
  }

  return data.order as CustomerTrackedOrder;
}

/**
 * Lista pedidos do comprador B2B autenticado via Edge Function 'list-my-customer-orders'
 */
export async function listMyCustomerOrders(
  tenantSlug: string,
  pagination?: { limit?: number; offset?: number }
): Promise<CustomerOrderListResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('Serviço de histórico de pedidos temporariamente indisponível.');
  }

  const client = getSupabaseClient();
  const { data: sessionData } = await client.auth.getSession();
  const session = sessionData?.session;

  if (!session || !session.access_token) {
    throw new Error('Faça login para visualizar seus pedidos de atacado.');
  }

  const { data, error } = await client.functions.invoke('list-my-customer-orders', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: {
      tenantSlug: tenantSlug.trim(),
      limit: pagination?.limit ?? 20,
      offset: pagination?.offset ?? 0,
    },
  });

  if (error) {
    const message = error.message || 'Erro ao carregar histórico de pedidos.';
    throw new Error(message);
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Erro ao carregar histórico de pedidos.');
  }

  return {
    orders: data.orders || [],
    total: data.total || 0,
    limit: data.limit || 20,
    offset: data.offset || 0,
  };
}
