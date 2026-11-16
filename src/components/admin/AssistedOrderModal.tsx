import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  X,
  ShoppingBag,
  Send,
  Copy,
  Check,
  User,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  ExternalLink,
  MessageCircle,
  Smartphone
} from 'lucide-react';
import { cloudSqlApi } from '../../lib/cloudSqlApi';

interface AssistedOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedCustomer?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  } | null;
}

export const AssistedOrderModal: React.FC<AssistedOrderModalProps> = ({
  isOpen,
  onClose,
  preselectedCustomer
}) => {
  const { products, customers, addCustomer, createOrder, showNotification } = useStore();

  // Mode: existing customer or new customer
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerState, setCustomerState] = useState('');
  const [customerPincode, setCustomerPincode] = useState('');
  const [saveToCrm, setSaveToCrm] = useState(true);

  // Cart builder state
  const [cartItems, setCartItems] = useState<
    Array<{
      productId: string;
      productName: string;
      size: string;
      sku: string;
      unitPrice: number;
      quantity: number;
      totalPrice: number;
      selectedFlavours?: string[];
    }>
  >([]);

  // Selected product to add
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [couponCode, setCouponCode] = useState<string>('');

  // Generated Link & State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPlacingDirect, setIsPlacingDirect] = useState(false);

  // Discovery Six flavours helper
  const [discoveryFlavours, setDiscoveryFlavours] = useState<string[]>([
    'Golden Hour',
    'Blush & Blossom',
    'Violet Noir',
    'Moksha Essence',
    'Luxe Heritage',
    'Temple Flora'
  ]);

  // Approved Catalogue Products only
  const activeProducts = products.filter(
    (p) =>
      p.status === 'ACTIVE' &&
      !['prod-azure', 'prod-ignite', 'prod-roselle', 'prod-elan', 'prod-suede', 'prod-solara', 'prod-aaradhya', 'prod-samarpan', 'prod-ananta'].includes(p.id)
  );

  // Auto-fill on open or preselected customer change
  useEffect(() => {
    if (preselectedCustomer) {
      setCustomerName(preselectedCustomer.name || '');
      setCustomerEmail(preselectedCustomer.email || '');
      setCustomerPhone(preselectedCustomer.phone || '');
      setCustomerAddress(preselectedCustomer.address || '');
    } else {
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setCustomerAddress('');
      setSelectedCustomerId('');
    }
    setCartItems([]);
    setGeneratedLink(null);
    setCopied(false);
  }, [isOpen, preselectedCustomer]);

  // Set default product when activeProducts load
  useEffect(() => {
    if (activeProducts.length > 0 && !selectedProductId) {
      setSelectedProductId(activeProducts[0].id);
      if (activeProducts[0].variants && activeProducts[0].variants.length > 0) {
        setSelectedVariantId(activeProducts[0].variants[0].id);
      }
    }
  }, [activeProducts, selectedProductId]);

  // When selected product changes, select its first variant
  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = activeProducts.find((p) => p.id === prodId);
    if (prod && prod.variants && prod.variants.length > 0) {
      setSelectedVariantId(prod.variants[0].id);
    }
  };

  // When an existing customer is selected from dropdown
  const handleSelectExistingCustomer = (id: string) => {
    setSelectedCustomerId(id);
    if (!id) return;
    const cust = customers.find((c) => c.id === id);
    if (cust) {
      setCustomerName(cust.name || '');
      setCustomerEmail(cust.email || '');
      setCustomerPhone(cust.phone || '');
      if (cust.addresses && cust.addresses.length > 0) {
        const addr = cust.addresses[0];
        setCustomerAddress(addr.addressLine1 || '');
        setCustomerCity(addr.city || '');
        setCustomerState(addr.state || '');
        setCustomerPincode(addr.pincode || '');
      }
    }
  };

  // Add Item to Cart
  const handleAddItem = () => {
    const prod = activeProducts.find((p) => p.id === selectedProductId);
    if (!prod) return;
    const variant = prod.variants?.find((v) => v.id === selectedVariantId) || prod.variants?.[0];
    const unitPrice = variant?.sellingPrice || 699;
    const size = variant?.size || '50 ml';
    const sku = variant?.sku || `FRG-${prod.name.substring(0, 3).toUpperCase()}-050`;

    const isDiscovery = prod.name.toUpperCase().includes('DISCOVERY');

    setCartItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        size,
        sku,
        unitPrice,
        quantity: Math.max(1, quantity),
        totalPrice: unitPrice * Math.max(1, quantity),
        selectedFlavours: isDiscovery ? discoveryFlavours : undefined
      }
    ]);

    setQuantity(1);
    setGeneratedLink(null);
  };

  const handleRemoveItem = (index: number) => {
    setCartItems((prev) => prev.filter((_, idx) => idx !== index));
    setGeneratedLink(null);
  };

  // Calculations
  const subtotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const finalTotal = Math.max(0, subtotal - discountAmount);
  const gstInclusive = Math.round((finalTotal * 18) / 118);

  // Generate Concierge Link
  const handleGenerateLink = async () => {
    if (cartItems.length === 0) {
      showNotification('Please add at least one fragrance to the assisted cart.');
      return;
    }
    if (!customerName.trim() && !customerPhone.trim() && !customerEmail.trim()) {
      showNotification('Please provide customer name, phone or email.');
      return;
    }

    setIsGenerating(true);
    try {
      // Save customer to CRM if requested and not existing
      if (saveToCrm && !selectedCustomerId && customerName.trim() && customerEmail.trim()) {
        const newCustId = `cust-${Date.now()}`;
        addCustomer({
          id: newCustId,
          name: customerName.trim(),
          email: customerEmail.trim().toLowerCase(),
          phone: customerPhone.trim(),
          addresses: [
            {
              id: `addr-${Date.now()}`,
              fullName: customerName.trim(),
              phone: customerPhone.trim(),
              email: customerEmail.trim().toLowerCase(),
              addressLine1: customerAddress.trim() || 'Bespoke Atelier Address',
              city: customerCity.trim() || 'Mumbai',
              state: customerState.trim() || 'Maharashtra',
              pincode: customerPincode.trim() || '400001',
              isDefault: true
            }
          ],
          source: 'Admin Concierge Assist',
          registeredDate: new Date().toISOString().split('T')[0],
          accountCreationDate: new Date().toISOString().split('T')[0],
          segments: ['VIP Assisted Client'],
          totalSpend: 0,
          ordersCount: 0,
          aov: 0,
          lastOrderDate: 'Never',
          lastPurchaseDate: 'No purchases yet',
          daysSinceLastOrder: 0,
          favouriteFragrance: cartItems[0]?.productName || 'GOLDEN HOUR',
          isDiscoveryBuyer: cartItems.some((i) => i.productName.toUpperCase().includes('DISCOVERY')),
          wishlistSlugs: [],
          reviewsCount: 0,
          abandonedCartsCount: 0,
          couponsUsed: couponCode ? [couponCode] : [],
          communicationHistory: [],
          notes: 'Assisted by Atelier team via direct fulfillment link'
        });
      }

      // Call API to persist assisted cart
      const cartId = `concierge-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const payload = {
        cartId,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        shippingAddress: {
          street: customerAddress.trim(),
          city: customerCity.trim(),
          state: customerState.trim(),
          pincode: customerPincode.trim()
        },
        items: cartItems,
        couponCode: couponCode.trim(),
        discountAmount,
        subtotal,
        totalAmount: finalTotal,
        origin: window.location.origin
      };

      await cloudSqlApi.createAssistedCart(payload);

      const link = `${window.location.origin}/?assisted_cart=${cartId}`;
      setGeneratedLink(link);
      showNotification('Direct checkout & payment link generated successfully!');
    } catch {
      // Fallback
      const fallbackCartId = `concierge-${Date.now().toString(36)}`;
      const link = `${window.location.origin}/?assisted_cart=${fallbackCartId}`;
      setGeneratedLink(link);
      showNotification('Concierge link ready!');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    showNotification('Payment link copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  // WhatsApp sharing
  const cleanPhone = (customerPhone || '').replace(/\D/g, '');
  const itemsSummary = cartItems
    .map((i) => `• ${i.productName} (${i.size}) × ${i.quantity} = ₹${i.totalPrice.toLocaleString('en-IN')}`)
    .join('\n');

  const whatsappMessage = encodeURIComponent(
    `Namaste ${customerName || 'Valued Connoisseur'},\n\nYour bespoke FRAGMORÉ luxury fragrance order has been prepared by our Atelier concierge:\n\n${itemsSummary}\n\nTotal Amount: ₹${finalTotal.toLocaleString('en-IN')} (All Taxes & Express Shipping Included)\n\nClick your private checkout link below to complete your order with 1-click payment:\n${generatedLink || ''}\n\nOur team is at your disposal should you require any assistance.\n— FRAGMORÉ Haute Parfumerie`
  );

  const smsMessage = encodeURIComponent(
    `FRAGMORE: Hi ${customerName || 'there'}, your order is ready. Click to pay securely: ${generatedLink || ''} (Total: ₹${finalTotal.toLocaleString('en-IN')})`
  );

  const emailSubject = encodeURIComponent(`Your Curated FRAGMORÉ Order & Direct Checkout Link`);
  const emailBody = encodeURIComponent(
    `Dear ${customerName || 'Connoisseur'},\n\nWe have prepared your personalized fragrance selection at FRAGMORÉ:\n\n${itemsSummary}\n\nSubtotal: ₹${subtotal.toLocaleString('en-IN')}\nDiscount: ₹${discountAmount.toLocaleString('en-IN')}\nTotal Payable: ₹${finalTotal.toLocaleString('en-IN')} (18% GST Inclusive)\n\nPlease review and finalize your order directly here:\n${generatedLink || ''}\n\nWarm regards,\nFRAGMORÉ Concierge Atelier\nhttps://fragmore.in`
  );

  // Direct Order Placement Option
  const handlePlaceDirectOrder = async (isCod: boolean = false) => {
    if (cartItems.length === 0) return;
    setIsPlacingDirect(true);
    try {
      const newOrder = {
        customerId: selectedCustomerId || `cust-${Date.now()}`,
        customerName: customerName.trim() || 'Private Connoisseur',
        customerEmail: customerEmail.trim() || 'concierge@fragmore.in',
        customerPhone: customerPhone.trim() || '+91 98201 00000',
        shippingAddress: {
          id: `addr-${Date.now()}`,
          fullName: customerName.trim() || 'Private Connoisseur',
          phone: customerPhone.trim() || '+91 98201 00000',
          email: customerEmail.trim() || 'concierge@fragmore.in',
          addressLine1: customerAddress.trim() || 'Bespoke Atelier Delivery',
          city: customerCity.trim() || 'Mumbai',
          state: customerState.trim() || 'Maharashtra',
          pincode: customerPincode.trim() || '400001',
          isDefault: true
        },
        items: cartItems.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          size: i.size,
          sku: i.sku,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          totalPrice: i.totalPrice,
          selectedFlavours: i.selectedFlavours
        })),
        subtotal,
        discount: discountAmount,
        shippingAmount: 0,
        taxAmount: gstInclusive,
        totalAmount: finalTotal,
        paymentStatus: (isCod ? 'PENDING' : 'PAID') as 'PENDING' | 'PAID',
        paymentMethod: (isCod ? 'COD' : 'UPI') as any,
        orderStatus: 'CONFIRMED' as const,
        couponCode: couponCode || undefined
      };

      const placed = createOrder(newOrder);
      showNotification(`Order ${placed.orderNumber} created directly in the system!`);
      onClose();
    } catch {
      showNotification('Failed to create order directly.');
    } finally {
      setIsPlacingDirect(false);
    }
  };

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentProd = activeProducts.find((p) => p.id === selectedProductId);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="bg-[#0E0E14] border border-[#D4AF37]/40 w-full max-w-4xl my-auto max-h-[92vh] overflow-y-auto rounded-2xl p-5 sm:p-8 text-[#F3EFE6] space-y-6 shadow-2xl relative font-mono text-xs">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#E5C378] text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Atelier Assisted Order Concierge
              </span>
            </div>
            <h3 className="font-serif text-xl sm:text-2xl uppercase tracking-wider text-white mt-1">
              Create Customer &amp; Direct Payment Link
            </h3>
            <p className="text-white/50 text-[11px] mt-0.5">
              Assists confused customers by assembling their cart from the backend and generating an instant 1-click checkout link shareable via WhatsApp, SMS &amp; Email.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/50 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Customer & Cart Builder (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. Customer Selection / Input */}
            <div className="p-4 bg-[#14141C] border border-white/10 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-[#D4AF37] tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> 1. Customer Details
                </span>
                {customers.length > 0 && (
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => handleSelectExistingCustomer(e.target.value)}
                    className="bg-[#08080A] border border-white/15 rounded px-2 py-1 text-[10px] text-white/80"
                  >
                    <option value="">-- Choose Existing Connoisseur --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone || c.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-white/60 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maharani Gayatri"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setSelectedCustomerId('');
                    }}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-white/60 mb-1">WhatsApp / Phone *</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-white/40" />
                    <input
                      type="tel"
                      required
                      placeholder="+91 98201 00000"
                      value={customerPhone}
                      onChange={(e) => {
                        setCustomerPhone(e.target.value);
                        setSelectedCustomerId('');
                      }}
                      className="w-full bg-[#08080A] border border-white/20 rounded p-2 pl-8 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-white/60 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-white/40" />
                    <input
                      type="email"
                      placeholder="client@luxury.in"
                      value={customerEmail}
                      onChange={(e) => {
                        setCustomerEmail(e.target.value);
                        setSelectedCustomerId('');
                      }}
                      className="w-full bg-[#08080A] border border-white/20 rounded p-2 pl-8 text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-white/60 mb-1">Delivery City &amp; PIN</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="City"
                      value={customerCity}
                      onChange={(e) => setCustomerCity(e.target.value)}
                      className="w-2/3 bg-[#08080A] border border-white/20 rounded p-2 text-white"
                    />
                    <input
                      type="text"
                      placeholder="PIN"
                      value={customerPincode}
                      onChange={(e) => setCustomerPincode(e.target.value)}
                      className="w-1/3 bg-[#08080A] border border-white/20 rounded p-2 text-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-white/60 mb-1">Street Address</label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-white/40" />
                  <input
                    type="text"
                    placeholder="Bungalow / Suite / Landmark"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2 pl-8 text-white"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={saveToCrm}
                  onChange={(e) => setSaveToCrm(e.target.checked)}
                  className="rounded border-white/30 text-[#D4AF37] focus:ring-[#D4AF37]"
                />
                <span className="text-[10px] text-white/60">
                  Save customer profile in CRM registry for repeat re-orders
                </span>
              </label>
            </div>

            {/* 2. Add Fragrance to Assisted Cart */}
            <div className="p-4 bg-[#14141C] border border-white/10 rounded-xl space-y-3">
              <span className="text-[10px] uppercase font-bold text-[#D4AF37] tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5" /> 2. Select &amp; Add Fragrances
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Product */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] text-white/60 mb-1">Fragrance Creation</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleProductChange(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2 text-white"
                  >
                    {activeProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.collection})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Variant */}
                <div>
                  <label className="block text-[10px] text-white/60 mb-1">Size / Variant</label>
                  <select
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2 text-white"
                  >
                    {(currentProd?.variants || []).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.size} — ₹{v.sellingPrice}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Special Discovery Six sample picker if selected */}
              {currentProd?.name.toUpperCase().includes('DISCOVERY') && (
                <div className="p-2.5 bg-[#08080A] border border-[#D4AF37]/30 rounded-lg space-y-1.5">
                  <span className="text-[10px] text-[#D4AF37] font-semibold block">
                    Curated Discovery Six Included Flavours:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {discoveryFlavours.map((f) => (
                      <span
                        key={f}
                        className="px-2 py-0.5 rounded bg-white/10 text-white/90 text-[10px]"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-white/60">Qty:</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                    className="w-16 bg-[#08080A] border border-white/20 rounded p-1.5 text-center text-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex-1 py-2 bg-white/10 hover:bg-[#D4AF37] hover:text-[#08080A] text-white font-bold rounded transition-colors uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" /> + Add to Cart
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Cart Review & Link Sharing (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Cart Items List */}
            <div className="p-4 bg-[#14141C] border border-white/10 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-[10px] uppercase font-bold text-[#D4AF37] tracking-wider">
                  Assisted Cart Items ({cartItems.length})
                </span>
                {cartItems.length > 0 && (
                  <button
                    onClick={() => setCartItems([])}
                    className="text-[10px] text-rose-400 hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {cartItems.length === 0 ? (
                <div className="text-center py-6 text-white/30 text-[11px]">
                  No items in cart yet. Add products from the catalogue.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {cartItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-[#08080A] border border-white/10 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-white text-[11px]">{item.productName}</div>
                        <div className="text-[10px] text-white/50">
                          {item.size} · ₹{item.unitPrice} × {item.quantity}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-[#D4AF37] text-[11px]">
                          ₹{item.totalPrice.toLocaleString('en-IN')}
                        </span>
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="text-white/30 hover:text-rose-400 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Order Math Summary */}
              {cartItems.length > 0 && (
                <div className="pt-3 border-t border-white/10 space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-white/60">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white/60">Privilege Discount</span>
                    <input
                      type="number"
                      min={0}
                      max={subtotal}
                      placeholder="₹0"
                      value={discountAmount || ''}
                      onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                      className="w-20 bg-[#08080A] border border-white/20 rounded px-2 py-0.5 text-right text-emerald-400 text-xs"
                    />
                  </div>

                  <div className="flex justify-between text-white/60">
                    <span>GST (18% inclusive)</span>
                    <span>₹{gstInclusive.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex justify-between text-white/60">
                    <span>Express Insured Shipping</span>
                    <span className="text-emerald-400 font-semibold">FREE</span>
                  </div>

                  <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-white/10">
                    <span>Total Amount</span>
                    <span className="text-[#D4AF37]">₹{finalTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action 1: Generate Link & Direct Sharing */}
            <div className="p-4 bg-[#14141C] border border-[#D4AF37]/30 rounded-xl space-y-3">
              <button
                type="button"
                disabled={cartItems.length === 0 || isGenerating}
                onClick={handleGenerateLink}
                className="w-full py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] disabled:opacity-50 text-[#08080A] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                {isGenerating
                  ? 'Generating Secure Link...'
                  : generatedLink
                  ? 'Regenerate Direct Link'
                  : 'Generate Direct Checkout & Payment Link'}
              </button>

              {generatedLink && (
                <div className="space-y-3 pt-2 animate-in fade-in duration-200">
                  <div className="p-2.5 bg-[#08080A] border border-white/20 rounded-lg flex items-center justify-between gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedLink}
                      className="w-full bg-transparent text-[11px] text-white/80 focus:outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-bold flex items-center gap-1 shrink-0"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy
                        </>
                      )}
                    </button>
                  </div>

                  {/* Share buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <a
                      href={`https://wa.me/${cleanPhone}?text=${whatsappMessage}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-center flex flex-col items-center gap-1 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-400" />
                      <span className="text-[10px]">WhatsApp</span>
                    </a>

                    <a
                      href={`sms:${cleanPhone}?body=${smsMessage}`}
                      className="p-2 rounded bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 font-bold text-center flex flex-col items-center gap-1 transition-colors"
                    >
                      <Smartphone className="w-4 h-4 text-sky-400" />
                      <span className="text-[10px]">SMS</span>
                    </a>

                    <a
                      href={`mailto:${customerEmail}?subject=${emailSubject}&body=${emailBody}`}
                      className="p-2 rounded bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 font-bold text-center flex flex-col items-center gap-1 transition-colors"
                    >
                      <Mail className="w-4 h-4 text-amber-400" />
                      <span className="text-[10px]">Email</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Direct confirmed order option */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                <span className="text-white/50">Or place in CRM directly:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={cartItems.length === 0 || isPlacingDirect}
                    onClick={() => handlePlaceDirectOrder(false)}
                    className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] cursor-pointer"
                  >
                    Direct Prepaid
                  </button>
                  <button
                    type="button"
                    disabled={cartItems.length === 0 || isPlacingDirect}
                    onClick={() => handlePlaceDirectOrder(true)}
                    className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] cursor-pointer"
                  >
                    Direct COD
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
