import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingCart, 
  MessageSquare, 
  Check, 
  Truck, 
  CreditCard, 
  QrCode, 
  Copy, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import { PaymentMethod, Order, TenantPublicSettings } from '../../types';
import { getSafeProductImage, handleProductImageError } from '../../utils/productImages';

export const CartDrawer: React.FC<{
  settings?: TenantPublicSettings | null;
}> = ({ settings }) => {
  const { 
    currentTenant, 
    cart, 
    updateCartQuantity, 
    removeFromCart, 
    clearCart, 
    isCartOpen, 
    setIsCartOpen, 
    cartSubtotal,
    createOrder,
    showToast 
  } = useApp();

  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'details' | 'success'>('cart');
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // Customer Details State
  const [customerData, setCustomerData] = useState({
    name: '',
    type: 'PJ' as 'PF' | 'PJ',
    document: '',
    companyName: '',
    email: '',
    phone: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '',
    paymentMethod: 'pix' as PaymentMethod,
    notes: '',
    sellerCode: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isCartOpen) return null;

  const storeName = settings?.publicName || currentTenant.name || 'Corsys.Catálogo';
  const whatsappNumber = settings?.whatsappNumber || currentTenant.customization?.whatsappNumber || '';
  const minOrderValue = settings?.minOrderValue !== undefined ? settings.minOrderValue : (currentTenant.customization?.minOrderValue || 0);
  const isBelowMinOrder = cartSubtotal < minOrderValue;
  const missingAmount = Math.max(0, minOrderValue - cartSubtotal);

  const shippingFee = 0;
  const orderTotal = cartSubtotal + shippingFee;

  const handleProceedToDetails = () => {
    if (cart.length === 0) {
      showToast('Seu carrinho está vazio');
      return;
    }
    if (isBelowMinOrder) {
      showToast(`O valor mínimo para pedidos é de R$ ${minOrderValue.toFixed(2).replace('.', ',')}`);
      return;
    }
    setCheckoutStep('details');
  };

  const handleFinishOrder = (sendWhatsAppDirect = false) => {
    const newErrors: Record<string, string> = {};
    if (!customerData.name.trim()) newErrors.name = 'Nome é obrigatório';
    if (!customerData.phone.trim()) newErrors.phone = 'Telefone/WhatsApp é obrigatório';
    if (!customerData.street.trim()) newErrors.street = 'Endereço é obrigatório';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const orderItems = cart.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      productSku: item.product.sku,
      productImage: item.product.images[0] || '',
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      unit: item.product.unit,
      totalPrice: item.unitPrice * item.quantity,
      selectedVariant: item.selectedVariant
    }));

    const newOrder = createOrder({
      tenantId: settings?.tenantId || currentTenant.id,
      sellerCode: customerData.sellerCode || undefined,
      customer: {
        name: customerData.name,
        document: customerData.document || undefined,
        companyName: customerData.companyName || undefined,
        email: customerData.email || 'cliente@contato.com.br',
        phone: customerData.phone,
        type: customerData.type
      },
      shippingAddress: {
        street: customerData.street,
        number: customerData.number || 'S/N',
        complement: customerData.complement || undefined,
        neighborhood: customerData.neighborhood || 'Centro',
        city: customerData.city || 'São Paulo',
        state: customerData.state || 'SP',
        zipCode: customerData.zipCode || '00000-000'
      },
      items: orderItems,
      subtotal: cartSubtotal,
      discount: 0,
      shippingFee,
      total: orderTotal,
      status: 'pending',
      paymentMethod: customerData.paymentMethod,
      notes: customerData.notes || undefined,
      source: 'web_checkout'
    });

    setCreatedOrder(newOrder);
    setCheckoutStep('success');

    // Confetti celebration
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {}

    // If requested, open WhatsApp with formatted message
    if (sendWhatsAppDirect) {
      dispatchWhatsAppMessage(newOrder);
    }
  };

  const dispatchWhatsAppMessage = (order: Order) => {
    const rawPhone = whatsappNumber || '5541992928033';
    const storePhone = rawPhone.replace(/\D/g, '');
    const cleanPhone = storePhone.startsWith('55') ? storePhone : `55${storePhone}`;

    const itemsText = order.items.map(i => 
      `• *${i.quantity}x ${i.productName}* (${i.unit}) - R$ ${i.totalPrice.toFixed(2).replace('.', ',')}`
    ).join('\n');

    const message = 
      `🛍️ *NOVO PEDIDO CATÁLOGO #${order.orderNumber}*\n` +
      `🏪 *Loja:* ${storeName}\n\n` +
      `👤 *Cliente:* ${order.customer.name}\n` +
      (order.customer.companyName ? `🏢 *Empresa:* ${order.customer.companyName}\n` : '') +
      `📱 *WhatsApp:* ${order.customer.phone}\n` +
      (order.customer.document ? `📄 *Doc:* ${order.customer.document}\n` : '') +
      `📍 *Entrega:* ${order.shippingAddress.street}, ${order.shippingAddress.number} - ${order.shippingAddress.neighborhood}, ${order.shippingAddress.city}/${order.shippingAddress.state}\n\n` +
      `📦 *ITENS DO PEDIDO:*\n${itemsText}\n\n` +
      `💵 *Subtotal:* R$ ${order.subtotal.toFixed(2).replace('.', ',')}\n` +
      `🚚 *Frete:* ${order.shippingFee === 0 ? 'A combinar / Grátis' : `R$ ${order.shippingFee.toFixed(2).replace('.', ',')}`}\n` +
      `💰 *TOTAL DO PEDIDO:* R$ ${order.total.toFixed(2).replace('.', ',')}\n` +
      `💳 *Forma de Pagamento:* ${order.paymentMethod.toUpperCase()}\n` +
      (order.sellerCode ? `🏷️ *Cód. Vendedor:* ${order.sellerCode}\n` : '') +
      (order.notes ? `📝 *Obs:* ${order.notes}\n` : '') +
      `\n_Pedido enviado automaticamente via catálogo oficial._`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleCopyPixKey = () => {
    const key = '34567890000112';
    navigator.clipboard.writeText(key);
    setCopiedPix(true);
    showToast('Chave PIX copiada!');
    setTimeout(() => setCopiedPix(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#0F172A] text-[#FF5A00] flex items-center justify-center font-bold text-xs">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[#0F172A] text-sm">
                {checkoutStep === 'cart' ? 'Seu Pedido' : checkoutStep === 'details' ? 'Dados para Entrega & Pagamento' : 'Pedido Confirmado! 🎉'}
              </h3>
              <p className="text-[11px] text-slate-500">{storeName}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsCartOpen(false)}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: CART ITEMS */}
        {checkoutStep === 'cart' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            
            {cart.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <ShoppingCart className="w-8 h-8" />
                </div>
                <div className="text-sm font-bold text-slate-700">Seu carrinho está vazio</div>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Navegue pelo catálogo e adicione produtos para gerar seu orçamento ou pedido.
                </p>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Continuar Comprando
                </button>
              </div>
            ) : (
              <>
                {/* Minimum Order Warning */}
                {isBelowMinOrder && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      Pedido mínimo da loja: <strong>R$ {minOrderValue.toFixed(2).replace('.', ',')}</strong>. Adicione mais <strong>R$ {missingAmount.toFixed(2).replace('.', ',')}</strong> para finalizar.
                    </div>
                  </div>
                )}

                {/* Items List */}
                <div className="space-y-3">
                  {cart.map((item, idx) => (
                    <div key={`${item.product.id}-${idx}`} className="p-3 bg-slate-50 rounded-2xl border border-[#E2E8F0] flex items-center justify-between gap-3">
                      <img
                        src={getSafeProductImage(item.product.images[0], item.product.category)}
                        alt={item.product.name}
                        className="w-14 h-14 rounded-xl object-cover border border-[#E2E8F0] shrink-0"
                        onError={(e) => handleProductImageError(e, item.product.category)}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{item.product.name}</h4>
                        <div className="text-[11px] text-slate-500 font-mono">
                          R$ {item.unitPrice.toFixed(2).replace('.', ',')} /{item.product.unit}
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex items-center border border-slate-300 rounded-lg bg-white">
                            <button
                              onClick={() => updateCartQuantity(item.product.id, item.quantity - 1, item.selectedVariant)}
                              className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                            <button
                              onClick={() => updateCartQuantity(item.product.id, item.quantity + 1, item.selectedVariant)}
                              className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-500">{item.product.unit}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-extrabold text-[#0F172A]">
                          R$ {(item.unitPrice * item.quantity).toFixed(2).replace('.', ',')}
                        </div>
                        <button
                          onClick={() => removeFromCart(item.product.id, item.selectedVariant)}
                          className="text-slate-400 hover:text-red-500 p-1 mt-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-right">
                  <button
                    onClick={clearCart}
                    className="text-[11px] text-slate-400 hover:text-red-600 font-medium underline cursor-pointer"
                  >
                    Esvaziar carrinho
                  </button>
                </div>
              </>
            )}

          </div>
        )}

        {/* STEP 2: CUSTOMER DETAILS FORM */}
        {checkoutStep === 'details' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Tipo de Comprador:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCustomerData({ ...customerData, type: 'PJ' })}
                  className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                    customerData.type === 'PJ' ? 'bg-[#0F172A] text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Pessoa Jurídica (CNPJ)
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerData({ ...customerData, type: 'PF' })}
                  className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                    customerData.type === 'PF' ? 'bg-[#0F172A] text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Pessoa Física (CPF)
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome do Comprador / Contato *
                </label>
                <input
                  type="text"
                  required
                  value={customerData.name}
                  onChange={e => setCustomerData({ ...customerData, name: e.target.value })}
                  placeholder="Nome completo"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#FF5A00] focus:outline-none"
                />
                {errors.name && <p className="text-red-500 text-[10px] mt-0.5">{errors.name}</p>}
              </div>

              {customerData.type === 'PJ' && (
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Razão Social / Nome da Empresa
                  </label>
                  <input
                    type="text"
                    value={customerData.companyName}
                    onChange={e => setCustomerData({ ...customerData, companyName: e.target.value })}
                    placeholder="Supermercado Silva Ltda"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    WhatsApp para Confirmação *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerData.phone}
                    onChange={e => setCustomerData({ ...customerData, phone: e.target.value })}
                    placeholder="41987654321"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                  {errors.phone && <p className="text-red-500 text-[10px] mt-0.5">{errors.phone}</p>}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {customerData.type === 'PJ' ? 'CNPJ' : 'CPF'}
                  </label>
                  <input
                    type="text"
                    value={customerData.document}
                    onChange={e => setCustomerData({ ...customerData, document: e.target.value })}
                    placeholder="00.000.000/0001-00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Endereço de Entrega *
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Rua / Avenida"
                    value={customerData.street}
                    onChange={e => setCustomerData({ ...customerData, street: e.target.value })}
                    className="col-span-2 px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Nº"
                    value={customerData.number}
                    onChange={e => setCustomerData({ ...customerData, number: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Bairro"
                    value={customerData.neighborhood}
                    onChange={e => setCustomerData({ ...customerData, neighborhood: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={customerData.city}
                    onChange={e => setCustomerData({ ...customerData, city: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="CEP"
                    value={customerData.zipCode}
                    onChange={e => setCustomerData({ ...customerData, zipCode: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Forma de Pagamento Preferida
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomerData({ ...customerData, paymentMethod: 'pix' })}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between cursor-pointer ${
                      customerData.paymentMethod === 'pix' ? 'border-[#16A34A] bg-emerald-50 text-emerald-900 font-bold' : 'border-slate-200'
                    }`}
                  >
                    <span>PIX Instantâneo</span>
                    <QrCode className="w-4 h-4 text-[#16A34A]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCustomerData({ ...customerData, paymentMethod: 'boleto' })}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between cursor-pointer ${
                      customerData.paymentMethod === 'boleto' ? 'border-[#0F172A] bg-slate-100 text-[#0F172A] font-bold' : 'border-slate-200'
                    }`}
                  >
                    <span>Boleto / Faturado</span>
                    <CreditCard className="w-4 h-4 text-slate-700" />
                  </button>
                </div>
              </div>

              {/* Seller rep code */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Código do Vendedor / Representante (Opcional)
                </label>
                <input
                  type="text"
                  value={customerData.sellerCode}
                  onChange={e => setCustomerData({ ...customerData, sellerCode: e.target.value.toUpperCase() })}
                  placeholder="Ex: CARLOS10"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono uppercase"
                />
              </div>

            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS & PIX / WHATSAPP DISPATCH */}
        {checkoutStep === 'success' && createdOrder && (
          <div className="flex-1 overflow-y-auto p-6 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-[#16A34A] flex items-center justify-center mx-auto shadow-md">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>

            <div>
              <h4 className="text-xl font-extrabold text-[#0F172A]">
                Pedido Gerado com Sucesso!
              </h4>
              <p className="text-xs text-slate-500 font-mono mt-1">
                Número do Pedido: <strong className="text-[#FF5A00]">#{createdOrder.orderNumber}</strong>
              </p>
            </div>

            {/* PIX Box */}
            {createdOrder.paymentMethod === 'pix' && (
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-[#16A34A]" />
                    Pagamento via Chave PIX da Loja
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                    CNPJ
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-emerald-200">
                  <span className="font-mono text-xs font-bold text-slate-800 flex-1 truncate">
                    34.567.890/0001-12
                  </span>
                  <button
                    onClick={handleCopyPixKey}
                    className="px-2.5 py-1 rounded-lg bg-[#16A34A] text-white text-xs font-bold flex items-center gap-1 hover:bg-emerald-700 cursor-pointer"
                  >
                    {copiedPix ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedPix ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <p className="text-[10px] text-emerald-800">
                  Transfira o valor de <strong>R$ {createdOrder.total.toFixed(2).replace('.', ',')}</strong> e envie o comprovante no WhatsApp da {storeName}.
                </p>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                onClick={() => dispatchWhatsAppMessage(createdOrder)}
                className="w-full py-3 rounded-2xl bg-[#16A34A] hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Enviar Cópia do Pedido no WhatsApp da Loja
              </button>

              <button
                onClick={() => {
                  setIsCartOpen(false);
                  setCheckoutStep('cart');
                }}
                className="w-full py-2.5 rounded-xl border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Voltar ao Catálogo
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions for Steps 1 & 2 */}
        {checkoutStep !== 'success' && cart.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-[#E2E8F0] bg-slate-50 space-y-3">
            
            {/* Totals Summary */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal dos Produtos:</span>
                <span>R$ {cartSubtotal.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Frete Estimado:</span>
                <span>
                  <strong className="text-[#16A34A]">A combinar</strong>
                </span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-[#0F172A] pt-1 border-t border-[#E2E8F0]">
                <span>Total Estimado:</span>
                <span className="text-[#0F172A]">R$ {orderTotal.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            {/* Buttons based on step */}
            {checkoutStep === 'cart' ? (
              <button
                onClick={handleProceedToDetails}
                disabled={isBelowMinOrder}
                className={`w-full py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                  isBelowMinOrder
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-[#FF5A00] hover:bg-[#D94E00] text-white cursor-pointer'
                }`}
                id="btn-cart-proceed"
              >
                <span>Avançar para Entrega e Pagamento</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCheckoutStep('cart')}
                  className="py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={() => handleFinishOrder(true)}
                  className="py-2.5 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-colors"
                  id="btn-finish-whatsapp"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Finalizar no WhatsApp
                </button>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};
