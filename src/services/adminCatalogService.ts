/**
 * Serviço administrativo oficial de catálogo via Supabase.
 * 
 * DIRETRIZES DA ETAPA 5C:
 * 1. Utilizado EXCLUSIVAMENTE por usuários autenticados (tenant_admin) no Painel da Loja.
 * 2. Consulta a tabela 'public.products' protegida por RLS e filtrada pelo tenant_id autenticado.
 * 3. Projeção estrita e explícita de colunas administrativas (inclui cost_price para tenant_admin).
 * 4. Preserva valores NULL (ex: wholesale_price = null permanece null, não 0).
 * 5. Não oculta produtos com stock = 0.
 * 6. Não faz merge com dados mock e não utiliza fallback para INITIAL_PRODUCTS ou localStorage.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Product } from '../types';

export interface RawAdminProductRow {
  id: string;
  tenant_id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  subcategory: string | null;
  brand: string | null;
  description: string | null;
  technical_specs: Record<string, unknown> | null;
  cost_price?: number | string | null;
  price: number | string;
  promotional_price: number | string | null;
  wholesale_price: number | string | null;
  min_order_quantity: number | string;
  stock: number | string;
  unit: string | null;
  images: string[] | null;
  featured: boolean | null;
  is_new: boolean | null;
  active: boolean;
  sort_order: number | string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Adapter: converte registro snake_case da tabela products para Product tipado no contexto administrativo.
 * DIRETRIZES DA ETAPA 5C:
 * - wholesaleTiers: [] fornecido estritamente para compatibilidade com o tipo frontend 'Product'. O catálogo oficial não possui faixas escalonadas; não é dado inferido nem regra comercial.
 * - wholesale_price é o preço simples de atacado importado do banco.
 * - min_order_quantity é mantido como o valor inteiro do banco (1) sem inferência de regra B2B.
 * - category e unit são preservados estritamente como retornados do banco.
 * - images preserva o array retornado (vazio [] na importação oficial atual).
 */
export function adaptAdminProduct(row: RawAdminProductRow): Product {
  const price = typeof row.price === 'number' ? row.price : Number(row.price) || 0;
  
  const promotionalPrice = row.promotional_price !== null && row.promotional_price !== undefined
    ? (typeof row.promotional_price === 'number' ? row.promotional_price : Number(row.promotional_price))
    : null;
    
  const wholesalePrice = row.wholesale_price !== null && row.wholesale_price !== undefined
    ? (typeof row.wholesale_price === 'number' ? row.wholesale_price : Number(row.wholesale_price))
    : null;

  const costPrice = row.cost_price !== null && row.cost_price !== undefined
    ? (typeof row.cost_price === 'number' ? row.cost_price : Number(row.cost_price))
    : null;

  const stock = typeof row.stock === 'number' ? row.stock : Number(row.stock) || 0;
  const minOrderQuantity = typeof row.min_order_quantity === 'number' ? row.min_order_quantity : Number(row.min_order_quantity) || 1;
  const sortOrder = typeof row.sort_order === 'number' ? row.sort_order : Number(row.sort_order) || 0;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode || null,
    category: row.category,
    subcategory: row.subcategory || null,
    brand: row.brand || null,
    description: row.description || '',
    technicalSpecs: row.technical_specs || {},
    costPrice,
    price,
    promotionalPrice,
    wholesalePrice,
    wholesaleTiers: [], // Compatibilidade estrita de tipagem (Product); sem faixas cadastradas no catálogo oficial
    minOrderQuantity,
    stock,
    unit: row.unit || 'un',
    images: Array.isArray(row.images) ? row.images.filter(Boolean) : [],
    featured: Boolean(row.featured),
    isNew: Boolean(row.is_new),
    active: Boolean(row.active),
    sortOrder,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Consulta a lista completa de produtos administrativos de um tenant a partir de public.products.
 * DIRETRIZES DE SEGURANÇA E AUTORIZAÇÃO:
 * - Operação exclusiva para tenant_admin autenticado.
 * - Projeta colunas administrativas completas incluindo cost_price.
 * - FAIL-CLOSED: Não mascara erros de autorização (ex: 42501, 401, 403) com consultas públicas parciais.
 * - Não recorre a catalog_products, mocks ou localStorage.
 * - Em caso de erro, lança exceção explícita para que a UI apresente o estado de Error / Retry.
 */
export async function fetchAdminProducts(tenantId: string): Promise<Product[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado. Verifique as credenciais no ambiente.');
  }

  if (!tenantId) {
    throw new Error('Tenant ID não fornecido para consulta administrativa de produtos.');
  }

  // Consulta estrita com projeção administrativa completa (incluindo cost_price)
  const { data: productsData, error: productsError } = await supabase
    .from('products')
    .select('id, tenant_id, sku, barcode, name, category, subcategory, brand, description, technical_specs, cost_price, price, promotional_price, wholesale_price, min_order_quantity, stock, unit, images, featured, is_new, active, sort_order, created_at, updated_at, deleted_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (productsError) {
    throw new Error(`Falha ao carregar catálogo administrativo do Supabase: [${productsError.code || 'AUTH'}] ${productsError.message}`);
  }

  return (productsData || []).map(row => adaptAdminProduct(row as RawAdminProductRow));
}
