import React, { useState } from 'react';
import { 
  Building2, 
  Store, 
  ShieldCheck, 
  Code2, 
  ShoppingCart, 
  ExternalLink, 
  Plus, 
  ChevronDown, 
  User, 
  Sparkles,
  Layers,
  RotateCcw,
  LogIn,
  LogOut,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export const Header: React.FC<{ onOpenNewTenantModal?: () => void }> = ({ onOpenNewTenantModal }) => {
  const {
    viewMode,
    setViewMode,
    currentTenant,
    tenants,
    setCurrentTenantId,
    cartItemsCount,
    setIsCartOpen,
    showToast,
    resetToDefaultData
  } = useApp();

  const {
    session,
    user,
    isPlatformAdmin,
    canAccessTenantAdmin,
    canAccessSuperAdmin,
    authRole,
    openLoginModal,
    signOut
  } = useAuth();

  const [isTenantMenuOpen, setIsTenantMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-md">
      {/* Top Banner for Tenant Mode Info */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-1 text-xs text-center font-medium text-white flex items-center justify-center gap-2">
        <Sparkles className="w-3.5 h-3.5" />
        <span>
          <strong>Plataforma SaaS Multi-Tenant:</strong> Gerencie MC Distribuição ou cadastre novos lojistas e revenda com marca própria!
        </span>
        <button 
          onClick={resetToDefaultData} 
          title="Restaurar dados de teste"
          className="ml-3 underline hover:text-blue-100 flex items-center gap-1 opacity-80 hover:opacity-100 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" /> Restaurar Demo
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand & Active Tenant Selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <div className="hidden sm:block">
                <div className="font-extrabold tracking-tight text-base leading-tight font-['Outfit'] text-white flex items-center gap-1.5">
                  OmniCatálogo <span className="text-[10px] uppercase font-bold tracking-widest bg-blue-500/20 text-blue-300 border border-blue-400/30 px-1.5 py-0.5 rounded">SaaS Multi-tenant</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Supabase + Resend + Netlify Ready
                </div>
              </div>
            </div>

            {/* Tenant Selector Pill */}
            <div className="relative">
              <button
                onClick={() => setIsTenantMenuOpen(!isTenantMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-200 transition-colors"
                id="tenant-switcher-button"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-white max-w-[130px] sm:max-w-[180px] truncate">
                  {currentTenant.name}
                </span>
                <span className="text-[10px] bg-slate-700 px-1.5 py-0.2 rounded text-slate-300 uppercase">
                  {currentTenant.plan}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isTenantMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsTenantMenuOpen(false)}
                  />
                  <div className="absolute left-0 mt-2 w-72 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl z-50 p-2 text-xs">
                    <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Selecione a Empresa / Catálogo
                    </div>
                    
                    <div className="space-y-1 my-1 max-h-60 overflow-y-auto">
                      {tenants.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setCurrentTenantId(t.id);
                            setIsTenantMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                            t.id === currentTenant.id
                              ? 'bg-blue-600 text-white font-medium'
                              : 'text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          <div className="truncate">
                            <div className="font-medium truncate">{t.name}</div>
                            <div className="text-[10px] opacity-75">/{t.slug}</div>
                          </div>
                          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-black/20">
                            {t.plan}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-700 mt-1">
                      <button
                        onClick={() => {
                          setIsTenantMenuOpen(false);
                          onOpenNewTenantModal?.();
                        }}
                        className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center gap-1.5 font-medium transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Cadastrar Nova Empresa / Loja
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Navigation View Tabs */}
          <nav className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 overflow-x-auto text-xs">
            <button
              onClick={() => {
                if (!session) {
                  openLoginModal('tenant_admin');
                } else if (!canAccessTenantAdmin) {
                  showToast('Acesso bloqueado: Requer perfil de Administrador desta loja (Tenant Admin).');
                } else {
                  setViewMode('tenant_admin');
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                viewMode === 'tenant_admin'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
              id="nav-tenant-admin"
              title={!session ? 'Login necessário para acessar' : !canAccessTenantAdmin ? 'Acesso restrito ao administrador da loja' : 'Painel de Gestão da Loja'}
            >
              <Store className="w-4 h-4" />
              <span>Painel da Loja</span>
              {!session && <Lock className="w-3 h-3 text-slate-500 ml-0.5" />}
            </button>

            <button
              onClick={() => setViewMode('storefront')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                viewMode === 'storefront'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
              id="nav-storefront"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Catálogo Público</span>
            </button>

            <button
              onClick={() => {
                if (!session) {
                  openLoginModal('superadmin');
                } else if (!canAccessSuperAdmin) {
                  showToast('Acesso bloqueado: Requer perfil de Administrador Global (Platform Admin).');
                } else {
                  setViewMode('superadmin');
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                viewMode === 'superadmin'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
              id="nav-superadmin"
              title={!session ? 'Login necessário para acessar' : !canAccessSuperAdmin ? 'Acesso restrito a Platform Admin' : 'Painel Master Global'}
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden md:inline">Painel Master</span>
              <span className="md:hidden">Master</span>
              {!session && <Lock className="w-3 h-3 text-slate-500 ml-0.5" />}
            </button>

            <button
              onClick={() => setViewMode('blueprint_guide')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                viewMode === 'blueprint_guide'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
              id="nav-blueprint-guide"
            >
              <Code2 className="w-4 h-4 text-emerald-300" />
              <span className="hidden sm:inline font-semibold text-emerald-200">Guia de Revenda & SQL</span>
              <span className="sm:hidden">Guia</span>
            </button>
          </nav>

          {/* Right Action: Cart, Login button, or User Badge */}
          <div className="flex items-center gap-2">
            {viewMode === 'storefront' && (
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl font-semibold text-xs transition-all shadow-md shadow-emerald-900/30 cursor-pointer"
                id="header-cart-button"
              >
                <ShoppingCart className="w-4 h-4" />
                <span className="hidden sm:inline">Ver Pedido</span>
                {cartItemsCount > 0 && (
                  <span className="w-5 h-5 bg-white text-emerald-700 font-extrabold rounded-full flex items-center justify-center text-[11px] shadow-sm">
                    {cartItemsCount}
                  </span>
                )}
              </button>
            )}

            {/* Authentication state indicator */}
            {!session ? (
              <button
                onClick={() => openLoginModal()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white font-semibold text-xs transition-colors border border-blue-500/50 shadow-sm cursor-pointer"
                id="header-login-button"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Entrar</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isPlatformAdmin 
                      ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-sm ring-1 ring-indigo-400/50' 
                      : 'bg-gradient-to-tr from-blue-500 to-cyan-600 text-white shadow-sm'
                  }`}>
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="hidden lg:block text-left leading-tight max-w-[130px]">
                    <div className="font-semibold text-slate-200 text-[11px] truncate">
                      {user?.email}
                    </div>
                    <div className="text-[10px]">
                      {isPlatformAdmin ? (
                        <span className="text-indigo-400 font-semibold">Platform Admin</span>
                      ) : (authRole === 'tenant_admin' || canAccessTenantAdmin) ? (
                        <span className="text-blue-400 font-medium">Tenant Admin</span>
                      ) : authRole ? (
                        <span className="text-slate-300 capitalize">{authRole.replace('_', ' ')}</span>
                      ) : (
                        <span className="text-slate-400">Autenticado</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={signOut}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-300 text-slate-400 border border-slate-700/80 transition-colors cursor-pointer"
                  title="Encerrar Sessão (Logout)"
                  id="header-logout-button"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};

