import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, ProductVariant, FragranceFamily, StaticPosterSlotConfig } from '../../types';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Tag,
  Image as ImageIcon,
  Box,
  AlertTriangle,
  Archive,
  RotateCcw,
  Upload,
  X,
  Sparkles,
  Eye
} from 'lucide-react';
import { AdminInventory } from './AdminInventory';
import { PerfumeNotesPosterStage } from '../storefront/PerfumeNotesPosterStage';
import { ErpTableExportBar } from './erp/ErpUniversalExportModal';

interface AdminProductsProps {
  initialSubTab?: 'all' | 'collections' | 'categories' | 'variants' | 'inventory';
}

const ALL_FAMILIES: FragranceFamily[] = [
  'Fresh',
  'Aromatic',
  'Woody',
  'Spicy',
  'Leather',
  'Fruity',
  'Floral',
  'Sweet',
  'Amber',
  'Citrus',
  'Musk',
  'Gourmand',
  'Sacred Wood'
];

export const AdminProducts: React.FC<AdminProductsProps> = ({ initialSubTab = 'all' }) => {
  const { products, updateProduct, addProduct, deleteProduct, showNotification } = useStore();
  const [activeSubTab, setActiveSubTab] = useState<string>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'ARCHIVED'>('PUBLISHED');
  const [editModalProduct, setEditModalProduct] = useState<Product | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Text helpers for comma-separated array fields in Edit Modal
  const [topNotesInput, setTopNotesInput] = useState('');
  const [heartNotesInput, setHeartNotesInput] = useState('');
  const [baseNotesInput, setBaseNotesInput] = useState('');
  const [occasionsInput, setOccasionsInput] = useState('');

  // New product form state
  const [newName, setNewName] = useState('');
  const [newTagline, setNewTagline] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newGender, setNewGender] = useState<'men' | 'women' | 'unisex' | 'devotional' | 'discovery'>('unisex');
  const [newCollection, setNewCollection] = useState<string>('Signature Collection');
  const [newTopNotes, setNewTopNotes] = useState('');
  const [newHeartNotes, setNewHeartNotes] = useState('');
  const [newBaseNotes, setNewBaseNotes] = useState('');
  const [newFamilies, setNewFamilies] = useState<string[]>(['Amber', 'Woody']);
  const [newOccasions, setNewOccasions] = useState('Everyday Luxury, Evening Wear');
  const [newSize, setNewSize] = useState('30 ml');
  const [newPrice, setNewPrice] = useState<number>(699);
  const [newStock, setNewStock] = useState<number>(0);

  const openEditModal = (prod: Product) => {
    setEditModalProduct({
      ...prod,
      notes: {
        top: [...(prod.notes?.top || [])],
        heart: [...(prod.notes?.heart || [])],
        base: [...(prod.notes?.base || [])]
      },
      families: [...(prod.families || [])],
      occasions: [...(prod.occasions || [])],
      variants: (prod.variants || []).map((v) => ({ ...v }))
    });
    setTopNotesInput((prod.notes?.top || []).join(', '));
    setHeartNotesInput((prod.notes?.heart || []).join(', '));
    setBaseNotesInput((prod.notes?.base || []).join(', '));
    setOccasionsInput((prod.occasions || []).join(', '));
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.subtitle || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.scentProfile.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.collection.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.gender.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'PUBLISHED') return p.status === 'ACTIVE' || p.status === 'OUT_OF_STOCK';
    if (statusFilter === 'ARCHIVED') return p.status === 'ARCHIVED' || p.status === 'DRAFT' || p.status === 'INACTIVE';
    return true;
  });

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const slug = newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const isAura = newCollection === 'Aura Collection';
    const defaultSize = isAura ? '15 ml' : newSize;
    const defaultPrice = isAura ? 249 : newPrice;
    const skuCode = slug.substring(0, 3).toUpperCase();

    const newProd: Product = {
      id: 'prod-' + slug,
      name: newName.trim().toUpperCase(),
      slug,
      subtitle: newTagline.trim() || 'Eau de Parfum',
      tagline: newTagline.trim() || 'Eau de Parfum',
      gender: isAura ? 'devotional' : newGender,
      collection: newCollection,
      scentProfile: newTagline.trim() || 'Artisanal Eau de Parfum',
      description:
        newDescription.trim() ||
        `${newName.trim().toUpperCase()} — ${newTagline.trim() || 'Crafted for the FRAGMORÉ collection.'}`,
      story: newDescription.trim() || '',
      notes: {
        top: newTopNotes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        heart: newHeartNotes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        base: newBaseNotes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      },
      families: newFamilies.length > 0 ? newFamilies : ['Amber'],
      occasions: newOccasions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      longevity: '',
      sillage: '',
      rating: 4.9,
      reviewCount: 0,
      status: 'ACTIVE',
      themeColor: '#78350F',
      accentColor: '#D4AF37',
      features: [newCollection],
      variants: isAura
        ? [
            {
              id: `${slug}-15ml`,
              size: '15 ml',
              sku: `FRG-AUR-${skuCode}-015`,
              mrp: defaultPrice,
              sellingPrice: defaultPrice,
              stockOnHand: newStock,
              stockReserved: 0,
              stockAvailable: newStock,
              stockManaged: newStock > 0,
              isAvailable: true
            }
          ]
        : [
            {
              id: `${slug}-30ml`,
              size: '30 ml',
              sku: `FRG-SIG-${skuCode}-030`,
              mrp: 699,
              sellingPrice: 699,
              stockOnHand: newStock,
              stockReserved: 0,
              stockAvailable: newStock,
              stockManaged: newStock > 0,
              isAvailable: true
            },
            {
              id: `${slug}-50ml`,
              size: '50 ml',
              sku: `FRG-SIG-${skuCode}-050`,
              mrp: defaultSize === '50 ml' ? defaultPrice : 999,
              sellingPrice: defaultSize === '50 ml' ? defaultPrice : 999,
              stockOnHand: newStock,
              stockReserved: 0,
              stockAvailable: newStock,
              stockManaged: newStock > 0,
              isAvailable: true
            }
          ]
    };

    addProduct(newProd);
    setIsAddModalOpen(false);
    setNewName('');
    setNewTagline('');
    setNewDescription('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalProduct) return;

    // Validate 2 ml sample variant rule: cannot publish a purchasable 2 ml variant without approved price > 0 and stock
    for (const v of editModalProduct.variants || []) {
      const normSize = v.size.trim().toLowerCase();
      if (normSize === '2 ml' && v.isAvailable && (v.sellingPrice <= 0 || v.stockAvailable <= 0)) {
        showNotification(
          'Cannot publish a purchasable 2 ml variant without an approved selling price (> ₹0) and positive stock.'
        );
        return;
      }
      if (
        editModalProduct.collection === 'Aura Collection' &&
        normSize === '10 ml' &&
        v.isAvailable
      ) {
        showNotification(
          '10 ml Aura variants cannot be published as active selection. Current Aura size is 15 ml at ₹249.'
        );
        return;
      }
    }

    const updatedProduct: Product = {
      ...editModalProduct,
      tagline: editModalProduct.subtitle,
      notes: {
        top: topNotesInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        heart: heartNotesInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        base: baseNotesInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      },
      occasions: occasionsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    };

    updateProduct(updatedProduct);
    setEditModalProduct(null);
  };

  const handleAddVariantToEditProduct = (presetSize: string = '30 ml') => {
    if (!editModalProduct) return;
    const slug = editModalProduct.slug;
    const skuPrefix =
      editModalProduct.collection === 'Aura Collection' ? 'FRG-AUR' : 'FRG-SIG';
    const sizeDigits = presetSize.replace(/\D/g, '').padStart(3, '0') || '030';
    const is2ml = presetSize.trim().toLowerCase() === '2 ml';
    const defaultPrice =
      presetSize === '15 ml' ? 249 : presetSize === '50 ml' ? 999 : is2ml ? 0 : 699;

    const newVariant: ProductVariant = {
      id: `${slug}-${presetSize.replace(/\s+/g, '').toLowerCase()}-${Math.random().toString(36).substring(2, 5)}`,
      size: presetSize,
      sku: `${skuPrefix}-${slug.substring(0, 3).toUpperCase()}-${sizeDigits}`,
      mrp: defaultPrice,
      sellingPrice: defaultPrice,
      stockOnHand: 0,
      stockReserved: 0,
      stockAvailable: 0,
      stockManaged: false,
      isAvailable: !is2ml, // 2 ml sample vial defaults to unpurchasable until price & stock are configured
      frontImage: '',
      frontImageUrl: '',
      additionalImages: [],
      additionalImageUrls: [],
      transparentRender: '',
      transparentBottleRenderUrl: '',
      glbModelUrl: '',
      model3dUrl: '',
      posterImage: '',
      staticPosterImageUrl: ''
    };

    setEditModalProduct({
      ...editModalProduct,
      variants: [...(editModalProduct.variants || []), newVariant]
    });
  };

  const publishedCount = products.filter((p) => p.status === 'ACTIVE').length;
  const archivedCount = products.filter((p) => p.status === 'ARCHIVED').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <h2 className="font-serif text-2xl uppercase tracking-wider text-white">
            Product Catalogue, Collections &amp; Variant Assets
          </h2>
          <p className="text-xs text-white/50">
            Manage Signature Collection (9 creations), Aura Collection (3 creations · 15 ml · ₹249), structured notes, and variant-specific bottle visuals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <ErpTableExportBar
            reportKey="store_products"
            notify={(msg) => showNotification(msg)}
          />
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] text-xs font-bold uppercase tracking-wider rounded flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add New Fragrance
          </button>
        </div>
      </div>

      {/* Owner Confirmation Notice for Luxe Heritage 50 ml */}
      <div className="p-4 rounded-xl border border-amber-500/35 bg-amber-500/10 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-amber-100/90 leading-relaxed">
          <strong className="text-amber-300 uppercase tracking-wider block mb-0.5">
            Catalogue Pricing &amp; Asset Governance Notice
          </strong>
          • <strong>05. LUXE HERITAGE:</strong> Both 30 ml and 50 ml variants are preserved at <strong>₹699</strong> as shown on the supplied reference sheet and flagged for owner confirmation. You can update the 50 ml selling price anytime via <em>Edit Fragrance</em>.<br />
          • <strong>AURA COLLECTION:</strong> Published strictly as <strong>15 ml at ₹249 each</strong>. Legacy 10 ml variants are removed from public selection while preserving historical order records.
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto text-[11px]">
        {[
          { id: 'all', label: `Catalogue (${publishedCount} Published · ${archivedCount} Archived)` },
          { id: 'collections', label: 'Collections Overview' },
          { id: 'categories', label: 'Categories & Families' },
          { id: 'variants', label: 'Variants, SKUs & Bottle Assets' },
          { id: 'inventory', label: 'Inventory Controls' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === tab.id
                ? 'bg-[#D4AF37] text-[#08080A] font-bold'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUB-TAB 1: ALL PRODUCTS */}
      {activeSubTab === 'all' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-3 bg-[#121218] border border-white/10 rounded-xl px-4 py-2.5">
              <Search className="w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Filter by fragrance name, collection, notes, or tagline..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent text-xs text-white placeholder-white/40 focus:outline-none flex-1 font-mono"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-[#121218] border border-white/10 rounded-xl p-1">
              {[
                { id: 'PUBLISHED', label: `Published (${publishedCount})` },
                { id: 'ARCHIVED', label: `Archived (${archivedCount})` },
                { id: 'ALL', label: `All (${products.length})` }
              ].map((flt) => (
                <button
                  key={flt.id}
                  onClick={() => setStatusFilter(flt.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider cursor-pointer ${
                    statusFilter === flt.id
                      ? 'bg-[#D4AF37] text-[#08080A] font-bold'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {flt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#121218] border border-white/10 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                  <th className="p-4">Fragrance &amp; Tagline</th>
                  <th className="p-4">Collection</th>
                  <th className="p-4">Structured Notes</th>
                  <th className="p-4">Public Variants &amp; Prices</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredProducts.map((p) => {
                  const activeVariants = (p.variants || []).filter((v) => v.isAvailable !== false);
                  return (
                    <tr key={p.id} className="hover:bg-white/[0.02]">
                      <td className="p-4">
                        <strong className="text-white block font-serif text-sm uppercase">
                          {p.name}
                        </strong>
                        <span className="text-[11px] text-[#D4AF37] block">
                          {p.subtitle || p.tagline}
                        </span>
                        <span className="text-[10px] text-white/40 uppercase">
                          /{p.slug} · {p.gender}
                        </span>
                      </td>
                      <td className="p-4 text-white/80">{p.collection}</td>
                      <td className="p-4 text-[11px] text-white/70 max-w-xs">
                        <div>
                          <span className="text-white/40">Top:</span> {(p.notes?.top || []).join(', ')}
                        </div>
                        <div>
                          <span className="text-white/40">Heart:</span> {(p.notes?.heart || []).join(', ')}
                        </div>
                        <div>
                          <span className="text-white/40">Base:</span> {(p.notes?.base || []).join(', ')}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5">
                          {activeVariants.map((v) => (
                            <span
                              key={v.id}
                              className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[11px] text-white"
                            >
                              {v.size}: <strong className="text-[#D4AF37]">₹{v.sellingPrice}</strong>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.status === 'ACTIVE'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : p.status === 'ARCHIVED'
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-white/10 text-white/50'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(p)}
                          className="px-2.5 py-1.5 rounded bg-[#D4AF37]/15 hover:bg-[#D4AF37]/30 text-[#E5C378] inline-flex items-center gap-1 cursor-pointer"
                          title="Edit Fragrance, Notes & Variants"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        {p.status === 'ARCHIVED' ? (
                          <button
                            onClick={() => updateProduct({ ...p, status: 'ACTIVE' })}
                            className="p-1.5 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                            title="Restore to Active Catalogue"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => updateProduct({ ...p, status: 'ARCHIVED' })}
                            className="p-1.5 text-white/40 hover:text-amber-400 cursor-pointer"
                            title="Archive Fragrance (Preserves Historical Order Records)"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: COLLECTIONS */}
      {activeSubTab === 'collections' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              name: 'Signature Collection',
              desc: 'Nine approved Eau de Parfum creations in 30 ml (₹699) and 50 ml (₹999; Luxe Heritage ₹699).',
              prods: products.filter(
                (p) => p.collection === 'Signature Collection' && p.status !== 'ARCHIVED'
              )
            },
            {
              name: 'Aura Collection',
              desc: 'Scents for a higher you. Three soulful fragrances inspired by tradition and devotion — 15 ml at ₹249 each.',
              prods: products.filter(
                (p) => p.collection === 'Aura Collection' && p.status !== 'ARCHIVED'
              )
            },
            {
              name: 'Discovery Collection',
              desc: 'Discovery Six (2 ml & 10 ml) coffret variations — preserved for explicit Admin configuration.',
              prods: products.filter(
                (p) => p.collection === 'Discovery Collection' && p.status !== 'ARCHIVED'
              )
            },
            {
              name: 'Archived / Superseded Editions',
              desc: 'Historical creations (Azure, Ignite, Roselle, Élan, Suede, Solara, Aaradhya, Samarpan, Ananta) archived without deleting historical order records.',
              prods: products.filter((p) => p.status === 'ARCHIVED')
            }
          ].map((col) => (
            <div
              key={col.name}
              className="p-6 bg-[#121218] border border-white/10 rounded-xl space-y-4"
            >
              <div>
                <span className="text-[10px] text-[#D4AF37] uppercase font-bold tracking-widest block">
                  Collection ({col.prods.length})
                </span>
                <h3 className="font-serif text-lg uppercase tracking-wider text-white">
                  {col.name}
                </h3>
                <p className="text-white/60 text-xs mt-1">{col.desc}</p>
              </div>

              <div className="space-y-2 border-t border-white/10 pt-3">
                {col.prods.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 bg-white/[0.02] border border-white/5 rounded flex justify-between items-center text-xs"
                  >
                    <div>
                      <span className="text-white font-serif block">{p.name}</span>
                      <span className="text-[10px] text-white/40">{p.subtitle}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[#D4AF37] font-bold">
                        {p.variants
                          .filter((v) => v.isAvailable !== false)
                          .map((v) => `${v.size}: ₹${v.sellingPrice}`)
                          .join(' · ')}
                      </span>
                      <button
                        onClick={() => openEditModal(p)}
                        className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SUB-TAB 3: CATEGORIES & FAMILIES */}
      {activeSubTab === 'categories' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {['women', 'unisex', 'men', 'devotional', 'discovery'].map((cat) => {
            const activeInCat = products.filter(
              (p) => p.gender === cat && p.status === 'ACTIVE'
            );
            return (
              <div
                key={cat}
                className="p-5 bg-[#121218] border border-white/10 rounded-xl space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-base uppercase text-white tracking-wider">
                    {cat.toUpperCase()}
                  </h4>
                  <span className="px-2 py-0.5 rounded bg-[#D4AF37]/20 text-[#E5C378] font-bold text-xs">
                    {activeInCat.length} Active
                  </span>
                </div>
                <div className="text-white/60 text-[11px]">
                  {activeInCat.map((p) => p.name).join(', ') || 'None'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 4: VARIANTS, SKUS & BOTTLE ASSETS */}
      {activeSubTab === 'variants' && (
        <div className="bg-[#121218] border border-white/10 rounded-xl overflow-x-auto p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="font-serif text-base uppercase tracking-wider text-white">
                Variant SKUs, Selling Prices, Stock &amp; Visual Asset Status
              </h3>
              <p className="text-[11px] text-white/50 mt-0.5">
                Configure 30 ml Signature, 50 ml Signature, 2 ml Sample Vial, and 15 ml Aura variant assets via Edit.
              </p>
            </div>
          </div>

          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                <th className="p-3">Fragrance</th>
                <th className="p-3">Size</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Selling Price (₹)</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Public</th>
                <th className="p-3">Visual Assets Configured</th>
                <th className="p-3 text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {products
                .filter((p) => p.status !== 'ARCHIVED')
                .flatMap((prod) =>
                  (prod.variants || []).map((v) => {
                    const hasCustomImg = Boolean(
                      v.frontImageUrl ||
                        v.frontImage ||
                        v.transparentBottleRenderUrl ||
                        v.transparentRender
                    );
                    const has3d = Boolean(v.model3dUrl || v.glbModelUrl);
                    return (
                      <tr key={`${prod.id}-${v.id}`} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-serif font-bold text-white uppercase">
                          {prod.name}
                        </td>
                        <td className="p-3 text-white/80">{v.size}</td>
                        <td className="p-3 font-mono text-[#D4AF37]">{v.sku}</td>
                        <td className="p-3 font-bold text-white">
                          ₹{v.sellingPrice.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-white/70">{v.stockAvailable}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              v.isAvailable
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-white/10 text-white/40'
                            }`}
                          >
                            {v.isAvailable ? 'ACTIVE' : 'HIDDEN'}
                          </span>
                        </td>
                        <td className="p-3 text-[10px] text-white/60">
                          {hasCustomImg ? 'Custom Image' : 'Reference / Placeholder'} ·{' '}
                          {has3d ? 'GLB 3D Ready' : 'No GLB'}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => openEditModal(prod)}
                            className="text-xs text-[#D4AF37] hover:underline cursor-pointer"
                          >
                            Configure Variant &amp; Assets
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
            </tbody>
          </table>
        </div>
      )}

      {/* SUB-TAB 5: INVENTORY */}
      {activeSubTab === 'inventory' && <AdminInventory />}

      {/* COMPREHENSIVE EDIT MODAL FOR STRUCTURED FIELDS & VARIANT ASSETS */}
      {editModalProduct && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditModalProduct(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        >
          <div className="bg-[#0E0E14] border border-white/15 w-full max-w-4xl rounded-2xl p-6 sm:p-8 relative text-[#F3EFE6] max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] block">
                  Structured Catalogue &amp; Variant Asset Editor
                </span>
                <h3 className="font-serif text-xl uppercase tracking-wider text-white">
                  Edit Creation: {editModalProduct.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditModalProduct(null)}
                className="px-3 py-1.5 rounded border border-white/15 text-white/60 hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-6 text-xs font-mono">
              {/* 1. Core Identity & Collection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-white/60 mb-1">Fragrance Name *</label>
                  <input
                    type="text"
                    required
                    value={editModalProduct.name}
                    onChange={(e) =>
                      setEditModalProduct({ ...editModalProduct, name: e.target.value })
                    }
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-white/60 mb-1">Collection *</label>
                  <select
                    value={editModalProduct.collection}
                    onChange={(e) =>
                      setEditModalProduct({ ...editModalProduct, collection: e.target.value })
                    }
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  >
                    <option value="Signature Collection">Signature Collection</option>
                    <option value="Aura Collection">Aura Collection</option>
                    <option value="Discovery Collection">Discovery Collection</option>
                    <option value="Main Collection">Main Collection (Legacy)</option>
                    <option value="Devotional Trilogy">Devotional Trilogy (Legacy)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white/60 mb-1">Publication Status</label>
                  <select
                    value={editModalProduct.status}
                    onChange={(e: any) =>
                      setEditModalProduct({ ...editModalProduct, status: e.target.value })
                    }
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  >
                    <option value="ACTIVE">ACTIVE (Published)</option>
                    <option value="ARCHIVED">ARCHIVED (Hidden from Public)</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="OUT_OF_STOCK">OUT OF STOCK</option>
                  </select>
                </div>
              </div>

              {/* 2. Tagline, Category & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-white/60 mb-1">Tagline *</label>
                  <input
                    type="text"
                    required
                    value={editModalProduct.subtitle}
                    onChange={(e) =>
                      setEditModalProduct({
                        ...editModalProduct,
                        subtitle: e.target.value,
                        tagline: e.target.value,
                        scentProfile: e.target.value
                      })
                    }
                    placeholder="e.g. Golden. Warm. Unforgettable."
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-white/60 mb-1">Gender / Category</label>
                  <select
                    value={editModalProduct.gender}
                    onChange={(e: any) =>
                      setEditModalProduct({ ...editModalProduct, gender: e.target.value })
                    }
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  >
                    <option value="unisex">Unisex</option>
                    <option value="women">Women</option>
                    <option value="men">Men</option>
                    <option value="devotional">Devotional / Aura</option>
                    <option value="discovery">Discovery</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-white/60 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editModalProduct.description}
                  onChange={(e) =>
                    setEditModalProduct({ ...editModalProduct, description: e.target.value })
                  }
                  className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                />
              </div>

              {/* 3. Structured Olfactory Notes (Top, Heart, Base) & Easy Note Management */}
              <div className="p-4 sm:p-5 rounded-xl bg-[#0A0A0E] border border-[#D4AF37]/30 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-white/10 pb-3">
                  <div>
                    <span className="text-[#D4AF37] font-bold uppercase tracking-wider block text-xs">
                      ✨ Easy Olfactory Pyramid &amp; Note Manager
                    </span>
                    <span className="text-[10px] text-white/50">
                      Add, remove, or tap suggestion pills to configure Top, Heart &amp; Base notes. Auto-syncs to PDP &amp; Scroll Journey.
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* TOP NOTES */}
                  {(() => {
                    const topList = topNotesInput
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const suggestions = [
                      'Bergamot',
                      'Mandarin',
                      'Pink Pepper',
                      'Pear',
                      'Saffron',
                      'Cardamom',
                      'Lemon',
                      'Neroli'
                    ];

                    const handleAddNote = (noteToAdd: string) => {
                      const trimmed = noteToAdd.trim();
                      if (!trimmed) return;
                      if (!topList.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
                        setTopNotesInput(topList.concat(trimmed).join(', '));
                      }
                    };

                    const handleRemoveNote = (noteToRemove: string) => {
                      setTopNotesInput(
                        topList.filter((n) => n.toLowerCase() !== noteToRemove.toLowerCase()).join(', ')
                      );
                    };

                    return (
                      <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                            1. Top Notes (First 15 Minutes) · {topList.length} notes
                          </label>
                          <span className="text-[9px] text-white/40">Tap pills or type below</span>
                        </div>

                        {/* Active Chips */}
                        <div className="flex flex-wrap gap-1.5 min-h-[30px] p-2 bg-[#08080A] border border-white/15 rounded-lg">
                          {topList.length === 0 ? (
                            <span className="text-white/30 text-[10px] italic">No top notes added yet. Pick from suggestions below.</span>
                          ) : (
                            topList.map((note) => (
                              <span
                                key={note}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-200 border border-amber-500/40 text-[11px] font-medium"
                              >
                                {note}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveNote(note)}
                                  className="text-amber-200/60 hover:text-white hover:bg-amber-500/30 rounded-full w-3.5 h-3.5 flex items-center justify-center cursor-pointer"
                                  title={`Remove ${note}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          )}
                        </div>

                        {/* Quick Add Input + Comma-separated Edit */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={topNotesInput}
                            onChange={(e) => setTopNotesInput(e.target.value)}
                            placeholder="Type notes (e.g. Bergamot, Saffron, Pear)..."
                            className="flex-1 bg-[#08080A] border border-white/20 rounded px-2.5 py-1.5 text-white text-xs"
                          />
                        </div>

                        {/* 1-Click Suggestions */}
                        <div className="space-y-1">
                          <span className="text-[9px] text-white/40 uppercase block">Quick Add Top Notes:</span>
                          <div className="flex flex-wrap gap-1">
                            {suggestions.map((sug) => {
                              const alreadyAdded = topList.some((n) => n.toLowerCase() === sug.toLowerCase());
                              return (
                                <button
                                  key={sug}
                                  type="button"
                                  onClick={() => (alreadyAdded ? handleRemoveNote(sug) : handleAddNote(sug))}
                                  className={`px-2 py-0.5 rounded text-[10px] border transition-colors cursor-pointer ${
                                    alreadyAdded
                                      ? 'bg-amber-500/30 text-amber-200 border-amber-400 font-bold'
                                      : 'bg-white/5 text-white/70 border-white/10 hover:border-amber-400 hover:text-white'
                                  }`}
                                >
                                  {alreadyAdded ? `✓ ${sug}` : `+ ${sug}`}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* HEART NOTES */}
                  {(() => {
                    const heartList = heartNotesInput
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const suggestions = [
                      'Damask Rose',
                      'Jasmine Sambac',
                      'Violet',
                      'Lavender',
                      'Orange Blossom',
                      'Iris',
                      'Nutmeg',
                      'Magnolia'
                    ];

                    const handleAddNote = (noteToAdd: string) => {
                      const trimmed = noteToAdd.trim();
                      if (!trimmed) return;
                      if (!heartList.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
                        setHeartNotesInput(heartList.concat(trimmed).join(', '));
                      }
                    };

                    const handleRemoveNote = (noteToRemove: string) => {
                      setHeartNotesInput(
                        heartList.filter((n) => n.toLowerCase() !== noteToRemove.toLowerCase()).join(', ')
                      );
                    };

                    return (
                      <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-rose-300 uppercase tracking-wider">
                            2. Heart Notes (The Soul · Hours 1–4) · {heartList.length} notes
                          </label>
                          <span className="text-[9px] text-white/40">Tap pills or type below</span>
                        </div>

                        {/* Active Chips */}
                        <div className="flex flex-wrap gap-1.5 min-h-[30px] p-2 bg-[#08080A] border border-white/15 rounded-lg">
                          {heartList.length === 0 ? (
                            <span className="text-white/30 text-[10px] italic">No heart notes added yet. Pick from suggestions below.</span>
                          ) : (
                            heartList.map((note) => (
                              <span
                                key={note}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/20 text-rose-200 border border-rose-500/40 text-[11px] font-medium"
                              >
                                {note}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveNote(note)}
                                  className="text-rose-200/60 hover:text-white hover:bg-rose-500/30 rounded-full w-3.5 h-3.5 flex items-center justify-center cursor-pointer"
                                  title={`Remove ${note}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          )}
                        </div>

                        {/* Quick Add Input + Comma-separated Edit */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={heartNotesInput}
                            onChange={(e) => setHeartNotesInput(e.target.value)}
                            placeholder="Type notes (e.g. Damask Rose, Jasmine)..."
                            className="flex-1 bg-[#08080A] border border-white/20 rounded px-2.5 py-1.5 text-white text-xs"
                          />
                        </div>

                        {/* 1-Click Suggestions */}
                        <div className="space-y-1">
                          <span className="text-[9px] text-white/40 uppercase block">Quick Add Heart Notes:</span>
                          <div className="flex flex-wrap gap-1">
                            {suggestions.map((sug) => {
                              const alreadyAdded = heartList.some((n) => n.toLowerCase() === sug.toLowerCase());
                              return (
                                <button
                                  key={sug}
                                  type="button"
                                  onClick={() => (alreadyAdded ? handleRemoveNote(sug) : handleAddNote(sug))}
                                  className={`px-2 py-0.5 rounded text-[10px] border transition-colors cursor-pointer ${
                                    alreadyAdded
                                      ? 'bg-rose-500/30 text-rose-200 border-rose-400 font-bold'
                                      : 'bg-white/5 text-white/70 border-white/10 hover:border-rose-400 hover:text-white'
                                  }`}
                                >
                                  {alreadyAdded ? `✓ ${sug}` : `+ ${sug}`}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* BASE NOTES */}
                  {(() => {
                    const baseList = baseNotesInput
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const suggestions = [
                      'Indian Sandalwood',
                      'Bourbon Vanilla',
                      'Amber',
                      'White Cedar',
                      'White Musk',
                      'Patchouli',
                      'Vetiver',
                      'Oud'
                    ];

                    const handleAddNote = (noteToAdd: string) => {
                      const trimmed = noteToAdd.trim();
                      if (!trimmed) return;
                      if (!baseList.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
                        setBaseNotesInput(baseList.concat(trimmed).join(', '));
                      }
                    };

                    const handleRemoveNote = (noteToRemove: string) => {
                      setBaseNotesInput(
                        baseList.filter((n) => n.toLowerCase() !== noteToRemove.toLowerCase()).join(', ')
                      );
                    };

                    return (
                      <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
                            3. Base Notes (The Lasting Trail · Hours 5–12+) · {baseList.length} notes
                          </label>
                          <span className="text-[9px] text-white/40">Tap pills or type below</span>
                        </div>

                        {/* Active Chips */}
                        <div className="flex flex-wrap gap-1.5 min-h-[30px] p-2 bg-[#08080A] border border-white/15 rounded-lg">
                          {baseList.length === 0 ? (
                            <span className="text-white/30 text-[10px] italic">No base notes added yet. Pick from suggestions below.</span>
                          ) : (
                            baseList.map((note) => (
                              <span
                                key={note}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 text-[11px] font-medium"
                              >
                                {note}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveNote(note)}
                                  className="text-emerald-200/60 hover:text-white hover:bg-emerald-500/30 rounded-full w-3.5 h-3.5 flex items-center justify-center cursor-pointer"
                                  title={`Remove ${note}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          )}
                        </div>

                        {/* Quick Add Input + Comma-separated Edit */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={baseNotesInput}
                            onChange={(e) => setBaseNotesInput(e.target.value)}
                            placeholder="Type notes (e.g. Amber, Sandalwood, Vanilla)..."
                            className="flex-1 bg-[#08080A] border border-white/20 rounded px-2.5 py-1.5 text-white text-xs"
                          />
                        </div>

                        {/* 1-Click Suggestions */}
                        <div className="space-y-1">
                          <span className="text-[9px] text-white/40 uppercase block">Quick Add Base Notes:</span>
                          <div className="flex flex-wrap gap-1">
                            {suggestions.map((sug) => {
                              const alreadyAdded = baseList.some((n) => n.toLowerCase() === sug.toLowerCase());
                              return (
                                <button
                                  key={sug}
                                  type="button"
                                  onClick={() => (alreadyAdded ? handleRemoveNote(sug) : handleAddNote(sug))}
                                  className={`px-2 py-0.5 rounded text-[10px] border transition-colors cursor-pointer ${
                                    alreadyAdded
                                      ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400 font-bold'
                                      : 'bg-white/5 text-white/70 border-white/10 hover:border-emerald-400 hover:text-white'
                                  }`}
                                >
                                  {alreadyAdded ? `✓ ${sug}` : `+ ${sug}`}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Per-Note Ingredient Photography & Label Overrides */}
                {(() => {
                  const activeNoteNames = Array.from(
                    new Set(
                      [topNotesInput, heartNotesInput, baseNotesInput]
                        .join(',')
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                  );
                  if (activeNoteNames.length === 0) return null;

                  return (
                    <div className="pt-3 border-t border-white/10 space-y-2.5">
                      <span className="text-[10px] text-[#D4AF37] uppercase tracking-wider block font-semibold">
                        Ingredient Note Image Uploads &amp; Display Labels (Upload Images Directly)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                        {activeNoteNames.map((noteKey) => {
                          const currentMedia = editModalProduct.noteMedia?.[noteKey] || {};
                          const updateNoteMediaField = (
                            field: 'label' | 'imageUrl' | 'alt',
                            val: string
                          ) => {
                            const nextMap = {
                              ...(editModalProduct.noteMedia || {}),
                              [noteKey]: {
                                ...currentMedia,
                                [field]: val
                              }
                            };
                            setEditModalProduct({
                              ...editModalProduct,
                              noteMedia: nextMap
                            });
                          };

                          const handleNoteImageFileUpload = (
                            e: React.ChangeEvent<HTMLInputElement>
                          ) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (!file.type.startsWith('image/')) {
                              showNotification('Please select a valid image file (PNG, JPG, WebP, or SVG).');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = () => {
                              if (typeof reader.result === 'string') {
                                updateNoteMediaField('imageUrl', reader.result);
                                showNotification(`Uploaded image for note "${noteKey}".`);
                              }
                            };
                            reader.readAsDataURL(file);
                          };

                          return (
                            <div
                              key={noteKey}
                              className="p-2.5 rounded-lg bg-[#121218] border border-white/10 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                                  Note: {noteKey}
                                </span>
                                {currentMedia.imageUrl && (
                                  <button
                                    type="button"
                                    onClick={() => updateNoteMediaField('imageUrl', '')}
                                    className="text-[10px] text-rose-400 hover:text-rose-300 inline-flex items-center gap-0.5 cursor-pointer"
                                    title="Remove uploaded note image"
                                  >
                                    <X className="w-3 h-3" />
                                    <span>Remove</span>
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center gap-2.5">
                                {/* Uploaded Note Image Preview */}
                                <div className="w-11 h-11 rounded-lg bg-[#08080A] border border-white/15 shrink-0 flex items-center justify-center overflow-hidden">
                                  {currentMedia.imageUrl ? (
                                    <img
                                      src={currentMedia.imageUrl}
                                      alt={currentMedia.label || noteKey}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <ImageIcon className="w-4 h-4 text-white/30" />
                                  )}
                                </div>

                                <div className="flex-1 space-y-1.5 min-w-0">
                                  <input
                                    type="text"
                                    value={currentMedia.label || ''}
                                    onChange={(e) => updateNoteMediaField('label', e.target.value)}
                                    placeholder={`Display Label (${noteKey})`}
                                    className="w-full bg-[#08080A] border border-white/15 rounded px-2 py-1 text-[10px] text-white"
                                  />

                                  <label className="w-full bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 border border-[#D4AF37]/40 rounded px-2.5 py-1.5 text-[10px] text-[#E5C378] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                                    <Upload className="w-3 h-3 shrink-0" />
                                    <span className="truncate">
                                      {currentMedia.imageUrl ? 'Replace Note Image' : 'Upload Note Image'}
                                    </span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={handleNoteImageFileUpload}
                                      className="hidden"
                                    />
                                  </label>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 4. Fragrance Families & Occasion Associations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/60 mb-1.5">Fragrance Families</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_FAMILIES.map((fam) => {
                      const active = (editModalProduct.families || []).includes(fam);
                      return (
                        <button
                          key={fam}
                          type="button"
                          onClick={() => {
                            const current = editModalProduct.families || [];
                            const next = active
                              ? current.filter((f) => f !== fam)
                              : [...current, fam];
                            setEditModalProduct({ ...editModalProduct, families: next });
                          }}
                          className={`px-2.5 py-1 rounded text-[10px] border cursor-pointer ${
                            active
                              ? 'bg-[#D4AF37] text-[#08080A] border-[#D4AF37] font-bold'
                              : 'bg-[#08080A] text-white/60 border-white/15'
                          }`}
                        >
                          {fam}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-white/60 mb-1">
                    Occasion Associations (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={occasionsInput}
                    onChange={(e) => setOccasionsInput(e.target.value)}
                    placeholder="Golden Hour, Evening Wear, Signature Daily"
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  />
                </div>
              </div>

              {/* Perfumer / Atelier Internal Notes & Formulation Remarks */}
              <div className="p-3 bg-[#0A0A0E] border border-white/10 rounded-xl space-y-2">
                <label className="block text-white/70 font-semibold text-[11px] uppercase tracking-wider text-[#D4AF37]">
                  📝 Atelier Perfumer Internal Notes &amp; Maceration Log
                </label>
                <textarea
                  rows={2}
                  value={editModalProduct.story || ''}
                  onChange={(e) => setEditModalProduct({ ...editModalProduct, story: e.target.value })}
                  placeholder="Internal notes on concentration (e.g. 30% Extrait de Parfum), maceration timeline, distillation batch remarks, or customer advice..."
                  className="w-full bg-[#08080A] border border-white/20 rounded p-2 text-white text-xs"
                />
              </div>

              {/* 5. Variant Pricing, Stock & Visual Assets */}
              <div className="pt-4 border-t border-white/10 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-[#D4AF37]">
                      <Tag className="w-3.5 h-3.5" />
                      <span>Variant Controls &amp; Size-Specific Bottle Assets</span>
                    </label>
                    <p className="text-[10px] text-white/50 mt-0.5">
                      Manage Size, SKU, Selling Price, Stock, Front Image, Additional Images, Transparent Render, GLB/GLTF 3D Model, and Static Poster Image.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['30 ml', '50 ml', '15 ml', '2 ml'].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => handleAddVariantToEditProduct(sz)}
                        className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-[10px] text-white cursor-pointer"
                      >
                        + Add {sz} Variant
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {(editModalProduct.variants || []).map((v, idx) => {
                    const updateVar = (patch: Partial<ProductVariant>) => {
                      const updatedVariants = (editModalProduct.variants || []).map(
                        (varItem, varIdx) => (varIdx === idx ? { ...varItem, ...patch } : varItem)
                      );
                      setEditModalProduct({ ...editModalProduct, variants: updatedVariants });
                    };

                    const additionalList = (
                      v.additionalImageUrls ||
                      v.additionalImages ||
                      []
                    ).join(', ');

                    return (
                      <div
                        key={v.id || idx}
                        className="p-4 bg-[#09090D] border border-white/15 rounded-xl space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold uppercase text-xs font-mono">
                              Variant #{idx + 1}: {v.size}
                            </span>
                            <span className="text-[10px] text-[#D4AF37] font-mono">
                              ({v.sku})
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="inline-flex items-center gap-1.5 text-[11px] text-white/80 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={v.isAvailable !== false}
                                onChange={(e) => updateVar({ isAvailable: e.target.checked })}
                              />
                              <span>Published / Purchasable</span>
                            </label>
                            {(editModalProduct.variants || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const nextVars = (editModalProduct.variants || []).filter(
                                    (_, i) => i !== idx
                                  );
                                  setEditModalProduct({
                                    ...editModalProduct,
                                    variants: nextVars
                                  });
                                }}
                                className="text-rose-400 hover:text-rose-300 text-[10px] cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Row 1: Size, SKU, Selling Price, Stock */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[10px] text-white/60 mb-1">Size *</label>
                            <input
                              type="text"
                              required
                              value={v.size}
                              onChange={(e) => updateVar({ size: e.target.value })}
                              placeholder="30 ml / 50 ml / 15 ml / 2 ml"
                              className="w-full bg-[#121218] border border-white/20 rounded p-2 text-white text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-white/60 mb-1">SKU *</label>
                            <input
                              type="text"
                              required
                              value={v.sku}
                              onChange={(e) => updateVar({ sku: e.target.value })}
                              className="w-full bg-[#121218] border border-white/20 rounded p-2 text-white text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-white/60 mb-1">
                              Selling Price (₹) *
                            </label>
                            <input
                              type="number"
                              required
                              min={0}
                              value={v.sellingPrice}
                              onChange={(e) => {
                                const price = Number(e.target.value);
                                updateVar({ sellingPrice: price, mrp: price });
                              }}
                              className="w-full bg-[#121218] border border-white/20 rounded p-2 text-white text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-white/60 mb-1">
                              Stock Quantity
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={v.stockAvailable}
                              onChange={(e) => {
                                const stock = Number(e.target.value);
                                updateVar({
                                  stockAvailable: stock,
                                  stockOnHand: stock,
                                  stockManaged: true
                                });
                              }}
                              className="w-full bg-[#121218] border border-white/20 rounded p-2 text-white text-xs"
                            />
                          </div>
                        </div>

                        {/* Row 2: Variant-Specific Visual Assets */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
                          <div>
                            <label className="block text-[10px] text-white/60 mb-1 flex items-center gap-1">
                              <ImageIcon className="w-3 h-3 text-[#D4AF37]" />
                              <span>Front Image URL</span>
                            </label>
                            <input
                              type="text"
                              value={v.frontImageUrl || v.frontImage || ''}
                              onChange={(e) =>
                                updateVar({
                                  frontImage: e.target.value,
                                  frontImageUrl: e.target.value
                                })
                              }
                              placeholder="https://... or /images/products/..."
                              className="w-full bg-[#121218] border border-white/20 rounded p-2 text-white text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-white/60 mb-1 flex items-center gap-1">
                              <ImageIcon className="w-3 h-3 text-[#D4AF37]" />
                              <span>Transparent Bottle Render URL</span>
                            </label>
                            <input
                              type="text"
                              value={v.transparentBottleRenderUrl || v.transparentRender || ''}
                              onChange={(e) =>
                                updateVar({
                                  transparentRender: e.target.value,
                                  transparentBottleRenderUrl: e.target.value
                                })
                              }
                              placeholder="Transparent PNG/WebP flacon render URL"
                              className="w-full bg-[#121218] border border-white/20 rounded p-2 text-white text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-white/60 mb-1">
                              Additional Images (Comma-separated URLs)
                            </label>
                            <input
                              type="text"
                              value={additionalList}
                              onChange={(e) => {
                                const urls = e.target.value
                                  .split(',')
                                  .map((s) => s.trim())
                                  .filter(Boolean);
                                updateVar({
                                  additionalImages: urls,
                                  additionalImageUrls: urls
                                });
                              }}
                              placeholder="/img1.webp, /img2.webp"
                              className="w-full bg-[#121218] border border-white/20 rounded p-2 text-white text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-white/60 mb-1">
                              Primary Static Poster Image URL (Optional Override)
                            </label>
                            <input
                              type="text"
                              value={v.staticPosterImageUrl || v.posterImage || ''}
                              onChange={(e) =>
                                updateVar({
                                  posterImage: e.target.value,
                                  staticPosterImageUrl: e.target.value
                                })
                              }
                              placeholder="Static fallback poster URL"
                              className="w-full bg-[#121218] border border-white/20 rounded p-2 text-white text-xs"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[10px] text-white/60 mb-1 flex items-center gap-1">
                              <Box className="w-3 h-3 text-[#D4AF37]" />
                              <span>Optional Optimized 3D Model URL (GLB / GLTF)</span>
                            </label>
                            <input
                              type="text"
                              value={v.model3dUrl || v.glbModelUrl || ''}
                              onChange={(e) =>
                                updateVar({
                                  glbModelUrl: e.target.value,
                                  model3dUrl: e.target.value
                                })
                              }
                              placeholder="Leave empty to use approved 2D bottle render / static fallback"
                              className="w-full bg-[#121218] border border-white/20 rounded p-2 text-white text-xs"
                            />
                          </div>

                          {/* Row 3: 5-Slot Static Poster Gallery (Bottle + Respective Notes in Background — Shown Only in Static Poster Tab) */}
                          <div className="sm:col-span-2 pt-3 mt-1 border-t border-white/10 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>
                                    Static Poster Gallery (4–5 Perfume Bottle Posters with Respective Notes Background)
                                  </span>
                                </div>
                                <p className="text-[10px] text-white/55 mt-0.5">
                                  Shown exclusively in the &ldquo;Static Poster&rdquo; tab on the Product Page (Interactive Studio remains unchanged). Each poster places your perfume bottle in the foreground with its respective Top, Heart &amp; Base notes in the background.
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                              {[1, 2, 3, 4, 5].map((slotNum) => {
                                const defaultFocusMap: Record<
                                  number,
                                  'all' | 'top' | 'heart' | 'base' | 'collector'
                                > = {
                                  1: 'all',
                                  2: 'top',
                                  3: 'heart',
                                  4: 'base',
                                  5: 'collector',
                                };
                                const defaultTitleMap: Record<number, string> = {
                                  1: 'Olfactory Notes Composition',
                                  2: 'Opening Top Notes Aura',
                                  3: 'Heart Signature Botanicals',
                                  4: 'Base Notes & Lasting Trail',
                                  5: 'Collector Edition Archive',
                                };
                                const existingSlots: StaticPosterSlotConfig[] =
                                  v.staticPosters || [];
                                const slotEntry: StaticPosterSlotConfig = existingSlots.find(
                                  (s) => s.slotIndex === slotNum
                                ) || {
                                  id: `${v.id || 'var'}-poster-${slotNum}`,
                                  slotIndex: slotNum,
                                  title: defaultTitleMap[slotNum],
                                  noteFocus: defaultFocusMap[slotNum],
                                  bottleImageUrl: '',
                                  useNotesBackground: true,
                                };

                                const updatePosterSlot = (
                                  slotPatch: Partial<StaticPosterSlotConfig>
                                ) => {
                                  const nextSlots = [1, 2, 3, 4, 5].map((n) => {
                                    const found = existingSlots.find((s) => s.slotIndex === n) || {
                                      id: `${v.id || 'var'}-poster-${n}`,
                                      slotIndex: n,
                                      title: defaultTitleMap[n],
                                      noteFocus: defaultFocusMap[n],
                                      bottleImageUrl: '',
                                      useNotesBackground: true,
                                    };
                                    return n === slotNum ? { ...found, ...slotPatch } : found;
                                  });
                                  updateVar({
                                    staticPosters: nextSlots,
                                    staticPosterUrls: nextSlots
                                      .map((s) => s.bottleImageUrl || s.customPosterUrl || '')
                                      .filter(Boolean),
                                  });
                                };

                                return (
                                  <div
                                    key={slotNum}
                                    className="rounded-lg bg-[#121218] border border-white/15 p-2.5 space-y-2"
                                  >
                                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                                      <span className="text-[10px] font-bold text-[#D4AF37]">
                                        POSTER 0{slotNum}
                                      </span>
                                      {slotEntry.bottleImageUrl && (
                                        <button
                                          type="button"
                                          onClick={() => updatePosterSlot({ bottleImageUrl: '' })}
                                          className="text-[9px] text-rose-400 hover:text-rose-300 cursor-pointer"
                                        >
                                          Reset
                                        </button>
                                      )}
                                    </div>

                                    <div>
                                      <label className="block text-[9px] text-white/50 mb-0.5">
                                        Poster Title
                                      </label>
                                      <input
                                        type="text"
                                        value={slotEntry.title || ''}
                                        onChange={(e) =>
                                          updatePosterSlot({ title: e.target.value })
                                        }
                                        placeholder={defaultTitleMap[slotNum]}
                                        className="w-full bg-[#09090D] border border-white/15 rounded px-2 py-1 text-white text-[10px]"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[9px] text-white/50 mb-0.5">
                                        Respective Notes Backdrop
                                      </label>
                                      <select
                                        value={slotEntry.noteFocus || defaultFocusMap[slotNum]}
                                        onChange={(e) =>
                                          updatePosterSlot({
                                            noteFocus: e.target.value as StaticPosterSlotConfig['noteFocus'],
                                          })
                                        }
                                        className="w-full bg-[#09090D] border border-white/15 rounded px-2 py-1 text-white text-[10px]"
                                      >
                                        <option value="all">All Notes (Top + Heart + Base)</option>
                                        <option value="top">Top Notes Botanicals</option>
                                        <option value="heart">Heart Notes Botanicals</option>
                                        <option value="base">Base Notes Botanicals</option>
                                        <option value="collector">Collector Pyramid</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-[9px] text-white/50 mb-0.5">
                                        Bottle Image URL (Optional)
                                      </label>
                                      <input
                                        type="text"
                                        value={slotEntry.bottleImageUrl || ''}
                                        onChange={(e) =>
                                          updatePosterSlot({ bottleImageUrl: e.target.value })
                                        }
                                        placeholder="Default: Real Glass Bottle"
                                        className="w-full bg-[#09090D] border border-white/15 rounded px-2 py-1 text-white text-[10px]"
                                      />
                                    </div>

                                    <label className="flex items-center justify-center gap-1 w-full py-1.5 rounded bg-white/5 hover:bg-white/10 border border-dashed border-[#D4AF37]/40 text-[9px] text-[#D4AF37] cursor-pointer transition-colors">
                                      <Upload className="w-3 h-3" />
                                      <span>Upload Bottle Image</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          const reader = new FileReader();
                                          reader.onload = () => {
                                            if (typeof reader.result === 'string') {
                                              updatePosterSlot({ bottleImageUrl: reader.result });
                                            }
                                          };
                                          reader.readAsDataURL(file);
                                        }}
                                      />
                                    </label>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Live Preview of the 5 Static Posters with Respective Notes in Background */}
                            <div className="pt-2">
                              <div className="text-[10px] text-white/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Eye className="w-3 h-3 text-[#D4AF37]" />
                                <span>Live Static Poster Preview (Bottle + Respective Notes Backdrop)</span>
                              </div>
                              <div className="max-w-lg mx-auto">
                                <PerfumeNotesPosterStage
                                  product={{
                                    ...editModalProduct,
                                    notes: {
                                      top: topNotesInput
                                        .split(',')
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                      heart: heartNotesInput
                                        .split(',')
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                      base: baseNotesInput
                                        .split(',')
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                    },
                                  }}
                                  currentVariant={v}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditModalProduct(null)}
                  className="px-4 py-2 border border-white/20 rounded text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#D4AF37] text-[#08080A] font-bold rounded cursor-pointer"
                >
                  Save Product &amp; Variants
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD NEW PRODUCT MODAL */}
      {isAddModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        >
          <div className="bg-[#0E0E14] border border-white/15 w-full max-w-xl rounded-2xl p-6 sm:p-8 relative text-[#F3EFE6] max-h-[90vh] overflow-y-auto">
            <h3 className="font-serif text-xl uppercase tracking-wider text-white mb-4">
              Add New Olfactory Creation
            </h3>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/60 mb-1">Fragrance Name *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. GOLDEN HOUR"
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white uppercase"
                  />
                </div>

                <div>
                  <label className="block text-white/60 mb-1">Collection *</label>
                  <select
                    value={newCollection}
                    onChange={(e) => setNewCollection(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  >
                    <option value="Signature Collection">Signature Collection</option>
                    <option value="Aura Collection">Aura Collection (15 ml · ₹249)</option>
                    <option value="Discovery Collection">Discovery Collection</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/60 mb-1">Tagline *</label>
                  <input
                    type="text"
                    required
                    value={newTagline}
                    onChange={(e) => setNewTagline(e.target.value)}
                    placeholder="e.g. Golden. Warm. Unforgettable."
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-white/60 mb-1">Category</label>
                  <select
                    value={newGender}
                    onChange={(e: any) => setNewGender(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  >
                    <option value="unisex">Unisex</option>
                    <option value="women">Women</option>
                    <option value="men">Men</option>
                    <option value="devotional">Devotional / Aura</option>
                    <option value="discovery">Discovery</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-white/60 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-white/60 mb-1">Top Notes</label>
                  <input
                    type="text"
                    value={newTopNotes}
                    onChange={(e) => setNewTopNotes(e.target.value)}
                    placeholder="Citrus, Pear"
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1">Heart Notes</label>
                  <input
                    type="text"
                    value={newHeartNotes}
                    onChange={(e) => setNewHeartNotes(e.target.value)}
                    placeholder="Musky Warm Sunset"
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1">Base Notes</label>
                  <input
                    type="text"
                    value={newBaseNotes}
                    onChange={(e) => setNewBaseNotes(e.target.value)}
                    placeholder="Amber, Vanilla"
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-white/20 rounded text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#D4AF37] text-[#08080A] font-bold rounded cursor-pointer"
                >
                  Create Fragrance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
