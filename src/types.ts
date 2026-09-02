export type UserRole = 'superadmin' | 'tenant_admin' | 'sales_rep' | 'stock_manager' | 'b2b_client';

export type PlanType = 'starter' | 'pro' | 'enterprise';

export interface TenantPlan {
  id: PlanType;
  name: string;
  priceMonthly: number;
  maxProducts: number;
  maxUsers: number;
  maxMonthlyOrders: number;
  features: string[];
  customDomainAllowed: boolean;
  b2bPortalAllowed: boolean;
  commissionTracking: boolean;
}

export interface TenantUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  phone?: string;
  sellerCode?: string;
  commissionRate?: number; // e.g. 5%
  permissions: {
    canEditProducts: boolean;
    canViewCostPrice: boolean;
    canManageOrders: boolean;
    canAccessSettings: boolean;
    canManageTeam: boolean;
    canExportData: boolean;
  };
  status: 'active' | 'pending' | 'blocked';
  createdAt: string;
}

export interface WholesaleTier {
  minQuantity: number;
  price: number;
  discountPercentage?: number;
}

export interface ProductVariant {
  id: string;
  name: string; // e.g. "Tamanho", "Cor", "Voltagem"
  options: string[]; // ["P", "M", "G"]
}

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  subcategory?: string;
  brand?: string;
  description: string;
  costPrice?: number; // Custo (visível apenas para admins)
  price: number; // Preço Varejo
  promotionalPrice?: number; // Preço promocional
  wholesalePrice?: number; // Preço Atacado base
  wholesaleTiers?: WholesaleTier[]; // Descontos por escala
  minOrderQuantity: number; // Qtd mínima de compra
  stock: number;
  unit: string; // 'un', 'cx', 'pct', 'kg', 'dz', 'par'
  images: string[];
  featured?: boolean;
  isNew?: boolean;
  active: boolean;
  tags?: string[];
  weightKg?: number;
  dimensions?: {
    height: number;
    width: number;
    depth: number;
  };
}

export interface TenantCustomization {
  businessName: string;
  tradeName?: string; // Nome fantasia
  cnpjCpf?: string;
  segment: string;
  slug: string; // e.g. 'mc-distribuicao'
  customDomain?: string; // e.g. 'catalogo.mcdistribuicao.com.br'
  logoUrl: string;
  bannerUrl: string;
  primaryColor: string;
  accentColor: string;
  whatsappNumber: string; // 5511999999999
  emailContact: string;
  address?: string;
  cityState?: string;
  pixKey?: string;
  pixKeyType?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  minOrderValue: number;
  allowB2BMode: boolean; // Ativa grade de pedidos rápida
  hidePricesWithoutLogin: boolean; // Exigir login para ver preços atacado
  enableResendEmail: boolean;
  resendApiKey?: string;
  resendSenderEmail?: string;
  deliveryMethods: {
    pickup: boolean;
    carrierDelivery: boolean;
    fixedFreight: boolean;
    fixedFreightValue?: number;
    freeFreightThreshold?: number;
  };
  announcementText?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  ownerName: string;
  ownerPhone: string;
  plan: PlanType;
  status: 'active' | 'trial' | 'suspended' | 'canceled';
  createdAt: string;
  trialExpiresAt?: string;
  customization: TenantCustomization;
  stats: {
    totalProducts: number;
    totalOrders: number;
    totalRevenue: number;
    monthVisits: number;
  };
}

export interface OrderItem {
  productId: string;
  productName: string;
  productSku: string;
  productImage: string;
  unitPrice: number;
  quantity: number;
  unit: string;
  totalPrice: number;
  selectedVariant?: string;
}

export type OrderStatus = 'pending' | 'approved' | 'preparing' | 'dispatched' | 'delivered' | 'cancelled';
export type PaymentMethod = 'pix' | 'boleto' | 'credit_card' | 'on_delivery' | 'negotiate';

export interface Order {
  id: string;
  orderNumber: string;
  tenantId: string;
  sellerId?: string;
  sellerCode?: string;
  customer: {
    name: string;
    document?: string; // CPF ou CNPJ
    email: string;
    phone: string;
    companyName?: string;
    type: 'PF' | 'PJ';
  };
  shippingAddress: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  source: 'whatsapp' | 'web_checkout' | 'sales_rep';
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedVariant?: string;
  unitPrice: number;
}
