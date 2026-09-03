import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  Star, 
  Package, 
  Tag, 
  DollarSign, 
  Percent, 
  UploadCloud, 
  Download, 
  X, 
  Check, 
  Layers,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, WholesaleTier } from '../../types';
import { getSafeProductImage, handleProductImageError } from '../../utils/productImages';

export const ProductManager: React.FC = () => {
  const { 
    currentTenant, 
    currentTenantProducts, 
    addProduct, 
    updateProduct, 
    deleteProduct, 
    toggleProductStatus,
    showToast 
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'list' | 'bulk_images'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    sku: '',
    barcode: '',
    category: 'Geral',
    subcategory: '',
    brand: '',
    description: '',
    costPrice: 0,
    price: 0,
    promotionalPrice: 0,
    wholesalePrice: 0,
    wholesaleTiers: [],
    minOrderQuantity: 1,
    stock: 10,
    unit: 'un',
    images: [],
    featured: false,
    active: true,
    tags: []
  });

  const [newTierQty, setNewTierQty] = useState(5);
  const [newTierPrice, setNewTierPrice] = useState(0);

  // Unique categories
  const categories = Array.from(new Set(currentTenantProducts.map(p => p.category))).filter(Boolean);

  const filteredProducts = currentTenantProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleOpenNewModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: `${currentTenant.slug.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      barcode: `789${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      category: categories[0] || 'Geral',
      subcategory: '',
      brand: currentTenant.name,
      description: '',
      costPrice: 50,
      price: 99.90,
      promotionalPrice: 0,
      wholesalePrice: 85.00,
      wholesaleTiers: [
        { minQuantity: 5, price: 79.90, discountPercentage: 10 }
      ],
      minOrderQuantity: 1,
      stock: 50,
      unit: 'un',
      images: [],
      featured: false,
      active: true,
      tags: ['Destaque']
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({ ...product });
    setIsModalOpen(true);
  };

  const handleAddTier = () => {
    if (newTierQty <= 1 || newTierPrice <= 0) {
      showToast('Preencha a quantidade mínima e o preço especial do atacado');
      return;
    }
    const currentTiers = formData.wholesaleTiers || [];
    const basePrice = formData.price || newTierPrice;
    const discount = Math.round(((basePrice - newTierPrice) / basePrice) * 100);

    setFormData({
      ...formData,
      wholesaleTiers: [
        ...currentTiers,
        { minQuantity: newTierQty, price: newTierPrice, discountPercentage: discount > 0 ? discount : 0 }
      ]
    });
    setNewTierQty(newTierQty + 5);
    setNewTierPrice(Math.round(newTierPrice * 0.95));
  };

  const handleRemoveTier = (index: number) => {
    const currentTiers = [...(formData.wholesaleTiers || [])];
    currentTiers.splice(index, 1);
    setFormData({ ...formData, wholesaleTiers: currentTiers });
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      showToast('Nome do produto é obrigatório');
      return;
    }

    if (editingProduct) {
      updateProduct(editingProduct.id, formData);
    } else {
      addProduct({
        tenantId: currentTenant.id,
        name: formData.name || '',
        sku: formData.sku || `SKU-${Date.now().toString().slice(-4)}`,
        barcode: formData.barcode,
        category: formData.category || 'Geral',
        subcategory: formData.subcategory,
        brand: formData.brand,
        description: formData.description || '',
        costPrice: Number(formData.costPrice) || 0,
        price: Number(formData.price) || 0,
        promotionalPrice: Number(formData.promotionalPrice) || undefined,
        wholesalePrice: Number(formData.wholesalePrice) || undefined,
        wholesaleTiers: formData.wholesaleTiers,
        minOrderQuantity: Number(formData.minOrderQuantity) || 1,
        stock: Number(formData.stock) || 0,
        unit: formData.unit || 'un',
        images: formData.images && formData.images.length > 0 ? formData.images : ['https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&auto=format&fit=crop&q=80'],
        featured: formData.featured,
        active: formData.active !== false,
        tags: formData.tags
      });
    }

    setIsModalOpen(false);
  };

  const handleExportCSV = () => {
    const headers = 'ID,Nome,SKU,Categoria,Preco_Varejo,Preco_Atacado,Estoque,Unidade\n';
    const rows = currentTenantProducts.map(p => 
      `"${p.id}","${p.name.replace(/"/g, '""')}","${p.sku}","${p.category}",${p.price},${p.wholesalePrice || p.price},${p.stock},"${p.unit}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `catalogo_${currentTenant.slug}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Planilha de produtos exportada!');
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-['Outfit'] flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Catálogo & Gestão de Estoque
          </h2>
          <p className="text-xs text-slate-500">
            Gerencie preços de atacado/varejo, fotos, códigos SKU e regras de escala para {currentTenant.name}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors"
            title="Exportar catálogo em CSV/Excel"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>

          <button
            onClick={handleOpenNewModal}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            id="btn-add-product"
          >
            <Plus className="w-4 h-4" />
            Novo Produto
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs: Catálogo vs Importação de Imagens em Massa */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'list'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Package className="w-4 h-4" />
          Produtos ({currentTenantProducts.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bulk_images')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'bulk_images'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          Importar Imagens em Massa
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
            activeTab === 'bulk_images' ? 'bg-blue-500 text-white' : 'bg-amber-100 text-amber-800'
          }`}>
            Pendente Storage V2
          </span>
        </button>
      </div>

      {activeTab === 'bulk_images' ? (
        /* Painel Arquitetural: Importação de Imagens em Massa */
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold">Módulo de Importação de Imagens em Massa</h3>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  O upload será habilitado após a configuração do Supabase Storage V2 (em etapa posterior dedicada a Storage, Upload e Policies).
                  Conforme a diretriz de integridade do projeto, o upload remoto em lote será ativado somente após
                  a criação do bucket seguro e das políticas RLS. Nenhum upload falso ou simulado é executado nesta etapa.
                </p>
              </div>
            </div>
          </div>

          {/* Guidelines and SKU association specs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">1</div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Associação Estrita por SKU</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                As imagens devem ser nomeadas com o código SKU exato do produto (ex: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">BR090.jpg</code> ou <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">CU010.webp</code>).
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">2</div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Formatos e Otimização</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Formatos aceitos inicialmente: JPG/JPEG, PNG e WebP. Resolução recomendada de 800x800px a 1200x1200px. O limite de 2MB é uma recomendação inicial configurável; a otimização de armazenamento final será feita na etapa de Storage.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">3</div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Supabase Storage V2</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Bucket dedicado <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">product-images</code> com isolamento por tenant. URLs originais V1 permanecem preservadas como referência histórica.
              </p>
            </div>
          </div>

          {/* Reference SKU table for batch preparation */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Referência de SKUs para Lote de Imagens ({currentTenantProducts.length} itens)</h4>
                <p className="text-xs text-slate-500">Utilize os códigos abaixo para preparar os arquivos de imagem com nomenclatura correspondente</p>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">SKU</th>
                    <th className="py-2.5 px-4">Nome do Produto</th>
                    <th className="py-2.5 px-4">Categoria</th>
                    <th className="py-2.5 px-4">Nome Sugerido do Arquivo</th>
                    <th className="py-2.5 px-4 text-center">Status da Referência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentTenantProducts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-2 px-4 font-mono font-bold text-blue-700">{p.sku}</td>
                      <td className="py-2 px-4 font-medium text-slate-800 line-clamp-1">{p.name}</td>
                      <td className="py-2 px-4 text-slate-500">{p.category}</td>
                      <td className="py-2 px-4 font-mono text-[11px] text-slate-600">{p.sku.toLowerCase()}.[jpg|png|webp]</td>
                      <td className="py-2 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {p.images?.[0] ? 'Referência original preservada' : 'Sem imagem'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Filter and Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, SKU, categoria..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Categoria:</span>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none font-medium"
              >
                <option value="all">Todas ({currentTenantProducts.length})</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

      {/* Products Grid / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Produto</th>
                <th className="py-3.5 px-4">SKU / Categoria</th>
                <th className="py-3.5 px-4">Preço Varejo</th>
                <th className="py-3.5 px-4">Tabela Atacado / Escala</th>
                <th className="py-3.5 px-4">Estoque</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Nenhum produto encontrado. Cadastre o primeiro item para seu catálogo!
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => (
                  <tr key={prod.id} className={`hover:bg-slate-50/80 transition-colors ${!prod.active ? 'opacity-60 bg-slate-50/40' : ''}`}>
                    
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <img
                          src={getSafeProductImage(prod.images[0], prod.category)}
                          alt={prod.name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                          referrerPolicy="no-referrer"
                          onError={(e) => handleProductImageError(e, prod.category)}
                        />
                        <div>
                          <div className="font-bold text-slate-900 text-sm line-clamp-1 flex items-center gap-1.5">
                            {prod.name}
                            {prod.featured && (
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 line-clamp-1">{prod.brand || currentTenant.name}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-mono text-[11px] font-semibold text-slate-800">{prod.sku}</div>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium">
                        {prod.category}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {prod.promotionalPrice ? (
                        <div>
                          <span className="text-xs font-bold text-emerald-600">
                            R$ {prod.promotionalPrice.toFixed(2).replace('.', ',')}
                          </span>
                          <span className="block text-[10px] text-slate-400 line-through">
                            R$ {prod.price.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      ) : (
                        <div className="font-bold text-slate-900 text-xs">
                          R$ {prod.price.toFixed(2).replace('.', ',')}
                        </div>
                      )}
                      <span className="text-[10px] text-slate-400">/{prod.unit}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      {prod.wholesaleTiers && prod.wholesaleTiers.length > 0 ? (
                        <div className="space-y-1">
                          {prod.wholesaleTiers.map((tier, idx) => (
                            <div key={idx} className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded flex items-center justify-between gap-1 max-w-[170px]">
                              <span>≥ {tier.minQuantity} {prod.unit}:</span>
                              <strong className="font-bold">R$ {tier.price.toFixed(2).replace('.', ',')}</strong>
                            </div>
                          ))}
                        </div>
                      ) : prod.wholesalePrice ? (
                        <div className="text-xs font-semibold text-blue-700">
                          R$ {prod.wholesalePrice.toFixed(2).replace('.', ',')} (Min. {prod.minOrderQuantity} {prod.unit})
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Sem tabela atacado</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className={`font-bold text-xs ${prod.stock <= 5 ? 'text-amber-600' : 'text-slate-800'}`}>
                        {prod.stock} {prod.unit}
                      </div>
                      {prod.stock <= 5 && (
                        <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5">
                          <AlertCircle className="w-2.5 h-2.5" /> Baixo estoque
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => toggleProductStatus(prod.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                          prod.active
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {prod.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {prod.active ? 'Ativo' : 'Pausado'}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEditModal(prod)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors"
                          title="Editar Produto"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Excluir o produto "${prod.name}"?`)) {
                              deleteProduct(prod.id);
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                          title="Excluir Produto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Modal Add / Edit Product */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-['Outfit']">
                    {editingProduct ? 'Editar Produto' : 'Cadastrar Novo Produto'}
                  </h3>
                  <p className="text-xs text-slate-500">Configuração de preços, fotos e regras de atacado</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-5">
              
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nome do Produto *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Café Especial Torrado e Moído 500g"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Código SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={e => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="MC-CAF-500"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Categories & Brand */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Categoria *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Alimentos, Descartáveis..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Subcategoria / Tipo
                  </label>
                  <input
                    type="text"
                    value={formData.subcategory || ''}
                    onChange={e => setFormData({ ...formData, subcategory: e.target.value })}
                    placeholder="Cafés, Copos, Embalagens..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Marca / Fabricante
                  </label>
                  <input
                    type="text"
                    value={formData.brand || ''}
                    onChange={e => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Marca própria ou terceiro"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Descrição Completa e Detalhes
                </label>
                <textarea
                  rows={3}
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Informações técnicas, dimensões, embalagem master, validade..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Pricing Grid */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Estrutura de Preços & Margens
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Preço Varejo (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.price}
                      onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Preço Promoção (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.promotionalPrice || ''}
                      onChange={e => setFormData({ ...formData, promotionalPrice: Number(e.target.value) || undefined })}
                      placeholder="Opcional"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white text-emerald-700 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Preço Custo (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.costPrice || ''}
                      onChange={e => setFormData({ ...formData, costPrice: Number(e.target.value) || undefined })}
                      placeholder="Privado admin"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Unidade de Medida
                    </label>
                    <select
                      value={formData.unit}
                      onChange={e => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white font-medium"
                    >
                      <option value="un">Unidade (un)</option>
                      <option value="cx">Caixa (cx)</option>
                      <option value="fd">Fardo (fd)</option>
                      <option value="pct">Pacote (pct)</option>
                      <option value="kg">Quilograma (kg)</option>
                      <option value="dz">Dúzia (dz)</option>
                    </select>
                  </div>
                </div>

                {/* Wholesale Progressive Tiers */}
                <div className="pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-blue-900">Tabela de Desconto por Quantidade (Atacado Progressivo)</span>
                  </div>

                  <div className="space-y-2 mb-3">
                    {formData.wholesaleTiers?.map((tier, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
                        <div>
                          Comprando a partir de <strong>{tier.minQuantity} {formData.unit}</strong>:
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-blue-700">R$ {tier.price.toFixed(2).replace('.', ',')}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTier(idx)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Tier input */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        min="2"
                        placeholder="Qtd Mínima (ex: 10)"
                        value={newTierQty}
                        onChange={e => setNewTierQty(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Preço Unitário (R$)"
                        value={newTierPrice || ''}
                        onChange={e => setNewTierPrice(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTier}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Faixa
                    </button>
                  </div>
                </div>

              </div>

              {/* Stock & Image Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Estoque Disponível
                  </label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    URL da Imagem Oficial
                  </label>
                  <input
                    type="url"
                    value={formData.images?.[0] || ''}
                    onChange={e => {
                      const val = e.target.value.trim();
                      setFormData({ ...formData, images: val ? [val] : [] });
                    }}
                    placeholder="https://seu-dominio.com/imagens/produto.jpg"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Product Image Integrity & Preview */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                  <img
                    src={getSafeProductImage(formData.images?.[0], formData.category)}
                    alt="Preview do produto"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => handleProductImageError(e, formData.category)}
                  />
                </div>
                <div className="flex-1 text-xs">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    Gestão de Imagens & Storage V2
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Apenas fotos reais oficiais do produto comercializado são aceitas. O upload direto de arquivos será habilitado após a configuração do Supabase Storage V2 (em etapa dedicada posterior à Etapa 3 de Schema e RLS).
                  </p>
                </div>
              </div>

              {/* Featured toggle */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={e => setFormData({ ...formData, featured: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">Destacar na Capa do Catálogo ⭐</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={e => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">Produto Visível (Ativo)</span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-600/30 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Salvar Produto
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
