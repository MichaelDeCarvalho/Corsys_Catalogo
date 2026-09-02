import React, { useState } from 'react';
import { 
  Settings, 
  Palette, 
  Phone, 
  QrCode, 
  Truck, 
  Mail, 
  Globe, 
  Check, 
  Sparkles, 
  Building,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TenantCustomization } from '../../types';

export const StoreSettings: React.FC = () => {
  const { currentTenant, updateTenantCustomization, showToast } = useApp();

  const [formData, setFormData] = useState<TenantCustomization>({
    ...currentTenant.customization
  });

  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateTenantCustomization(currentTenant.id, formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-['Outfit'] flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Identidade Visual, Contatos & Regras de Venda
          </h2>
          <p className="text-xs text-slate-500">
            Personalize a aparência do catálogo, WhatsApp de recebimento de pedidos, chave PIX e políticas de frete de {currentTenant.name}
          </p>
        </div>

        <button
          onClick={handleSubmit}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
        >
          {isSaved ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
          {isSaved ? 'Alterações Salvas!' : 'Salvar Configurações'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Basic Store Info */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building className="w-4 h-4 text-blue-600" />
            Dados da Empresa & Domínio
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Razão Social / Nome da Empresa
              </label>
              <input
                type="text"
                value={formData.businessName}
                onChange={e => setFormData({ ...formData, businessName: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nome Fantasia (Exibido no Topo)
              </label>
              <input
                type="text"
                value={formData.tradeName || ''}
                onChange={e => setFormData({ ...formData, tradeName: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                CNPJ / CPF
              </label>
              <input
                type="text"
                value={formData.cnpjCpf || ''}
                onChange={e => setFormData({ ...formData, cnpjCpf: e.target.value })}
                placeholder="00.000.000/0001-00"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Slug do Catálogo
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={e => setFormData({ ...formData, slug: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono text-blue-700 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Domínio Personalizado (Opcional)
              </label>
              <input
                type="text"
                value={formData.customDomain || ''}
                onChange={e => setFormData({ ...formData, customDomain: e.target.value })}
                placeholder="catalogo.minhaempresa.com.br"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
              />
            </div>
          </div>
        </div>

        {/* Visual Identity & Colors */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Palette className="w-4 h-4 text-blue-600" />
            Identidade Visual & Cores da Marca (Whitelabel)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Cor Principal da Loja (Botões, Destaques)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.primaryColor}
                  onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="w-10 h-10 rounded-xl border border-slate-300 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={formData.primaryColor}
                  onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Texto da Faixa Superior de Anúncios / Avisos
              </label>
              <input
                type="text"
                value={formData.announcementText || ''}
                onChange={e => setFormData({ ...formData, announcementText: e.target.value })}
                placeholder="Ex: 📦 Pedido mínimo de R$ 250 | Frete Grátis na Grande SP"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                URL da Logomarca
              </label>
              <input
                type="url"
                value={formData.logoUrl}
                onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                URL do Banner de Capa
              </label>
              <input
                type="url"
                value={formData.bannerUrl}
                onChange={e => setFormData({ ...formData, bannerUrl: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>
        </div>

        {/* WhatsApp & Pix */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Phone className="w-4 h-4 text-emerald-600" />
            WhatsApp de Pedidos & Pagamento PIX
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                WhatsApp que Receberá os Pedidos *
              </label>
              <input
                type="text"
                value={formData.whatsappNumber}
                onChange={e => setFormData({ ...formData, whatsappNumber: e.target.value })}
                placeholder="5511987654321"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono text-emerald-700 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Chave PIX da Empresa
              </label>
              <input
                type="text"
                value={formData.pixKey || ''}
                onChange={e => setFormData({ ...formData, pixKey: e.target.value })}
                placeholder="CNPJ, CPF, E-mail ou Telefone"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Tipo da Chave PIX
              </label>
              <select
                value={formData.pixKeyType || 'cnpj'}
                onChange={e => setFormData({ ...formData, pixKeyType: e.target.value as any })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              >
                <option value="cnpj">CNPJ</option>
                <option value="cpf">CPF</option>
                <option value="email">E-mail</option>
                <option value="phone">Telefone</option>
                <option value="random">Chave Aleatória</option>
              </select>
            </div>
          </div>
        </div>

        {/* Commercial Policies & B2B Rules */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Truck className="w-4 h-4 text-blue-600" />
            Políticas Comerciais & Atacado B2B
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Valor do Pedido Mínimo (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.minOrderValue}
                onChange={e => setFormData({ ...formData, minOrderValue: Number(e.target.value) })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-900"
              />
              <p className="text-[11px] text-slate-400 mt-1">O cliente não poderá finalizar pedidos abaixo deste valor.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Frete Fixo (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.deliveryMethods.fixedFreightValue || 0}
                onChange={e => setFormData({
                  ...formData,
                  deliveryMethods: {
                    ...formData.deliveryMethods,
                    fixedFreightValue: Number(e.target.value)
                  }
                })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Frete Grátis a Partir de (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.deliveryMethods.freeFreightThreshold || 0}
                onChange={e => setFormData({
                  ...formData,
                  deliveryMethods: {
                    ...formData.deliveryMethods,
                    freeFreightThreshold: Number(e.target.value)
                  }
                })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-emerald-700 font-bold"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.allowB2BMode}
                onChange={e => setFormData({ ...formData, allowB2BMode: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-xs font-bold text-slate-800">
                Ativar "Grade de Pedido Rápido B2B" no catálogo
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enableResendEmail}
                onChange={e => setFormData({ ...formData, enableResendEmail: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-xs font-bold text-slate-800">
                Enviar cópia do pedido por e-mail via Resend
              </span>
            </label>
          </div>

        </div>

      </form>

    </div>
  );
};
