import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useApp } from './AppContext';
import { WholesaleItemData, WholesaleCustomerStatus } from '../types';
import { fetchMyWholesaleStatus, fetchWholesaleCatalog } from '../services/wholesaleService';

export type PurchaseMode = 'retail' | 'wholesale';
export type WholesaleAccessStatus = 'unauthenticated' | WholesaleCustomerStatus;

export interface WholesaleCompanyInfo {
  legalName: string;
  tradeName?: string | null;
  cnpj: string;
  contactName: string;
  email: string;
  phone: string;
}

export interface WholesaleAccessContextType {
  // Modalidade de Compra
  purchaseMode: PurchaseMode;
  setPurchaseMode: (mode: PurchaseMode) => void;
  requestSwitchPurchaseMode: (mode: PurchaseMode) => void;

  // Estado de Autorização B2B
  wholesaleStatus: WholesaleAccessStatus;
  isApproved: boolean;
  isPending: boolean;
  isSuspended: boolean;
  isRejected: boolean;
  wholesaleCompany: WholesaleCompanyInfo | null;
  loadingStatus: boolean;

  // Catálogo Atacadista Autorizado (Map productId -> WholesaleItemData)
  wholesaleCatalogMap: Map<string, WholesaleItemData>;
  isLoadingWholesaleCatalog: boolean;
  wholesaleCatalogError: string | null;
  getWholesaleItem: (productId: string) => WholesaleItemData | undefined;

  // Ações de Atualização
  refreshWholesaleStatus: () => Promise<void>;
  loadWholesaleCatalog: () => Promise<void>;
  clearWholesaleSession: () => void;

  // Controle de Modais B2B
  isB2BGateModalOpen: boolean;
  openB2BGateModal: () => void;
  closeB2BGateModal: () => void;

  isB2BRegisterModalOpen: boolean;
  openB2BRegisterModal: () => void;
  closeB2BRegisterModal: () => void;

  isSwitchModeDialogOpen: boolean;
  targetPendingMode: PurchaseMode | null;
  confirmSwitchPurchaseMode: (action: 'recalculate' | 'clear' | 'remove_incompatible') => void;
  cancelSwitchPurchaseMode: () => void;
}

const WholesaleAccessContext = createContext<WholesaleAccessContextType | undefined>(undefined);

export const WholesaleAccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, openLoginModal } = useAuth();
  const { cart, clearCart, showToast, currentTenant, setShoppingMode, confirmShoppingModeChange } = useApp();

  const [purchaseMode, setPurchaseModeState] = useState<PurchaseMode>('retail');
  const [wholesaleStatus, setWholesaleStatus] = useState<WholesaleAccessStatus>('unauthenticated');
  const [wholesaleCompany, setWholesaleCompany] = useState<WholesaleCompanyInfo | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(false);

  // Projeção autorizada de atacado (mantida estritamente em memória de sessão)
  const [wholesaleCatalogMap, setWholesaleCatalogMap] = useState<Map<string, WholesaleItemData>>(new Map());
  const [isLoadingWholesaleCatalog, setIsLoadingWholesaleCatalog] = useState<boolean>(false);
  const [wholesaleCatalogError, setWholesaleCatalogError] = useState<string | null>(null);

  // Modais de Acesso B2B
  const [isB2BGateModalOpen, setIsB2BGateModalOpen] = useState(false);
  const [isB2BRegisterModalOpen, setIsB2BRegisterModalOpen] = useState(false);
  const [isSwitchModeDialogOpen, setIsSwitchModeDialogOpen] = useState(false);
  const [targetPendingMode, setTargetPendingMode] = useState<PurchaseMode | null>(null);

  const activeTenantSlug = useMemo(() => {
    return currentTenant?.slug || (import.meta as any).env?.VITE_PUBLIC_TENANT_SLUG || 'corsys-catalogo-demo';
  }, [currentTenant?.slug]);

  // Limpeza de cache e dados autorizados de atacado (ao deslogar ou revogar)
  const clearWholesaleSession = useCallback(() => {
    setPurchaseModeState('retail');
    setShoppingMode('retail');
    setWholesaleStatus('unauthenticated');
    setWholesaleCompany(null);
    setWholesaleCatalogMap(new Map());
    setWholesaleCatalogError(null);
  }, [setShoppingMode]);

  // Carrega status B2B do usuário autenticado no tenant ativo
  const refreshWholesaleStatus = useCallback(async () => {
    if (!user) {
      clearWholesaleSession();
      return;
    }

    setLoadingStatus(true);
    try {
      const res = await fetchMyWholesaleStatus(activeTenantSlug);
      if (res.status === 'approved') {
        setWholesaleStatus('approved');
        setWholesaleCompany({
          legalName: res.legalName || 'Empresa Cadastrada',
          tradeName: res.tradeName,
          cnpj: res.cnpj || '',
          contactName: res.contactName || '',
          email: res.email || user.email || '',
          phone: res.phone || ''
        });
      } else if (res.status === 'pending') {
        setWholesaleStatus('pending');
        setWholesaleCompany({
          legalName: res.legalName || 'Empresa em Análise',
          tradeName: res.tradeName,
          cnpj: res.cnpj || '',
          contactName: res.contactName || '',
          email: res.email || user.email || '',
          phone: res.phone || ''
        });
      } else if (res.status === 'suspended') {
        setWholesaleStatus('suspended');
        setWholesaleCompany(null);
        setPurchaseModeState('retail');
      } else if (res.status === 'rejected') {
        setWholesaleStatus('rejected');
        setWholesaleCompany(null);
        setPurchaseModeState('retail');
      } else {
        setWholesaleStatus('unauthenticated');
        setWholesaleCompany(null);
        setPurchaseModeState('retail');
      }
    } catch (err) {
      console.warn('[WholesaleAccessContext] Erro ao carregar status:', err);
      setWholesaleStatus('unauthenticated');
      setWholesaleCompany(null);
    } finally {
      setLoadingStatus(false);
    }
  }, [user, activeTenantSlug, clearWholesaleSession]);

  // Carrega a projeção de preços atacadistas via RPC
  const loadWholesaleCatalog = useCallback(async () => {
    if (wholesaleStatus !== 'approved') {
      return;
    }

    setIsLoadingWholesaleCatalog(true);
    setWholesaleCatalogError(null);
    try {
      const items = await fetchWholesaleCatalog(activeTenantSlug);
      const newMap = new Map<string, WholesaleItemData>();
      for (const it of items) {
        newMap.set(it.productId, it);
      }
      setWholesaleCatalogMap(newMap);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar catálogo B2B';
      console.error('[WholesaleAccessContext] Erro no catálogo atacadista:', err);
      setWholesaleCatalogError(msg);
      showToast(`Acesso ao atacado: ${msg}`);
      // Fallback para varejo em caso de falha de autorização
      setPurchaseModeState('retail');
    } finally {
      setIsLoadingWholesaleCatalog(false);
    }
  }, [wholesaleStatus, activeTenantSlug, showToast]);

  // Observa mudanças na autenticação do usuário
  useEffect(() => {
    if (user) {
      refreshWholesaleStatus();
    } else {
      clearWholesaleSession();
    }
  }, [user, refreshWholesaleStatus, clearWholesaleSession]);

  // Quando o status passa para approved e o usuário está no modo atacado, carrega o catálogo
  useEffect(() => {
    if (wholesaleStatus === 'approved' && purchaseMode === 'wholesale' && wholesaleCatalogMap.size === 0) {
      loadWholesaleCatalog();
    }
  }, [wholesaleStatus, purchaseMode, wholesaleCatalogMap.size, loadWholesaleCatalog]);

  const isApproved = wholesaleStatus === 'approved';
  const isPending = wholesaleStatus === 'pending';
  const isSuspended = wholesaleStatus === 'suspended';
  const isRejected = wholesaleStatus === 'rejected';

  // Solicitação de mudança de modalidade com verificação de autorização e proteção de carrinho
  const requestSwitchPurchaseMode = (targetMode: PurchaseMode) => {
    if (targetMode === purchaseMode) return;

    if (targetMode === 'wholesale') {
      // 1. Não autenticado: abre modal gate B2B
      if (!user) {
        setIsB2BGateModalOpen(true);
        return;
      }

      // 2. Status pendente: feedback informativo
      if (isPending) {
        showToast('Cadastro atacadista em análise. Aguarde a validação da nossa equipe comercial.');
        return;
      }

      // 3. Status suspenso
      if (isSuspended) {
        showToast('Acesso atacadista temporariamente indisponível. Entre em contato com a loja.');
        return;
      }

      // 4. Status rejeitado
      if (isRejected) {
        showToast('Cadastro atacadista não aprovado. Entre em contato com o suporte para mais informações.');
        return;
      }

      // 5. Usuário sem cadastro B2B
      if (!isApproved) {
        setIsB2BGateModalOpen(true);
        return;
      }
    }

    // Se o carrinho possui itens, exige confirmação para não misturar modalidades
    if (cart.length > 0) {
      setTargetPendingMode(targetMode);
      setIsSwitchModeDialogOpen(true);
      return;
    }

    // Troca direta com carrinho vazio
    setPurchaseModeState(targetMode);
    setShoppingMode(targetMode);
    if (targetMode === 'wholesale') {
      loadWholesaleCatalog();
      showToast('Modalidade ATACADO ativada. Pedido mínimo: R$ 1.000,00.');
    } else {
      showToast('Modalidade VAREJO ativada. Pedido mínimo: R$ 400,00.');
    }
  };

  const confirmSwitchPurchaseMode = (action: 'recalculate' | 'clear' | 'remove_incompatible') => {
    if (!targetPendingMode) return;

    if (action === 'clear') {
      clearCart();
      setPurchaseModeState(targetPendingMode);
      setShoppingMode(targetPendingMode);
      if (targetPendingMode === 'wholesale') {
        loadWholesaleCatalog();
      }
      showToast(`Modalidade alterada para ${targetPendingMode === 'wholesale' ? 'ATACADO' : 'VAREJO'}. Carrinho reiniciado.`);
    } else {
      // Recalcular mantendo produtos ou removendo incompatíveis com autorização explícita
      setPurchaseModeState(targetPendingMode);
      setShoppingMode(targetPendingMode);
      if (targetPendingMode === 'wholesale') {
        loadWholesaleCatalog();
      }
      confirmShoppingModeChange(action);
    }

    setIsSwitchModeDialogOpen(false);
    setTargetPendingMode(null);
  };

  const cancelSwitchPurchaseMode = () => {
    setIsSwitchModeDialogOpen(false);
    setTargetPendingMode(null);
  };

  const getWholesaleItem = (productId: string): WholesaleItemData | undefined => {
    return wholesaleCatalogMap.get(productId);
  };

  const openB2BGateModal = () => setIsB2BGateModalOpen(true);
  const closeB2BGateModal = () => setIsB2BGateModalOpen(false);
  const openB2BRegisterModal = () => {
    setIsB2BGateModalOpen(false);
    setIsB2BRegisterModalOpen(true);
  };
  const closeB2BRegisterModal = () => setIsB2BRegisterModalOpen(false);

  return (
    <WholesaleAccessContext.Provider
      value={{
        purchaseMode,
        setPurchaseMode: setPurchaseModeState,
        requestSwitchPurchaseMode,
        wholesaleStatus,
        isApproved,
        isPending,
        isSuspended,
        isRejected,
        wholesaleCompany,
        loadingStatus,
        wholesaleCatalogMap,
        isLoadingWholesaleCatalog,
        wholesaleCatalogError,
        getWholesaleItem,
        refreshWholesaleStatus,
        loadWholesaleCatalog,
        clearWholesaleSession,
        isB2BGateModalOpen,
        openB2BGateModal,
        closeB2BGateModal,
        isB2BRegisterModalOpen,
        openB2BRegisterModal,
        closeB2BRegisterModal,
        isSwitchModeDialogOpen,
        targetPendingMode,
        confirmSwitchPurchaseMode,
        cancelSwitchPurchaseMode,
      }}
    >
      {children}
    </WholesaleAccessContext.Provider>
  );
};

export const useWholesaleAccess = (): WholesaleAccessContextType => {
  const context = useContext(WholesaleAccessContext);
  if (!context) {
    throw new Error('useWholesaleAccess deve ser utilizado dentro de um WholesaleAccessProvider');
  }
  return context;
};
