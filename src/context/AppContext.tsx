import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Tenant, 
  Product, 
  TenantUser, 
  Order, 
  CartItem, 
  UserRole, 
  PlanType,
  OrderStatus,
  TenantCustomization
} from '../types';
import { 
  INITIAL_TENANTS, 
  INITIAL_PRODUCTS, 
  INITIAL_USERS, 
  INITIAL_ORDERS,
  SAAS_PLANS 
} from '../data/initialData';

export type AppViewMode = 'superadmin' | 'tenant_admin' | 'storefront' | 'blueprint_guide';

interface AppContextType {
  viewMode: AppViewMode;
  setViewMode: (mode: AppViewMode) => void;
  
  // Current Tenant
  currentTenantId: string;
  setCurrentTenantId: (id: string) => void;
  currentTenant: Tenant;
  tenants: Tenant[];
  addTenant: (tenantData: Omit<Tenant, 'id' | 'createdAt' | 'stats'>) => Tenant;
  updateTenant: (id: string, updates: Partial<Tenant>) => void;
  updateTenantCustomization: (id: string, customization: Partial<TenantCustomization>) => void;
  deleteTenant: (id: string) => void;

  // Products
  products: Product[];
  currentTenantProducts: Product[];
  addProduct: (productData: Omit<Product, 'id'>) => Product;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  toggleProductStatus: (id: string) => void;

  // Orders
  orders: Order[];
  currentTenantOrders: Order[];
  createOrder: (orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>) => Order;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  deleteOrder: (orderId: string) => void;

  // Team & RBAC
  users: TenantUser[];
  currentTenantUsers: TenantUser[];
  currentUser: TenantUser | null;
  setCurrentUser: (user: TenantUser | null) => void;
  addUser: (userData: Omit<TenantUser, 'id' | 'createdAt'>) => TenantUser;
  updateUser: (id: string, updates: Partial<TenantUser>) => void;
  deleteUser: (id: string) => void;

  // Cart (for Storefront)
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, selectedVariant?: string) => void;
  updateCartQuantity: (productId: string, quantity: number, selectedVariant?: string) => void;
  removeFromCart: (productId: string, selectedVariant?: string) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  cartSubtotal: number;
  cartItemsCount: number;

  // Toast / Feedback
  toastMessage: string | null;
  showToast: (msg: string) => void;

  // Filter / Search in Storefront
  storefrontSearch: string;
  setStorefrontSearch: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  b2bQuickMode: boolean;
  setB2bQuickMode: (b2b: boolean) => void;

  // Reset to Demo Data
  resetToDefaultData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'omnicatalogo_saas_data_v3';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [viewMode, setViewMode] = useState<AppViewMode>('tenant_admin');
  const [currentTenantId, setCurrentTenantId] = useState<string>('tenant-mc-distribuicao');
  
  // State lists
  const [tenants, setTenants] = useState<Tenant[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_tenants`);
      return saved ? JSON.parse(saved) : INITIAL_TENANTS;
    } catch {
      return INITIAL_TENANTS;
    }
  });

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_products`);
      return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_orders`);
      return saved ? JSON.parse(saved) : INITIAL_ORDERS;
    } catch {
      return INITIAL_ORDERS;
    }
  });

  const [users, setUsers] = useState<TenantUser[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_users`);
      return saved ? JSON.parse(saved) : INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  });

  // Current logged-in user in the context of the active tenant
  const [currentUser, setCurrentUser] = useState<TenantUser | null>(null);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Storefront search & filters
  const [storefrontSearch, setStorefrontSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [b2bQuickMode, setB2bQuickMode] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4000);
  };

  // Sync to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_tenants`, JSON.stringify(tenants));
    } catch (e) {
      console.warn('Storage save failed', e);
    }
  }, [tenants]);

  useEffect(() => {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_products`, JSON.stringify(products));
    } catch (e) {
      console.warn('Storage save failed', e);
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_orders`, JSON.stringify(orders));
    } catch (e) {
      console.warn('Storage save failed', e);
    }
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_users`, JSON.stringify(users));
    } catch (e) {
      console.warn('Storage save failed', e);
    }
  }, [users]);

  // Derived current tenant
  const currentTenant = tenants.find(t => t.id === currentTenantId) || tenants[0] || INITIAL_TENANTS[0];

  // Set default current user when tenant changes
  useEffect(() => {
    const tenantUser = users.find(u => u.tenantId === currentTenantId && u.role === 'tenant_admin');
    if (tenantUser) {
      setCurrentUser(tenantUser);
    } else {
      const anyUser = users.find(u => u.tenantId === currentTenantId);
      setCurrentUser(anyUser || null);
    }
    // clear cart on tenant switch
    setCart([]);
  }, [currentTenantId, users]);

  // Tenant filtered items
  const currentTenantProducts = products.filter(p => p.tenantId === currentTenantId);
  const currentTenantOrders = orders.filter(o => o.tenantId === currentTenantId);
  const currentTenantUsers = users.filter(u => u.tenantId === currentTenantId);

  // Cart operations
  const addToCart = (product: Product, quantity = 1, selectedVariant?: string) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(item => 
        item.product.id === product.id && item.selectedVariant === selectedVariant
      );
      
      const newQty = existingIndex > -1 ? prev[existingIndex].quantity + quantity : quantity;
      
      // Calculate unit price based on wholesale tiers if applicable
      let applicablePrice = product.promotionalPrice || product.price;
      if (product.wholesaleTiers && product.wholesaleTiers.length > 0) {
        const sortedTiers = [...product.wholesaleTiers].sort((a, b) => b.minQuantity - a.minQuantity);
        const matchTier = sortedTiers.find(tier => newQty >= tier.minQuantity);
        if (matchTier) {
          applicablePrice = matchTier.price;
        } else if (product.wholesalePrice && newQty >= product.minOrderQuantity) {
          applicablePrice = product.wholesalePrice;
        }
      }

      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          unitPrice: applicablePrice
        };
        return updated;
      } else {
        return [...prev, {
          product,
          quantity: newQty,
          selectedVariant,
          unitPrice: applicablePrice
        }];
      }
    });

    showToast(`Adicionado ao carrinho: ${product.name.slice(0, 30)}...`);
  };

  const updateCartQuantity = (productId: string, quantity: number, selectedVariant?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, selectedVariant);
      return;
    }

    setCart(prev => prev.map(item => {
      if (item.product.id === productId && item.selectedVariant === selectedVariant) {
        // Re-evaluate tiered pricing
        let applicablePrice = item.product.promotionalPrice || item.product.price;
        if (item.product.wholesaleTiers && item.product.wholesaleTiers.length > 0) {
          const sortedTiers = [...item.product.wholesaleTiers].sort((a, b) => b.minQuantity - a.minQuantity);
          const matchTier = sortedTiers.find(tier => quantity >= tier.minQuantity);
          if (matchTier) {
            applicablePrice = matchTier.price;
          }
        }
        return { ...item, quantity, unitPrice: applicablePrice };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string, selectedVariant?: string) => {
    setCart(prev => prev.filter(item => 
      !(item.product.id === productId && item.selectedVariant === selectedVariant)
    ));
  };

  const clearCart = () => setCart([]);

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Tenant Handlers
  const addTenant = (tenantData: Omit<Tenant, 'id' | 'createdAt' | 'stats'>): Tenant => {
    const newId = `tenant-${tenantData.slug.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;
    const newTenant: Tenant = {
      ...tenantData,
      id: newId,
      createdAt: new Date().toISOString(),
      stats: {
        totalProducts: 0,
        totalOrders: 0,
        totalRevenue: 0,
        monthVisits: 10
      }
    };

    setTenants(prev => [newTenant, ...prev]);

    // Create default owner user for this tenant
    const defaultUser: TenantUser = {
      id: `user-${newId}-owner`,
      tenantId: newId,
      name: tenantData.ownerName,
      email: tenantData.ownerEmail,
      role: 'tenant_admin',
      phone: tenantData.ownerPhone,
      permissions: {
        canEditProducts: true,
        canViewCostPrice: true,
        canManageOrders: true,
        canAccessSettings: true,
        canManageTeam: true,
        canExportData: true
      },
      status: 'active',
      createdAt: new Date().toISOString()
    };

    setUsers(prev => [defaultUser, ...prev]);
    setCurrentTenantId(newId);
    showToast(`Loja/Empresa "${newTenant.name}" criada com sucesso!`);
    return newTenant;
  };

  const updateTenant = (id: string, updates: Partial<Tenant>) => {
    setTenants(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    showToast('Configurações da empresa atualizadas!');
  };

  const updateTenantCustomization = (id: string, customization: Partial<TenantCustomization>) => {
    setTenants(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          customization: {
            ...t.customization,
            ...customization
          }
        };
      }
      return t;
    }));
    showToast('Identidade visual e dados de contato salvos!');
  };

  const deleteTenant = (id: string) => {
    if (tenants.length <= 1) {
      showToast('Não é possível remover a única empresa cadastrada.');
      return;
    }
    setTenants(prev => prev.filter(t => t.id !== id));
    setProducts(prev => prev.filter(p => p.tenantId !== id));
    setOrders(prev => prev.filter(o => o.tenantId !== id));
    setUsers(prev => prev.filter(u => u.tenantId !== id));
    
    const remaining = tenants.filter(t => t.id !== id);
    if (remaining.length > 0) {
      setCurrentTenantId(remaining[0].id);
    }
    showToast('Empresa e catálogo removidos com sucesso.');
  };

  // Product Handlers
  const addProduct = (productData: Omit<Product, 'id'>): Product => {
    const newId = `prod-${Date.now().toString()}`;
    const newProduct: Product = {
      ...productData,
      id: newId
    };

    setProducts(prev => [newProduct, ...prev]);
    
    // Update tenant stats
    setTenants(prev => prev.map(t => {
      if (t.id === productData.tenantId) {
        return {
          ...t,
          stats: {
            ...t.stats,
            totalProducts: t.stats.totalProducts + 1
          }
        };
      }
      return t;
    }));

    showToast(`Produto "${newProduct.name}" cadastrado!`);
    return newProduct;
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    showToast('Produto atualizado com sucesso!');
  };

  const deleteProduct = (id: string) => {
    const prod = products.find(p => p.id === id);
    if (prod) {
      setProducts(prev => prev.filter(p => p.id !== id));
      setTenants(prev => prev.map(t => {
        if (t.id === prod.tenantId) {
          return {
            ...t,
            stats: {
              ...t.stats,
              totalProducts: Math.max(0, t.stats.totalProducts - 1)
            }
          };
        }
        return t;
      }));
      showToast('Produto excluído!');
    }
  };

  const toggleProductStatus = (id: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        const nextState = !p.active;
        showToast(nextState ? 'Produto ativado no catálogo' : 'Produto pausado');
        return { ...p, active: nextState };
      }
      return p;
    }));
  };

  // Order Handlers
  const createOrder = (orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>): Order => {
    const now = new Date();
    const orderNumber = `PED-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder: Order = {
      ...orderData,
      id: `order-${Date.now()}`,
      orderNumber,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    setOrders(prev => [newOrder, ...prev]);

    // Update tenant revenue stats
    setTenants(prev => prev.map(t => {
      if (t.id === orderData.tenantId) {
        return {
          ...t,
          stats: {
            ...t.stats,
            totalOrders: t.stats.totalOrders + 1,
            totalRevenue: t.stats.totalRevenue + newOrder.total
          }
        };
      }
      return t;
    }));

    clearCart();
    showToast(`Pedido ${orderNumber} gerado com sucesso!`);
    return newOrder;
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status,
          updatedAt: new Date().toISOString()
        };
      }
      return o;
    }));
    showToast(`Status do pedido atualizado para: ${status.toUpperCase()}`);
  };

  const deleteOrder = (orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    showToast('Pedido removido.');
  };

  // Team Handlers
  const addUser = (userData: Omit<TenantUser, 'id' | 'createdAt'>): TenantUser => {
    const newUser: TenantUser = {
      ...userData,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setUsers(prev => [newUser, ...prev]);
    showToast(`Usuário/Vendedor "${newUser.name}" adicionado!`);
    return newUser;
  };

  const updateUser = (id: string, updates: Partial<TenantUser>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    showToast('Permissões do usuário atualizadas!');
  };

  const deleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    showToast('Usuário removido da equipe.');
  };

  const resetToDefaultData = () => {
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_tenants`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_products`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_orders`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_users`);
    setTenants(INITIAL_TENANTS);
    setProducts(INITIAL_PRODUCTS);
    setOrders(INITIAL_ORDERS);
    setUsers(INITIAL_USERS);
    setCurrentTenantId('tenant-mc-distribuicao');
    showToast('Dados restaurados para o padrão de demonstração!');
  };

  return (
    <AppContext.Provider
      value={{
        viewMode,
        setViewMode,
        currentTenantId,
        setCurrentTenantId,
        currentTenant,
        tenants,
        addTenant,
        updateTenant,
        updateTenantCustomization,
        deleteTenant,
        products,
        currentTenantProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        toggleProductStatus,
        orders,
        currentTenantOrders,
        createOrder,
        updateOrderStatus,
        deleteOrder,
        users,
        currentTenantUsers,
        currentUser,
        setCurrentUser,
        addUser,
        updateUser,
        deleteUser,
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        cartSubtotal,
        cartItemsCount,
        toastMessage,
        showToast,
        storefrontSearch,
        setStorefrontSearch,
        selectedCategory,
        setSelectedCategory,
        b2bQuickMode,
        setB2bQuickMode,
        resetToDefaultData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
