import React, { useState } from 'react';
import { 
  X, 
  ShoppingCart, 
  Check, 
  Plus, 
  Minus, 
  Truck, 
  MessageSquare,
  Layers
} from 'lucide-react';
import { Product, TenantPublicSettings } from '../../types';
import { useApp } from '../../context/AppContext';
import { getSafeProductImage, handleProductImageError } from '../../utils/productImages';

export const ProductDetailModal: React.FC<{
  product: Product | null;
  settings?: TenantPublicSettings | null;
  onClose: () => void;
}> = ({ product, settings, onClose }) => {
  const { currentTenant, addToCart, setIsCartOpen } = useApp();

  const [quantity, setQuantity] = useState(product?.minOrderQuantity || 1);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [isAdded, setIsAdded] = useState(false);

  if (!product) return null;

  const currentUnitPrice = product.promotionalPrice || product.price;
  const totalPrice = currentUnitPrice * quantity;
  const storeName = settings?.publicName || currentTenant.name || 'Corsys.Catálogo';
  const whatsappNumber = settings?.whatsappNumber || currentTenant.customization?.whatsappNumber || '';
  const hasWholesale = product.wholesalePrice !== null && product.wholesalePrice > 0;

  const handleAddToCart = () => {
    addToCart(product, quantity);
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
      onClose();
      setIsCartOpen(true);
    }, 600);
  };

  const handleDirectWhatsApp = () => {
    if (!whatsappNumber) return;
    const cleanPhone = whatsappNumber.replace(/\D/g, '');
    const text = `Olá, gostaria de tirar uma dúvida sobre o produto: *${product.name}* (SKU: ${product.sku}) do catálogo ${storeName}.`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#E2E8F0]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#0F172A] bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
              {product.category}
            </span>
            <span className="text-xs text-slate-400 font-mono">SKU: {product.sku}</span>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          
          {/* Images */}
          <div className="space-y-3">
            <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-[#E2E8F0]">
              <img
                src={getSafeProductImage(product.images[selectedImageIdx] || product.images[0], product.category)}
                alt={product.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => handleProductImageError(e, product.category)}
              />
            </div>

            {product.images.length > 1 && (
              <div className="flex gap-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIdx(idx)}
                    className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                      selectedImageIdx === idx ? 'border-[#FF5A00] shadow-xs' : 'border-[#E2E8F0] opacity-60'
                    }`}
                  >
                    <img 
                      src={getSafeProductImage(img, product.category)} 
                      alt="" 
                      className="w-full h-full object-cover"
                      onError={(e) => handleProductImageError(e, product.category)}
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Truck className="w-3.5 h-3.5 text-[#FF5A00]" />
                Disponibilidade e Origem
              </div>
              <div>Estoque oficial verificado por <strong>{storeName}</strong>.</div>
              <div className="font-semibold text-slate-700">
                Disponível para pronta entrega: {product.stock} {product.unit}
              </div>
            </div>
          </div>

          {/* Details & Pricing */}
          <div className="flex flex-col justify-between space-y-4">
            
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A] leading-snug">
                  {product.name}
                </h2>
                {product.brand && (
                  <p className="text-xs text-slate-500 mt-0.5">Marca: <strong className="text-slate-800">{product.brand}</strong></p>
                )}
              </div>

              {/* Price Display */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-[#E2E8F0] space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Preço Varejo ({quantity} {product.unit})
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-[#0F172A]">
                    R$ {currentUnitPrice.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">/{product.unit}</span>
                  
                  {product.promotionalPrice && (
                    <span className="text-xs text-slate-400 line-through">
                      R$ {product.price.toFixed(2).replace('.', ',')}
                    </span>
                  )}
                </div>

                {hasWholesale && (
                  <div className="pt-2 mt-1 border-t border-slate-200 text-xs font-semibold text-emerald-700">
                    Preço Atacado (B2B): <strong>R$ {product.wholesalePrice!.toFixed(2).replace('.', ',')}</strong>/{product.unit}
                  </div>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <div>
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Descrição</div>
                  <p className="text-xs text-slate-600 leading-relaxed max-h-28 overflow-y-auto">
                    {product.description}
                  </p>
                </div>
              )}
            </div>

            {/* Quantity Selector & Action */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Quantidade ({product.unit}):</span>
                
                <div className="flex items-center gap-2 border border-slate-300 rounded-xl p-1 bg-white">
                  <button
                    onClick={() => setQuantity(Math.max(product.minOrderQuantity || 1, quantity - 1))}
                    className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={product.minOrderQuantity || 1}
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-12 text-center text-xs font-bold focus:outline-none"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Subtotal */}
              <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-[#E2E8F0]">
                <span className="text-slate-600 font-medium">Subtotal deste item:</span>
                <span className="text-sm font-extrabold text-[#0F172A]">
                  R$ {totalPrice.toFixed(2).replace('.', ',')}
                </span>
              </div>

              {/* Primary Action Button (Accent Orange #FF5A00) */}
              <button
                onClick={handleAddToCart}
                className="w-full py-3 rounded-2xl bg-[#FF5A00] hover:bg-[#D94E00] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                id="btn-modal-add-cart"
              >
                {isAdded ? <Check className="w-4 h-4 text-white" /> : <ShoppingCart className="w-4 h-4" />}
                {isAdded ? 'Item Adicionado ao Pedido!' : `Adicionar ${quantity} ${product.unit} ao Pedido`}
              </button>

              {whatsappNumber && (
                <button
                  onClick={handleDirectWhatsApp}
                  className="w-full py-2 rounded-xl border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#16A34A]" />
                  Dúvidas? Fale no WhatsApp da Loja
                </button>
              )}

            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
