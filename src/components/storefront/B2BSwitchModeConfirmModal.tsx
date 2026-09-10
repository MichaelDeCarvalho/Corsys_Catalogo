import React from 'react';
import { AlertTriangle, RotateCcw, Trash2, X, AlertCircle } from 'lucide-react';
import { useWholesaleAccess } from '../../context/WholesaleAccessContext';
import { useApp } from '../../context/AppContext';

export const B2BSwitchModeConfirmModal: React.FC = () => {
  const { 
    isSwitchModeDialogOpen, 
    targetPendingMode, 
    confirmSwitchPurchaseMode, 
    cancelSwitchPurchaseMode 
  } = useWholesaleAccess();
  const { cart } = useApp();

  if (!isSwitchModeDialogOpen || !targetPendingMode) return null;

  const isSwitchingToWholesale = targetPendingMode === 'wholesale';

  // Analisa itens incompatíveis para o modo atacado
  const incompatibleItems = cart.filter(item => {
    if (targetPendingMode !== 'wholesale') return false;
    const participates = Boolean(
      item.product.wholesaleEnabled &&
      item.product.wholesalePrice !== null &&
      item.product.wholesalePrice !== undefined &&
      item.product.wholesalePrice > 0
    );
    if (!participates) return true;
    const minQty = item.product.wholesaleMinQuantity || 1;
    if (item.product.stock < minQty) return true;
    return false;
  });

  const hasIncompatible = incompatibleItems.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative overflow-hidden"
        id="b2b-switch-mode-modal"
      >
        <button
          onClick={cancelSwitchPurchaseMode}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center mb-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
            hasIncompatible 
              ? 'bg-rose-50 border border-rose-100 text-rose-600' 
              : 'bg-amber-50 border border-amber-100 text-amber-600'
          }`}>
            {hasIncompatible ? <AlertCircle className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
          </div>
        </div>

        <div className="text-center space-y-2 mb-5">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">
            Alternar para {isSwitchingToWholesale ? 'Atacado' : 'Varejo'}?
          </h3>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            Você possui itens no carrinho. As políticas de preços e regras de quantidade mínima são distintas entre as modalidades.
          </p>
        </div>

        {/* Cenário: Existem produtos incompatíveis no carrinho */}
        {hasIncompatible && (
          <div className="mb-5 space-y-2.5">
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <strong className="block font-bold">Atenção: Itens Incompatíveis Detectados</strong>
              <p className="text-[11px] text-amber-800">
                Os seguintes produtos não atendem aos critérios de atacado (exclusivos de varejo ou estoque menor que o mínimo exigido) e <strong>NÃO</strong> serão removidos automaticamente sem sua autorização:
              </p>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
              {incompatibleItems.map((item, idx) => {
                const minQty = item.product.wholesaleMinQuantity || 1;
                const isRetailOnly = !item.product.wholesaleEnabled || !item.product.wholesalePrice;
                const reason = isRetailOnly 
                  ? 'Exclusivo de Varejo' 
                  : `Estoque insuficiente (Disp.: ${item.product.stock}, Mín.: ${minQty})`;

                return (
                  <div key={`${item.product.id}-${idx}`} className="flex items-center justify-between text-xs p-1.5 bg-white rounded-lg border border-slate-100">
                    <span className="font-semibold text-slate-800 truncate max-w-[220px]">{item.product.name}</span>
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded shrink-0">
                      {reason}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cenário: Todos compatíveis */}
        {!hasIncompatible && isSwitchingToWholesale && (
          <div className="mb-5 p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900">
            <p>
              Todos os itens no seu carrinho participam do Atacado. Ao confirmar, os preços serão atualizados e as quantidades ajustadas para os mínimos exigidos por SKU. Pedido mínimo geral: <strong>R$ 1.000,00</strong>.
            </p>
          </div>
        )}

        <div className="space-y-2.5">
          {hasIncompatible ? (
            <>
              <button
                type="button"
                onClick={() => confirmSwitchPurchaseMode('remove_incompatible')}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                id="btn-remove-incompatible-and-switch"
              >
                <Trash2 className="w-4 h-4 text-slate-950" />
                <span>Remover incompatíveis ({incompatibleItems.length}) e mudar para Atacado</span>
              </button>

              <button
                type="button"
                onClick={() => confirmSwitchPurchaseMode('clear')}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar Todo o Carrinho e Iniciar Novo Pedido</span>
              </button>

              <button
                type="button"
                onClick={cancelSwitchPurchaseMode}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors cursor-pointer"
              >
                <span>Continuar no Varejo (Cancelar)</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => confirmSwitchPurchaseMode('recalculate')}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 text-white font-bold text-xs sm:text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                id="btn-confirm-switch-mode"
              >
                <RotateCcw className="w-4 h-4 text-emerald-400" />
                <span>Confirmar e Recalcular Carrinho para {isSwitchingToWholesale ? 'Atacado' : 'Varejo'}</span>
              </button>

              <button
                type="button"
                onClick={() => confirmSwitchPurchaseMode('clear')}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Carrinho e Iniciar Novo Pedido</span>
              </button>

              <button
                type="button"
                onClick={cancelSwitchPurchaseMode}
                className="w-full py-2.5 px-4 rounded-xl text-slate-500 hover:text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                <span>Continuar no modo atual (Cancelar)</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
