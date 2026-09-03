import React, { useState } from 'react';
import { 
  X, 
  ShoppingCart, 
  Check, 
  Plus, 
  Minus, 
  Tag, 
  ShieldCheck, 
  Truck, 
  MessageSquare, 
  Star,
  Info,
  Package
} from 'lucide-react';
import { Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { getSafeProductImage, handleProductImageError } from '../../utils/productImages';

export const ProductDetailModal: React.FC<{
  product: Product | null;
  onClose: () => void;
}> = ({ product, onClose }) => {
  const { currentTenant, addToCart, setIsCartOpen } = useApp();

  const [quantity, setQuantity] = useState(product?.minOrderQuantity || 1);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [isAdded, setIsAdded] = useState(false);

  if (!product) return null;

  // Calculate unit price based on tiered scale
  let currentUnitPrice = product.promotionalPrice || product.price;
  if (product.wholesaleTiers && product.wholesaleTiers.length > 0) {
    const sorted = [...product.wholesaleTiers].sort((a, b) => b.minQuantity - a.minQuantity);
    const tierMatch = sorted.find(t => quantity >= t.minQuantity);
    if (tierMatch) {
      currentUnitPrice = tierMatch.price;
    }
  }

  const totalPrice = currentUnitPrice * quantity;

  const handleAddToCart = () => {
    addToCart(product, quantity);
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
      onClose();
      setIsCartOpen(true);
    }, 800);
  };

  const handleDirectWhatsApp = () => {
    const cleanPhone = currentTenant.customization.whatsappNumber.replace(/\D/g, '');
    const phone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = `Olá, gostaria de tirar uma dúvida sobre o produto: *${product.name}* (SKU: ${product.sku}) do catálogo ${currentTenant.name}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
              {product.category}
            </span>
            <span className="text-xs text-slate-400 font-mono">SKU: {product.sku}</span>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          
          {/* Images */}
          <div className="space-y-3">
            <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
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
                    className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                      selectedImageIdx === idx ? 'border-blue-600 shadow-xs' : 'border-slate-200 opacity-60'
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

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                Entrega & Disponibilidade
              </div>
              <div>Estoque garantido pela <strong>{currentTenant.name}</strong>.</div>
              {currentTenant.customization.deliveryMethods.freeFreightThreshold && (
                <div className="text-emerald-700 font-medium">
                  Frete Grátis em pedidos acima de R$ {currentTenant.customization.deliveryMethods.freeFreightThreshold.toFixed(2).replace('.', ',')}!
                </div>
              )}
            </div>
          </div>

          {/* Details & Pricing */}
          <div className="flex flex-col justify-between space-y-4">
            
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-['Outfit'] leading-snug">
                  {product.name}
                </h2>
                {product.brand && (
                  <p className="text-xs text-slate-500 mt-0.5">Marca: <strong>{product.brand}</strong></p>
                )}
              </div>

              {/* Price Display */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Valor Unitário ({quantity} {product.unit})
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-extrabold text-slate-900 font-['Outfit']">
                    R$ {currentUnitPrice.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">/{product.unit}</span>
                  
                  {product.promotionalPrice && (
                    <span className="text-xs text-slate-400 line-through">
                      R$ {product.price.toFixed(2).replace('.', ',')}
                    </span>
                  )}
                </div>
              </div>

              {/* Wholesale Tiers Table */}
              {product.wholesaleTiers && product.wholesaleTiers.length > 0 && (
                <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 space-y-1.5">
                  <div className="text-xs font-bold text-blue-900 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-blue-600" />
                    Tabela de Desconto por Quantidade (Atacado)
                  </div>
                  <div className="space-y-1">
                    {product.wholesaleTiers.map((tier, idx) => (
                      <div 
                        key={idx} 
                        className={`flex items-center justify-between text-xs px-2.5 py-1 rounded-lg ${
                          quantity >= tier.minQuantity ? 'bg-blue-600 text-white font-bold' : 'bg-white text-slate-700'
                        }`}
                      >
                        <span>A partir de <strong>{tier.minQuantity} {product.unit}</strong>:</span>
                        <span>R$ {tier.price.toFixed(2).replace('.', ',')}/{product.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
              <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-600 font-medium">Subtotal deste item:</span>
                <span className="text-sm font-extrabold text-blue-700">
                  R$ {totalPrice.toFixed(2).replace('.', ',')}
                </span>
              </div>

              {/* Button */}
              <button
                onClick={handleAddToCart}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
                id="btn-modal-add-cart"
              >
                {isAdded ? <Check className="w-4 h-4 text-emerald-300" /> : <ShoppingCart className="w-4 h-4" />}
                {isAdded ? 'Item Adicionado ao Pedido!' : `Adicionar ${quantity} ${product.unit} ao Pedido`}
              </button>

              <button
                onClick={handleDirectWhatsApp}
                className="w-full py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                Dúvidas? Fale no WhatsApp da Loja
              </button>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
