import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  ShoppingCart, 
  ShieldCheck, 
  LayoutGrid, 
  List, 
  Plus, 
  Minus, 
  Truck, 
  MessageSquare, 
  AlertCircle, 
  RefreshCw, 
  Layers, 
  PackageX,
  X,
  Package
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, TenantPublicSettings } from '../../types';
import { ProductDetailModal } from './ProductDetailModal';
import { CartDrawer } from './CartDrawer';
import { getSafeProductImage, handleProductImageError } from '../../utils/productImages';
import { loadStorefrontData } from '../../services/catalogService';
import { PUBLIC_TENANT_SLUG } from '../../config/tenant';

export const StorefrontView: React.FC = () => {
  const { 
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

  // Estados oficiais do catálogo Supabase
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<TenantPublicSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quickQuantities, setQuickQuantities] = useState<Record<string, number>>({});

  // Carregamento oficial de dados via Supabase (sem fallback para mock em caso de erro)
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadStorefrontData(PUBLIC_TENANT_SLUG);
      setSettings(data.settings);
      setProducts(data.products);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar catálogo oficial.';
      console.error('[Storefront] Erro de carregamento Supabase:', err);
      setError(msg);
      setSettings(null);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Lista dinâmica de categorias dos produtos reais carregados
  const categories = ['Todos', ...Array.from(new Set(products.map(p => p.category))).filter(Boolean)];

  const filteredProducts = products.filter(p => {
    const searchLower = storefrontSearch.toLowerCase().trim();
    const matchesSearch = 
      !searchLower ||
      p.name.toLowerCase().includes(searchLower) ||
      p.sku.toLowerCase().includes(searchLower) ||
      (p.brand && p.brand.toLowerCase().includes(searchLower)) ||
      (p.category && p.category.toLowerCase().includes(searchLower));

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
        const prod = products.find(p => p.id === prodId);
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

  // 1. ESTADO DE LOADING
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center shadow-lg animate-pulse">
          <Layers className="w-6 h-6 text-[#FF5A00] animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-base font-bold text-[#0F172A]">Carregando Catálogo Oficial</h2>
          <p className="text-xs text-[#475569]">Conectando com o banco de dados oficial do Supabase...</p>
        </div>
      </div>
    );
  }

  // 2. ESTADO DE ERRO (SEM FALLBACK SILENCIOSO)
  if (error || !settings) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#E2E8F0] shadow-xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-extrabold text-[#0F172A]">Falha na Conexão com o Catálogo</h2>
            <p className="text-xs text-[#475569] leading-relaxed">
              {error || 'Não foi possível carregar as configurações públicas da loja.'}
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={loadData}
              className="w-full py-3 px-4 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-[#FF5A00]" />
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  const publicName = settings.publicName || 'Corsys.Catálogo';
  const whatsappClean = settings.whatsappNumber ? settings.whatsappNumber.replace(/\D/g, '') : '';
  const minVarejo = settings.minOrderValue || 0;
  const minAtacado = settings.wholesaleMinOrderValue;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-24 font-['Plus_Jakarta_Sans']">
      
      {/* Top Banner de Regras Comerciais Oficiais */}
      <div className="bg-[#0F172A] border-b border-slate-800 py-2 px-4 text-center text-xs font-semibold text-slate-200">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
          <span>📦 Pedido Mínimo Varejo: <strong className="text-white">R$ {minVarejo.toFixed(2).replace('.', ',')}</strong></span>
          {minAtacado !== null && minAtacado > 0 && (
            <span>🏢 Pedido Mínimo Atacado (B2B): <strong className="text-[#FF5A00]">R$ {minAtacado.toFixed(2).replace('.', ',')}</strong></span>
          )}
          <span>💬 Pedidos via WhatsApp: <strong className="text-white">{settings.whatsappNumber}</strong></span>
        </div>
      </div>

      {/* Store Header & Brand Identity */}
      <div className="bg-white border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            {/* Identidade Visual */}
            <div className="flex items-center gap-4">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={publicName}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-[#E2E8F0] shadow-xs bg-white shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center shrink-0 shadow-md border border-slate-800">
                  <span className="font-extrabold text-xl text-[#FF5A00]">C.</span>
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
                    {publicName}
                  </h1>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-700" /> Catálogo Oficial
                  </span>
                  <span className="text-[11px] bg-slate-100 text-slate-800 font-extrabold px-2.5 py-0.5 rounded-lg border border-slate-200 flex items-center gap-1">
                    <Package className="w-3 h-3 text-[#FF5A00]" /> {products.length} produtos
                  </span>
                </div>
                
                {/* Métodos de Entrega Oficiais */}
                {settings.deliveryMethods.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] text-[#475569]">
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-[#FF5A00]" /> Entrega:
                    </span>
                    {settings.deliveryMethods.map((method, idx) => (
                      <span key={idx} className="bg-slate-100 px-2 py-0.5 rounded-md capitalize font-medium text-slate-700 border border-slate-200">
                        {method}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Search in Header with High-Contrast Explicit Colors */}
            <div className="w-full md:w-96">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#475569] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome, marca ou SKU..."
                  value={storefrontSearch}
                  onChange={e => setStorefrontSearch(e.target.value)}
                  style={{ color: '#0F172A', backgroundColor: '#FFFFFF' }}
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-[#E2E8F0] text-xs font-medium text-[#0F172A] placeholder-[#475569] bg-white focus:ring-2 focus:ring-[#FF5A00] focus:border-[#FF5A00] focus:outline-none shadow-xs transition-all"
                />
                {storefrontSearch && (
                  <button
                    type="button"
                    onClick={() => setStorefrontSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#0F172A] p-0.5 rounded-md transition-colors cursor-pointer"
                    title="Limpar pesquisa"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
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
            {categories.map(cat => {
              const count = cat === 'Todos' ? products.length : products.filter(p => p.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedCategory === cat
                      ? 'bg-[#0F172A] text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-[#E2E8F0] hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    selectedCategory === cat
                      ? 'bg-[#FF5A00] text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mode switch: Grid vs B2B Quick Order Table */}
          {settings.allowB2bMode && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">Visualização:</span>
              <div className="bg-white p-1 rounded-xl border border-[#E2E8F0] flex items-center text-xs font-semibold shadow-xs">
                <button
                  onClick={() => setB2bQuickMode(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    !b2bQuickMode ? 'bg-[#0F172A] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Vitrine</span>
                </button>
                <button
                  onClick={() => setB2bQuickMode(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    b2bQuickMode ? 'bg-[#0F172A] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <List className="w-3.5 h-3.5 text-[#FF5A00]" />
                  <span>Grade Rápida Atacado</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Counter Info Bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <div>
            Exibindo <strong className="text-[#0F172A] font-bold">{filteredProducts.length}</strong> {filteredProducts.length === 1 ? 'produto' : 'produtos'} {
              (storefrontSearch || selectedCategory !== 'Todos') ? (
                <span>(filtrado de um total de <strong className="text-[#0F172A]">{products.length}</strong> produtos no catálogo)</span>
              ) : (
                <span>disponíveis no catálogo</span>
              )
            }
          </div>
          {storefrontSearch && (
            <button
              onClick={() => setStorefrontSearch('')}
              className="text-[#FF5A00] font-bold hover:underline cursor-pointer"
            >
              Limpar busca
            </button>
          )}
        </div>

        {/* 3. ESTADO EMPTY */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#E2E8F0] p-12 text-center max-w-md mx-auto my-8 space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <PackageX className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-base">Nenhum produto encontrado</h3>
              <p className="text-xs text-slate-500">
                Tente ajustar os termos de pesquisa ou selecionar outra categoria.
              </p>
            </div>
            {storefrontSearch && (
              <button
                onClick={() => setStorefrontSearch('')}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Limpar Busca
              </button>
            )}
          </div>
        ) : !b2bQuickMode ? (
          /* VIEW MODE 1: VISUAL PRODUCT GRID */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map(product => {
              const hasWholesale = product.wholesalePrice !== null && product.wholesalePrice > 0;

              return (
                <div
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs hover:shadow-lg transition-all overflow-hidden flex flex-col justify-between group cursor-pointer"
                >
                  <div>
                    {/* Image Container (Neutral SVG placeholder if empty) */}
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
                        {hasWholesale && (
                          <span className="bg-[#0F172A] text-[#FF5A00] text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-xs border border-slate-700">
                            Atacado B2B
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded-md font-mono">
                        SKU: {product.sku}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-500 uppercase tracking-wider">
                          {product.category}
                        </span>
                        <span className={`font-semibold ${product.stock > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                          Estoque: {product.stock} {product.unit}
                        </span>
                      </div>
                      
                      <h3 className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug">
                        {product.name}
                      </h3>

                      {product.brand && (
                        <p className="text-[11px] text-slate-500">Marca: <strong className="text-slate-700">{product.brand}</strong></p>
                      )}

                      {/* Pricing Block */}
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-extrabold text-[#0F172A]">
                            R$ {(product.promotionalPrice || product.price).toFixed(2).replace('.', ',')}
                          </span>
                          <span className="text-[11px] text-slate-400">/{product.unit}</span>
                          
                          {product.promotionalPrice && (
                            <span className="text-xs text-slate-400 line-through">
                              R$ {product.price.toFixed(2).replace('.', ',')}
                            </span>
                          )}
                        </div>

                        {hasWholesale && (
                          <div className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                            Atacado: <strong>R$ {product.wholesalePrice!.toFixed(2).replace('.', ',')}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Button (Accent Orange #FF5A00) */}
                  <div className="p-4 pt-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product, product.minOrderQuantity || 1);
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#FF5A00] hover:bg-[#D94E00] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
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
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-bold text-xs text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FF5A00]" /> Grade de Pedido Rápido B2B
                </div>
                <div className="text-[11px] text-slate-300">
                  Informe as quantidades desejadas em cada produto e adicione todos em lote ao carrinho.
                </div>
              </div>

              {hasBatchItems && (
                <button
                  onClick={handleBatchAddToCart}
                  className="px-4 py-2 rounded-xl bg-[#FF5A00] hover:bg-[#D94E00] text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Adicionar Selecionados ao Pedido
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-3 px-4">Produto / SKU</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Preço Varejo</th>
                    <th className="py-3 px-4">Preço Atacado</th>
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
                            className="w-10 h-10 rounded-lg object-cover border border-[#E2E8F0] shrink-0"
                            onError={(e) => handleProductImageError(e, prod.category)}
                          />
                          <div>
                            <div className="font-bold text-slate-900 text-xs line-clamp-1">{prod.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">SKU: {prod.sku}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-200">
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
                        {prod.wholesalePrice !== null && prod.wholesalePrice > 0 ? (
                          <div className="text-[11px] text-emerald-700 font-semibold">
                            R$ {prod.wholesalePrice.toFixed(2).replace('.', ',')}
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
                            className="w-7 h-7 rounded-lg border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={quickQuantities[prod.id] || 0}
                            onChange={e => handleQuickQtyChange(prod.id, Number(e.target.value))}
                            style={{ color: '#0F172A', backgroundColor: '#FFFFFF' }}
                            className="w-14 text-center text-xs font-bold border border-slate-300 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-[#FF5A00] text-slate-900 bg-white"
                          />
                          <button
                            onClick={() => handleQuickQtyChange(prod.id, (quickQuantities[prod.id] || 0) + 1)}
                            className="w-7 h-7 rounded-lg border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
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
              <div className="p-4 bg-slate-50 border-t border-[#E2E8F0] flex items-center justify-end">
                <button
                  onClick={handleBatchAddToCart}
                  className="px-6 py-2.5 rounded-xl bg-[#FF5A00] hover:bg-[#D94E00] text-white text-xs font-bold flex items-center gap-2 shadow-md transition-colors cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Adicionar Itens Selecionados ao Pedido
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Floating Bottom Cart Bar (Accent Orange CTA) */}
      {cartItemsCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-lg w-[92%] bg-[#0F172A] text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF5A00] text-white flex items-center justify-center font-extrabold text-sm shadow-md">
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
            className="px-5 py-2.5 rounded-xl bg-[#FF5A00] hover:bg-[#D94E00] text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
            id="floating-open-cart-btn"
          >
            <ShoppingCart className="w-4 h-4" />
            Finalizar Pedido
          </button>
        </div>
      )}

      {/* Floating WhatsApp Contact Button */}
      {whatsappClean && (
        <a
          href={`https://wa.me/${whatsappClean}?text=${encodeURIComponent(`Olá, gostaria de tirar uma dúvida sobre o catálogo ${publicName}.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-30 w-12 h-12 rounded-full bg-[#16A34A] hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
          title={`Falar no WhatsApp (${settings.whatsappNumber})`}
        >
          <MessageSquare className="w-6 h-6" />
        </a>
      )}

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        settings={settings}
        onClose={() => setSelectedProduct(null)}
      />

      {/* Cart Drawer */}
      <CartDrawer settings={settings} />

    </div>
  );
};
