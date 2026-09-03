import React, { useState } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Filter, 
  Tag, 
  Star, 
  Info, 
  Sparkles, 
  LayoutGrid, 
  List, 
  Check, 
  Plus, 
  Minus, 
  Truck, 
  Phone, 
  MessageSquare,
  ShieldCheck,
  Building,
  Share2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import { ProductDetailModal } from './ProductDetailModal';
import { CartDrawer } from './CartDrawer';
import { getSafeProductImage, handleProductImageError } from '../../utils/productImages';

export const StorefrontView: React.FC = () => {
  const { 
    currentTenant, 
    currentTenantProducts, 
    addToCart, 
    setIsCartOpen, 
    cartItemsCount,
    cartSubtotal,
    storefrontSearch,
    setStorefrontSearch,
    selectedCategory,
    setSelectedCategory,
    b2bQuickMode,
    setB2bQuickMode
  } = useApp();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quickQuantities, setQuickQuantities] = useState<Record<string, number>>({});

  // Categories list
  const categories = ['Todos', ...Array.from(new Set(currentTenantProducts.map(p => p.category))).filter(Boolean)];

  const filteredProducts = currentTenantProducts.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(storefrontSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(storefrontSearch.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(storefrontSearch.toLowerCase())) ||
      (p.tags && p.tags.some(t => t.toLowerCase().includes(storefrontSearch.toLowerCase())));

    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    const matchesActive = p.active;

    return matchesSearch && matchesCategory && matchesActive;
  });

  const handleQuickQtyChange = (productId: string, val: number) => {
    setQuickQuantities(prev => ({
      ...prev,
      [productId]: Math.max(0, val)
    }));
  };

  const handleBatchAddToCart = () => {
    let addedCount = 0;
    Object.entries(quickQuantities).forEach(([prodId, rawQty]) => {
      const qty = Number(rawQty) || 0;
      if (qty > 0) {
        const prod = currentTenantProducts.find(p => p.id === prodId);
        if (prod) {
          addToCart(prod, qty);
          addedCount += qty;
        }
      }
    });
    if (addedCount > 0) {
      setQuickQuantities({});
      setIsCartOpen(true);
    }
  };

  const hasBatchItems = Object.values(quickQuantities).some(q => (Number(q) || 0) > 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      
      {/* Announcement Bar */}
      {currentTenant.customization.announcementText && (
        <div 
          className="py-1.5 px-4 text-center text-xs font-semibold text-white shadow-xs"
          style={{ backgroundColor: currentTenant.customization.primaryColor || '#0284c7' }}
        >
          {currentTenant.customization.announcementText}
        </div>
      )}

      {/* Store Header & Brand Hero */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            {/* Logo & Name */}
            <div className="flex items-center gap-4">
              <img
                src={currentTenant.customization.logoUrl || 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=200'}
                alt={currentTenant.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-slate-200 shadow-sm bg-white shrink-0"
                referrerPolicy="no-referrer"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-['Outfit']">
                    {currentTenant.customization.tradeName || currentTenant.name}
                  </h1>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Verificado
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentTenant.customization.segment || 'Atacado & Distribuição'} • Pedido Mínimo: <strong>R$ {currentTenant.customization.minOrderValue.toFixed(2).replace('.', ',')}</strong>
                </p>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                  {currentTenant.customization.cityState && (
                    <span>📍 {currentTenant.customization.cityState}</span>
                  )}
                  <span>💬 Pedidos via WhatsApp</span>
                </div>
              </div>
            </div>

            {/* Quick Search in Header */}
            <div className="w-full md:w-80">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar produto, marca ou SKU..."
                  value={storefrontSearch}
                  onChange={e => setStorefrontSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50"
                />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Controls: Categories & View Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Categories Pill Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Mode switch: Grid vs B2B Quick Order Table */}
          {currentTenant.customization.allowB2BMode && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">Modo:</span>
              <div className="bg-white p-1 rounded-xl border border-slate-200 flex items-center text-xs font-semibold">
                <button
                  onClick={() => setB2bQuickMode(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    !b2bQuickMode ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Vitrine</span>
                </button>
                <button
                  onClick={() => setB2bQuickMode(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    b2bQuickMode ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Grade Rápida Atacado</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* VIEW MODE 1: VISUAL PRODUCT GRID */}
        {!b2bQuickMode ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map(product => {
              const hasWholesale = product.wholesaleTiers && product.wholesaleTiers.length > 0;
              const lowestWholesale = hasWholesale 
                ? Math.min(...product.wholesaleTiers!.map(t => t.price))
                : product.wholesalePrice;

              return (
                <div
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-lg transition-all overflow-hidden flex flex-col justify-between group cursor-pointer"
                >
                  <div>
                    {/* Image Container */}
                    <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
                      <img
                        src={getSafeProductImage(product.images[0], product.category)}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                        onError={(e) => handleProductImageError(e, product.category)}
                      />
                      
                      {/* Badges */}
                      <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                        {product.featured && (
                          <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-white" /> Destaque
                          </span>
                        )}
                        {hasWholesale && (
                          <span className="bg-blue-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-xs">
                            Preço Atacado
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded-md font-mono">
                        SKU: {product.sku}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-2">
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                        {product.category}
                      </span>
                      
                      <h3 className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug">
                        {product.name}
                      </h3>

                      {product.brand && (
                        <p className="text-[11px] text-slate-400">Marca: {product.brand}</p>
                      )}

                      {/* Pricing Block */}
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-extrabold text-slate-900 font-['Outfit']">
                            R$ {(product.promotionalPrice || product.price).toFixed(2).replace('.', ',')}
                          </span>
                          <span className="text-[11px] text-slate-400">/{product.unit}</span>
                          
                          {product.promotionalPrice && (
                            <span className="text-xs text-slate-400 line-through">
                              R$ {product.price.toFixed(2).replace('.', ',')}
                            </span>
                          )}
                        </div>

                        {lowestWholesale && (
                          <div className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                            Atacado a partir de: <strong>R$ {lowestWholesale.toFixed(2).replace('.', ',')}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Button */}
                  <div className="p-4 pt-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product, product.minOrderQuantity || 1);
                      }}
                      className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      Adicionar ({product.minOrderQuantity || 1} {product.unit})
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        ) : (
          /* VIEW MODE 2: B2B QUICK ORDER TABLE (GRADE ATACADO) */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-blue-900">Grade de Pedido Rápido B2B</div>
                <div className="text-[11px] text-blue-700">Digite a quantidade desejada em cada produto e adicione todos de uma vez ao pedido.</div>
              </div>

              {hasBatchItems && (
                <button
                  onClick={handleBatchAddToCart}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Adicionar Selecionados ao Pedido
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Produto / SKU</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Preço Unitário</th>
                    <th className="py-3 px-4">Tabela Atacado</th>
                    <th className="py-3 px-4">Estoque</th>
                    <th className="py-3 px-4 text-center">Quantidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map(prod => (
                    <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={getSafeProductImage(prod.images[0], prod.category)}
                            alt={prod.name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                            onError={(e) => handleProductImageError(e, prod.category)}
                          />
                          <div>
                            <div className="font-bold text-slate-900 text-xs line-clamp-1">{prod.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">SKU: {prod.sku}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium">
                          {prod.category}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-xs">
                          R$ {prod.price.toFixed(2).replace('.', ',')}
                        </div>
                        <span className="text-[10px] text-slate-400">/{prod.unit}</span>
                      </td>

                      <td className="py-3 px-4">
                        {prod.wholesaleTiers && prod.wholesaleTiers.length > 0 ? (
                          <div className="text-[11px] text-blue-700 font-semibold">
                            {prod.wholesaleTiers.map((t, idx) => (
                              <div key={idx}>≥ {t.minQuantity} {prod.unit}: R$ {t.price.toFixed(2).replace('.', ',')}</div>
                            ))}
                          </div>
                        ) : prod.wholesalePrice ? (
                          <div className="text-[11px] text-blue-700 font-semibold">
                            R$ {prod.wholesalePrice.toFixed(2).replace('.', ',')} (Min {prod.minOrderQuantity})
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {prod.stock} {prod.unit}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleQuickQtyChange(prod.id, (quickQuantities[prod.id] || 0) - 1)}
                            className="w-7 h-7 rounded-lg border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-600"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={quickQuantities[prod.id] || 0}
                            onChange={e => handleQuickQtyChange(prod.id, Number(e.target.value))}
                            className="w-14 text-center text-xs font-bold border border-slate-300 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => handleQuickQtyChange(prod.id, (quickQuantities[prod.id] || 0) + 1)}
                            className="w-7 h-7 rounded-lg border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-600"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasBatchItems && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
                <button
                  onClick={handleBatchAddToCart}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-md"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Adicionar Itens Selecionados ao Pedido
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Floating Bottom Cart Bar */}
      {cartItemsCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-lg w-[92%] bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-extrabold text-sm shadow-md">
              {cartItemsCount}
            </div>
            <div>
              <div className="text-xs text-slate-400">Total do Pedido:</div>
              <div className="text-base font-extrabold text-white font-['Outfit']">
                R$ {cartSubtotal.toFixed(2).replace('.', ',')}
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
            id="floating-open-cart-btn"
          >
            <ShoppingCart className="w-4 h-4" />
            Finalizar Pedido
          </button>
        </div>
      )}

      {/* Floating WhatsApp Contact Button */}
      <a
        href={`https://wa.me/${currentTenant.customization.whatsappNumber.replace(/\D/g, '')}?text=Ol%C3%A1%2C%20gostaria%20de%20tirar%20uma%20d%C3%BAvida%20sobre%20o%20cat%C3%A1logo%20${encodeURIComponent(currentTenant.name)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-30 w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
        title="Falar no WhatsApp"
      >
        <MessageSquare className="w-6 h-6" />
      </a>

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      {/* Cart Drawer */}
      <CartDrawer />

    </div>
  );
};
