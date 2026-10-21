import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import {
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Search,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  Lock,
  Unlock,
  Check,
  Building2,
  Barcode,
  X,
  UserPlus,
  UserCheck,
  RotateCcw,
  Loader2,
  ListChecks,
  Printer,
  SlidersHorizontal,
  ArrowLeftRight,
  Edit2,
  Warehouse,
  ShieldCheck,
  LayoutGrid,
  List,
  Percent,
  Eye,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { showLeaveCartAlert, showClearCartAlert } from '../../lib/sweetalert';
import { useAuthStore } from '../../stores/authStore';
import { useExchangeRateStore } from '../../stores/exchangeRateStore';
import { FiscalInvoiceModal, FiscalInvoiceTicketData } from './FiscalInvoiceModal';
import {
  formatNumber,
  formatCurrency,
  formatMoneyUSD,
  formatMoneyVES,
  formatExchangeRate,
  formatPercent,
  parseFormattedNumber,
  PaymentMethod,
  isSuperAdminRole,
  isSupervisorOrAdminRole,
  canAuthorizeOperations,
} from '@ero/shared';

export interface ProductPresentationPOS {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  multiplier: number;
  basePrice?: number | null;
  costPrice?: number | null;
  requiresAuthorization?: boolean;
  isDefault?: boolean;
}

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  priceUSD: number;
  taxRatePercent: number;
  stock?: number;
  barcode?: string;
  unitOfMeasure?: string;
  presentations?: ProductPresentationPOS[];
}

interface CartItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRatePercent: number;
  grossAmount: number;
  discountPercent: number;
  discountAmount: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  isNegativeStockAuthorized?: boolean;
  isPresentationAuthorized?: boolean;
  requiresAuthorization?: boolean;
  supervisorApprovedBy?: string;
  presentationId?: string | null;
  presentationName?: string | null;
  multiplier?: number;
}

interface PaymentEntry {
  method: string;
  methodName?: string;
  amountUSD: number;
  amountVES: number;
  exchangeRate: number;
  referenceNumber?: string;
  appliesIGTF: boolean;
  igtfAmountUSD: number;
  igtfAmountVES: number;
}

export const POSRegister: React.FC = () => {
  const navigate = useNavigate();
  const { activeBranchId, activeWarehouseId, token, user } = useAuthStore();

  const exchangeRateBCV = useExchangeRateStore((s) => s.rate);
  const fetchRate = useExchangeRateStore((s) => s.fetchRate);

  // Modal de Verificación del Carrito
  const [isCartReviewModalOpen, setIsCartReviewModalOpen] = useState(false);

  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [loadingShift, setLoadingShift] = useState(true);

  // Estado para apertura de turno de caja dentro del POS
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [availableRegisters, setAvailableRegisters] = useState<any[]>([]);
  const [loadingRegisters, setLoadingRegisters] = useState(false);
  const [openRegisterId, setOpenRegisterId] = useState('');
  const [openInitialUSD, setOpenInitialUSD] = useState<number | string>('0.00');
  const [openInitialVES, setOpenInitialVES] = useState<number | string>('0.00');
  const [openNotes, setOpenNotes] = useState('');
  const [isOpeningShift, setIsOpeningShift] = useState(false);

  // Opciones de visualización y densidad del catálogo de productos
  const [catalogViewMode, setCatalogViewMode] = useState<'grid' | 'list'>('grid');
  const [catalogOptions, setCatalogOptions] = useState({
    showBarcode: true,
    showSku: true,
    showPrice: true,
    showStock: true,
    showDescription: true,
  });
  const [isOptionsDropdownOpen, setIsOptionsDropdownOpen] = useState(false);

  // Modal de Selección de Presentaciones del Producto
  const [isPresentationModalOpen, setIsPresentationModalOpen] = useState(false);
  const [selectedProductForPresentation, setSelectedProductForPresentation] = useState<ProductItem | null>(null);
  const [selectedPresentationId, setSelectedPresentationId] = useState<string | null>(null);
  const [presentationQty, setPresentationQty] = useState<number>(1);
  const [presentationModalError, setPresentationModalError] = useState<string | null>(null);

  // Modal para aplicar descuento individual a renglón del carrito
  const [editingDiscountItem, setEditingDiscountItem] = useState<{
    productId: string;
    presentationId: string | null;
    productName: string;
    currentDiscountPercent: number;
  } | null>(null);
  const [discountInputPercent, setDiscountInputPercent] = useState<string>('0');

  // Reglas de negocio (Stock negativo y autorizaciones)
  const [businessRules, setBusinessRules] = useState<{
    allowNegativeStock: boolean;
    requireApprovalNegativeStock: boolean;
  }>({
    allowNegativeStock: true,
    requireApprovalNegativeStock: true,
  });

  // Modal de Autorización de Supervisor para Stock en Negativo o Presentaciones Restringidas
  interface SupervisorApprovalRequest {
    productId: string;
    productName: string;
    sku: string;
    availableStock: number;
    targetQty: number;
    deficit: number;
    action: 'ADD' | 'UPDATE' | 'PRESENTATION_AUTH';
    presentationId?: string | null;
    presentationName?: string | null;
    multiplier?: number;
    unitPrice?: number;
  }
  const [pendingStockApproval, setPendingStockApproval] = useState<SupervisorApprovalRequest | null>(null);
  const [isSupervisorModalOpen, setIsSupervisorModalOpen] = useState(false);
  const [supervisorUsername, setSupervisorUsername] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [isAuthorizingSupervisor, setIsAuthorizingSupervisor] = useState(false);
  const [supervisorAuthError, setSupervisorAuthError] = useState<string | null>(null);

  // Cliente de la venta
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDocType, setCustomerDocType] = useState<'V' | 'E' | 'J' | 'G' | 'P'>('V');
  const [customerDocNumber, setCustomerDocNumber] = useState('99999999');
  const [customerName, setCustomerName] = useState('CONSUMIDOR FINAL');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSpecialTaxpayer, setIsSpecialTaxpayer] = useState(false);

  // Búsqueda de clientes
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Modal: Registrar Nuevo Cliente
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [newCustomerDocType, setNewCustomerDocType] = useState<'V' | 'E' | 'J' | 'G' | 'P'>('V');
  const [newCustomerDocNumber, setNewCustomerDocNumber] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCustomerIsSpecialTaxpayer, setNewCustomerIsSpecialTaxpayer] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomerError, setNewCustomerError] = useState<string | null>(null);

  // Modal de Pago
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [currentMethod, setCurrentMethod] = useState<string>('CASH_USD');
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentCurrencyMode, setPaymentCurrencyMode] = useState<'USD' | 'VES'>('USD');
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
  const [paymentRefInput, setPaymentRefInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de Ticket Fiscal Emitido / Ticket de Venta
  const [invoiceTicketData, setInvoiceTicketData] = useState<FiscalInvoiceTicketData | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [showPrintPromptModal, setShowPrintPromptModal] = useState(false);

  // Modal de captura / edición de referencia bancaria o lote
  const [quickRefPrompt, setQuickRefPrompt] = useState<{
    isOpen: boolean;
    method: string;
    methodName: string;
    amountUSD: number;
    amountVES: number;
    isVES: boolean;
    refValue: string;
    isEditingPaymentIndex?: number;
  }>({
    isOpen: false,
    method: '',
    methodName: '',
    amountUSD: 0,
    amountVES: 0,
    isVES: false,
    refValue: '',
  });

  // Manejo global de tecla Escape para cancelar o cerrar modales activos
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (quickRefPrompt.isOpen) {
          setQuickRefPrompt({
            isOpen: false,
            method: '',
            methodName: '',
            amountUSD: 0,
            amountVES: 0,
            isVES: false,
            refValue: '',
          });
        } else if (editingDiscountItem) {
          setEditingDiscountItem(null);
        } else if (isPresentationModalOpen) {
          setIsPresentationModalOpen(false);
          setSelectedProductForPresentation(null);
          setPresentationModalError(null);
        } else if (isOptionsDropdownOpen) {
          setIsOptionsDropdownOpen(false);
        } else if (showPrintPromptModal) {
          setShowPrintPromptModal(false);
        } else if (isNewCustomerModalOpen) {
          setIsNewCustomerModalOpen(false);
        } else if (isCartReviewModalOpen) {
          setIsCartReviewModalOpen(false);
        } else if (isInvoiceModalOpen) {
          setIsInvoiceModalOpen(false);
        } else if (isPaymentModalOpen) {
          setIsPaymentModalOpen(false);
        } else if (isSupervisorModalOpen) {
          setIsSupervisorModalOpen(false);
          setPendingStockApproval(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    quickRefPrompt.isOpen,
    editingDiscountItem,
    isPresentationModalOpen,
    isOptionsDropdownOpen,
    showPrintPromptModal,
    isNewCustomerModalOpen,
    isCartReviewModalOpen,
    isInvoiceModalOpen,
    isPaymentModalOpen,
    isSupervisorModalOpen,
  ]);

  // Guard de Navegación con SweetAlert: advertir al usuario si intenta cambiar de página con productos en el carrito
  useEffect(() => {
    if (cart.length === 0) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
      if (anchor.target === '_blank') return;

      const currentPath = window.location.pathname;
      if (href !== currentPath && !href.startsWith(currentPath + '#')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        showLeaveCartAlert().then((confirmed) => {
          if (confirmed) {
            setCart([]);
            if (href.startsWith('http://') || href.startsWith('https://')) {
              window.location.href = href;
            } else {
              navigate(href);
            }
          }
        });
      }
    };

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.pathname);
      showLeaveCartAlert().then((confirmed) => {
        if (confirmed) {
          setCart([]);
          window.history.back();
        }
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [cart.length, navigate]);

  // Determinar si la caja activa opera con impresora fiscal
  const isFiscal = useMemo(() => {
    if (!activeShift) return false;
    return activeShift.invoiceMode === 'fiscal_printer';
  }, [activeShift]);

  useEffect(() => {
    checkCurrentShift();
    fetchBusinessRules();
    fetchProducts();
    fetchPaymentMethods();
  }, [activeBranchId]);

  // Búsqueda debounced de clientes (300ms)
  useEffect(() => {
    if (!customerSearchQuery.trim()) {
      setCustomerSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingCustomer(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch(`/api/customers?search=${encodeURIComponent(customerSearchQuery.trim())}`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setCustomerSearchResults(json.data);
          }
        }
      } catch {
        setCustomerSearchResults([]);
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customerSearchQuery, token]);

  const fetchBusinessRules = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch('/api/config/business-rules', { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setBusinessRules({
            allowNegativeStock: json.data.allowNegativeStock !== undefined ? Boolean(json.data.allowNegativeStock) : true,
            requireApprovalNegativeStock: json.data.requireApprovalNegativeStock !== undefined ? Boolean(json.data.requireApprovalNegativeStock) : true,
          });
        }
      }
    } catch {
      // Usar defaults
    }
  };

  const checkCurrentShift = async () => {
    setLoadingShift(true);
    try {
      const branchParam = activeBranchId ? `?branchId=${activeBranchId}` : '';
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/pos/shifts/current${branchParam}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setActiveShift(json.data);
          if (json.data.warehouseId) {
            fetchProducts(json.data.warehouseId);
          }
        } else {
          setActiveShift(null);
        }
      } else {
        setActiveShift(null);
      }
    } catch {
      setActiveShift(null);
    } finally {
      setLoadingShift(false);
    }
  };

  const fetchRegistersForShift = async () => {
    setLoadingRegisters(true);
    try {
      const branchParam = activeBranchId ? `?branchId=${activeBranchId}` : '';
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/pos/registers${branchParam}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setAvailableRegisters(json.data);
          const firstAvailable = json.data.find((r: any) => !r.hasActiveShift);
          if (firstAvailable) {
            setOpenRegisterId(firstAvailable.id);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingRegisters(false);
    }
  };

  const handleOpenShiftSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!openRegisterId) {
      toast.error('Debe seleccionar una caja registradora');
      return;
    }
    const reg = availableRegisters.find((r) => r.id === openRegisterId);
    if (reg?.hasActiveShift) {
      toast.error(`La caja ${reg.code} ya tiene un turno abierto por ${reg.activeCashierName || 'otro cajero'}`);
      return;
    }

    setIsOpeningShift(true);
    try {
      const res = await fetch('/api/pos/shifts/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          cashRegisterId: openRegisterId,
          branchId: activeBranchId || reg?.branchId || 'b1111111-1111-1111-1111-111111111111',
          initialCashUSD: Number(openInitialUSD) || 0,
          initialCashVES: Number(openInitialVES) || 0,
          notes: openNotes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Error al abrir el turno');
      }

      toast.success('Turno de caja abierto correctamente');
      setShowOpenShiftModal(false);
      await checkCurrentShift();
    } catch (err: any) {
      toast.error(err.message || 'Error al abrir turno');
    } finally {
      setIsOpeningShift(false);
    }
  };

  const fetchProducts = async (warehouseIdOverride?: string) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const targetWh = warehouseIdOverride || activeShift?.warehouseId || activeWarehouseId;
      const queryParam = targetWh ? `?warehouseId=${encodeURIComponent(targetWh)}` : '';
      const res = await fetch(`/api/inventory/products${queryParam}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const mapped: ProductItem[] = json.data.map((p: any) => {
            const rawTax = p.taxRate ?? p.tax_rate_percentage ?? p.tax_rate;
            const parsedTax = rawTax !== undefined && rawTax !== null ? parseFloat(rawTax) : 16.0;
            const price = parseFloat(p.basePrice ?? p.sale_price_usd ?? p.base_price ?? 0);
            const stock = parseFloat(p.currentStock ?? p.stock ?? 0);

            return {
              id: p.id,
              sku: p.sku,
              name: p.name,
              description: p.description || null,
              priceUSD: isNaN(price) || price <= 0 ? 0 : price,
              taxRatePercent: isNaN(parsedTax) ? 16.0 : parsedTax,
              stock: isNaN(stock) ? 0 : stock,
              barcode: p.barcode,
              unitOfMeasure: p.unitOfMeasure,
              presentations: Array.isArray(p.presentations)
                ? p.presentations.map((pr: any) => ({
                    id: pr.id,
                    name: pr.name,
                    sku: pr.sku,
                    barcode: pr.barcode,
                    multiplier: Number(pr.multiplier) || 1,
                    basePrice:
                      pr.basePrice !== null && pr.basePrice !== undefined
                        ? Number(pr.basePrice)
                        : null,
                    costPrice:
                      pr.costPrice !== null && pr.costPrice !== undefined
                        ? Number(pr.costPrice)
                        : null,
                    requiresAuthorization: Boolean(pr.requiresAuthorization),
                    isDefault: Boolean(pr.isDefault),
                  }))
                : [],
            };
          });
          setProducts(mapped);
        } else {
          setProducts([]);
        }
      } else {
        setProducts([]);
      }
    } catch {
      setProducts([]);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch('/api/pos/payment-methods', { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setAvailablePaymentMethods(json.data);
          return;
        }
      }
      setAvailablePaymentMethods([]);
    } catch {
      setAvailablePaymentMethods([]);
    }
  };

  const handleSelectCustomer = (c: any) => {
    const isBlocked = Boolean(c.isBlocked || c.is_blocked || c.status === 'BLOCKED');
    if (isBlocked) {
      toast.error(
        `El cliente "${c.name}" está BLOQUEADO. Motivo: ${c.blockReason || c.block_reason || 'Consulte con administración'}. No puede ser seleccionado.`
      );
      return;
    }
    setSelectedCustomerId(c.id);
    setCustomerDocType(c.docType || 'V');
    setCustomerDocNumber(c.docNumber || '');
    setCustomerName(c.name || '');
    setCustomerAddress(c.address || '');
    setCustomerPhone(c.phone || '');
    setIsSpecialTaxpayer(Boolean(c.isSpecialTaxpayer));
    setCustomerSearchQuery('');
    setShowCustomerDropdown(false);
    toast.success(`Cliente seleccionado: ${c.name}`);
  };

  const handleResetToConsumerFinal = () => {
    setSelectedCustomerId(null);
    setCustomerDocType('V');
    setCustomerDocNumber('99999999');
    setCustomerName('CONSUMIDOR FINAL');
    setCustomerAddress('');
    setCustomerPhone('');
    setIsSpecialTaxpayer(false);
    setCustomerSearchQuery('');
    setShowCustomerDropdown(false);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerDocNumber.trim()) {
      setNewCustomerError('El número de documento es requerido');
      return;
    }
    if (!newCustomerName.trim()) {
      setNewCustomerError('El nombre o razón social es requerido');
      return;
    }

    setIsCreatingCustomer(true);
    setNewCustomerError(null);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          docType: newCustomerDocType,
          docNumber: newCustomerDocNumber.trim(),
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || undefined,
          email: newCustomerEmail.trim() || undefined,
          address: newCustomerAddress.trim() || undefined,
          isSpecialTaxpayer: newCustomerIsSpecialTaxpayer,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Error al registrar el cliente');
      }

      handleSelectCustomer(json.data);
      toast.success('Cliente registrado exitosamente');
      setIsNewCustomerModalOpen(false);
      setNewCustomerDocNumber('');
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerEmail('');
      setNewCustomerAddress('');
      setNewCustomerIsSpecialTaxpayer(false);
    } catch (err: any) {
      setNewCustomerError(err.message || 'Error al registrar cliente');
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  // Filtrado de productos (búsqueda por nombre, SKU principal, código de barras o SKUs/códigos de presentaciones)
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.toLowerCase().includes(term)) ||
        (p.presentations &&
          p.presentations.some(
            (pr) =>
              (pr.sku && pr.sku.toLowerCase().includes(term)) ||
              (pr.barcode && pr.barcode.toLowerCase().includes(term)) ||
              (pr.name && pr.name.toLowerCase().includes(term))
          ))
    );
  }, [products, searchTerm]);

  // Escaneo o ingreso de SKU / Código de barras (Reconocimiento de presentaciones)
  const handleBarcodeOrSkuScan = (query: string) => {
    const term = query.trim();
    if (!term) return;

    // 1. Prioridad: Verificar si coincide exactamente con el SKU o Código de Barras de una Presentación
    for (const p of products) {
      if (p.presentations && p.presentations.length > 0) {
        const matchedPres = p.presentations.find(
          (pr) =>
            (pr.barcode && pr.barcode.trim().toLowerCase() === term.toLowerCase()) ||
            (pr.sku && pr.sku.trim().toLowerCase() === term.toLowerCase())
        );
        if (matchedPres) {
          addPresentationToCart(p, matchedPres);
          setSearchTerm('');
          return;
        }
      }
    }

    // 2. Verificar si coincide exactamente con el SKU o Código de Barras de un Producto Base
    const exactProduct = products.find(
      (p) =>
        (p.barcode && p.barcode.trim().toLowerCase() === term.toLowerCase()) ||
        p.sku.trim().toLowerCase() === term.toLowerCase()
    );
    if (exactProduct) {
      addPresentationToCart(exactProduct, null);
      setSearchTerm('');
      return;
    }

    // 3. Fallback: Si la búsqueda filtrada arrojó resultados, añadir el primero
    if (filteredProducts.length > 0) {
      const topProduct = filteredProducts[0];
      const matchedPresInTop = topProduct.presentations?.find(
        (pr) =>
          (pr.barcode && pr.barcode.trim().toLowerCase() === term.toLowerCase()) ||
          (pr.sku && pr.sku.trim().toLowerCase() === term.toLowerCase())
      );
      if (matchedPresInTop) {
        addPresentationToCart(topProduct, matchedPresInTop);
      } else {
        addPresentationToCart(topProduct, null);
      }
      setSearchTerm('');
      return;
    }

    toast.error(`No se encontró ningún producto o presentación con el código "${term}"`);
  };

  // Aplica la modificación al carrito registrando el estado de autorización si aplica
  const applyCartItem = (
    product: ProductItem,
    newQuantity: number,
    presentation?: ProductPresentationPOS | null,
    isAuthorized = false,
    authorizedBy?: string,
    isPresAuthorized = false,
    discountPercentOverride?: number
  ) => {
    const presId = presentation?.id || null;
    const multiplier = presentation?.multiplier || 1;
    const presName = presentation?.name || null;
    const presSku = presentation?.sku || product.sku;
    const presPrice =
      presentation?.basePrice !== null && presentation?.basePrice !== undefined
        ? presentation.basePrice
        : Number((product.priceUSD * multiplier).toFixed(4));
    const displayName = presName ? `${product.name} (${presName})` : product.name;
    const requiresAuth = Boolean(presentation?.requiresAuthorization);

    setCart((prev) => {
      const existing = prev.find(
        (item) => item.productId === product.id && (item.presentationId || null) === presId
      );
      if (newQuantity <= 0) {
        return prev.filter(
          (item) => !(item.productId === product.id && (item.presentationId || null) === presId)
        );
      }

      const discPercent =
        discountPercentOverride !== undefined
          ? discountPercentOverride
          : (existing?.discountPercent || 0);

      const grossAmount = Number((newQuantity * presPrice).toFixed(2));
      const discountAmount = Number(((grossAmount * discPercent) / 100).toFixed(2));
      const subtotal = Number((grossAmount - discountAmount).toFixed(2));
      const taxAmount = Number(((subtotal * product.taxRatePercent) / 100).toFixed(2));
      const total = Number((subtotal + taxAmount).toFixed(2));

      if (existing) {
        return prev.map((item) =>
          item.productId === product.id && (item.presentationId || null) === presId
            ? {
                ...item,
                quantity: newQuantity,
                unitPrice: presPrice,
                grossAmount,
                discountPercent: discPercent,
                discountAmount,
                subtotal,
                taxAmount,
                total,
                isNegativeStockAuthorized: isAuthorized || item.isNegativeStockAuthorized,
                isPresentationAuthorized: isPresAuthorized || item.isPresentationAuthorized,
                requiresAuthorization: requiresAuth || item.requiresAuthorization,
                supervisorApprovedBy: authorizedBy || item.supervisorApprovedBy,
              }
            : item
        );
      }

      return [
        ...prev,
        {
          productId: product.id,
          sku: presSku,
          name: displayName,
          quantity: newQuantity,
          unitPrice: presPrice,
          taxRatePercent: product.taxRatePercent,
          grossAmount,
          discountPercent: discPercent,
          discountAmount,
          subtotal,
          taxAmount,
          total,
          isNegativeStockAuthorized: isAuthorized,
          isPresentationAuthorized: isPresAuthorized,
          requiresAuthorization: requiresAuth,
          supervisorApprovedBy: authorizedBy,
          presentationId: presId,
          presentationName: presName,
          multiplier,
        },
      ];
    });
  };

  // Añadir presentación o producto base al carrito con validación rigurosa de stock disponible y autorizaciones
  const addPresentationToCart = (
    product: ProductItem,
    presentation?: ProductPresentationPOS | null,
    qtyToAdd = 1
  ) => {
    const validQtyToAdd = Math.max(1, qtyToAdd);
    const presId = presentation?.id || null;
    const multiplier = presentation?.multiplier || 1;
    const presName = presentation?.name || null;
    const displayName = presName ? `${product.name} (${presName})` : product.name;

    const existing = cart.find(
      (item) => item.productId === product.id && (item.presentationId || null) === presId
    );
    const currentQty = existing ? existing.quantity : 0;
    const targetQty = currentQty + validQtyToAdd;

    // Validar si la presentación requiere autorización de supervisor para ser vendida
    const isAlreadyPresAuthorized = Boolean(existing?.isPresentationAuthorized);
    if (presentation?.requiresAuthorization && !isAlreadyPresAuthorized) {
      const isCurrentUserAdmin = canAuthorizeOperations(user?.role, user?.permissions);
      if (!isCurrentUserAdmin) {
        setPendingStockApproval({
          productId: product.id,
          productName: displayName,
          sku: presentation?.sku || product.sku,
          availableStock: product.stock ?? 0,
          targetQty,
          deficit: 0,
          action: 'PRESENTATION_AUTH',
          presentationId: presId,
          presentationName: presName,
          multiplier,
          unitPrice:
            presentation?.basePrice !== null && presentation?.basePrice !== undefined
              ? presentation.basePrice
              : Number((product.priceUSD * multiplier).toFixed(4)),
        });
        setSupervisorAuthError(null);
        setSupervisorUsername('');
        setSupervisorPassword('');
        setSupervisorNotes('');
        setIsSupervisorModalOpen(true);
        toast.warning(
          `La presentación "${presName}" requiere autorización de supervisor para ser vendida.`
        );
        return;
      }
    }

    // Calcular cuántas unidades base del producto ya están en el carrito por otros renglones
    const otherCommittedUnits = cart
      .filter((i) => i.productId === product.id && (i.presentationId || null) !== presId)
      .reduce((sum, i) => sum + i.quantity * (i.multiplier || 1), 0);

    const totalBaseUnitsRequested = otherCommittedUnits + targetQty * multiplier;
    const availableStock = product.stock ?? 0;

    // Validar si el producto no tiene existencia suficiente en almacén
    if (totalBaseUnitsRequested > availableStock) {
      if (!businessRules.allowNegativeStock) {
        toast.error(
          `Existencia insuficiente para "${displayName}" en almacén (Disponible: ${availableStock} unidades base, Requerido total: ${totalBaseUnitsRequested}). Las reglas de negocio no permiten ventas con existencia en negativo.`
        );
        return;
      }

      if (businessRules.requireApprovalNegativeStock) {
        setPendingStockApproval({
          productId: product.id,
          productName: displayName,
          sku: presentation?.sku || product.sku,
          availableStock,
          targetQty,
          deficit: totalBaseUnitsRequested - availableStock,
          action: existing ? 'UPDATE' : 'ADD',
          presentationId: presId,
          presentationName: presName,
          multiplier,
          unitPrice:
            presentation?.basePrice !== null && presentation?.basePrice !== undefined
              ? presentation.basePrice
              : Number((product.priceUSD * multiplier).toFixed(4)),
        });
        setSupervisorAuthError(null);
        setSupervisorUsername('');
        setSupervisorPassword('');
        setSupervisorNotes('');
        setIsSupervisorModalOpen(true);
        toast.warning(
          `"${displayName}" excede la existencia disponible en almacén (${availableStock} unidades base). Se requiere autorización de supervisor para continuar.`
        );
        return;
      }

      toast.warning(
        `Atención: "${displayName}" excede la existencia disponible (${availableStock} unidades base). Se registrará con existencia en negativo.`
      );
    }

    const autoPresAuth = Boolean(
      presentation?.requiresAuthorization && canAuthorizeOperations(user?.role, user?.permissions)
    );
    applyCartItem(
      product,
      targetQty,
      presentation,
      false,
      autoPresAuth ? (user?.fullName || user?.role || 'Supervisor') : undefined,
      autoPresAuth
    );
  };

  // Wrapper para añadir producto base
  const addToCart = (product: ProductItem) => {
    addPresentationToCart(product, null, 1);
  };

  // Manejador centralizado para seleccionar un producto desde el catálogo
  const handleSelectProduct = (product: ProductItem) => {
    if (product.presentations && product.presentations.length > 0) {
      // Tiene varias presentaciones registradas: desplegar modal para seleccionar
      setSelectedProductForPresentation(product);
      // Por defecto seleccionar la predeterminada (isDefault === true), o la primera si ninguna lo es
      const defaultPres = product.presentations.find((pr) => pr.isDefault);
      setSelectedPresentationId(defaultPres ? defaultPres.id : product.presentations[0].id);
      setPresentationQty(1);
      setPresentationModalError(null);
      setIsPresentationModalOpen(true);
    } else {
      // Producto sin presentaciones adicionales registradas: agregar directamente
      addToCart(product);
    }
  };

  // Confirmar y agregar la presentación seleccionada desde la ventana modal
  const handleConfirmAddPresentation = () => {
    if (!selectedProductForPresentation) return;

    if (!selectedPresentationId) {
      setPresentationModalError('Debe seleccionar una presentación para agregar al carrito.');
      return;
    }

    const qty = Number(presentationQty);
    if (isNaN(qty) || qty <= 0) {
      setPresentationModalError('La cantidad debe ser mayor a 0.');
      return;
    }

    const pres = selectedProductForPresentation.presentations?.find(
      (p) => p.id === selectedPresentationId
    );
    if (!pres) {
      setPresentationModalError('La presentación seleccionada no es válida.');
      return;
    }

    // Pedir autorización solo si la presentación requiere autorización
    if (pres.requiresAuthorization) {
      const isAuthorizedUser = canAuthorizeOperations(user?.role, user?.permissions);
      if (!isAuthorizedUser) {
        setPresentationModalError(
          `La presentación "${pres.name}" requiere autorización de un usuario supervisor o administrador. Su usuario no posee permisos para autorizarla.`
        );
        return;
      }
    }

    setPresentationModalError(null);
    addPresentationToCart(selectedProductForPresentation, pres, qty);
    setIsPresentationModalOpen(false);
    setSelectedProductForPresentation(null);
  };

  // Abrir modal de supervisor directamente desde el error del modal de presentación
  const handleRequestSupervisorForPresentation = () => {
    if (!selectedProductForPresentation || !selectedPresentationId) return;
    const pres = selectedProductForPresentation.presentations?.find(
      (p) => p.id === selectedPresentationId
    );
    if (!pres) return;

    const qty = Math.max(1, Number(presentationQty) || 1);
    const presPrice =
      pres.basePrice !== null && pres.basePrice !== undefined
        ? pres.basePrice
        : Number((selectedProductForPresentation.priceUSD * (pres.multiplier || 1)).toFixed(4));
    const displayName = `${selectedProductForPresentation.name} (${pres.name})`;

    setPendingStockApproval({
      productId: selectedProductForPresentation.id,
      productName: displayName,
      sku: pres.sku || selectedProductForPresentation.sku,
      availableStock: selectedProductForPresentation.stock ?? 0,
      targetQty: qty,
      deficit: 0,
      action: 'PRESENTATION_AUTH',
      presentationId: pres.id,
      presentationName: pres.name,
      multiplier: pres.multiplier,
      unitPrice: presPrice,
    });
    setSupervisorAuthError(null);
    setSupervisorUsername('');
    setSupervisorPassword('');
    setSupervisorNotes('');
    setIsPresentationModalOpen(false);
    setIsSupervisorModalOpen(true);
  };

  // Aplicar descuento por porcentaje a un ítem del carrito
  const handleApplyItemDiscount = (
    productId: string,
    presentationId: string | null,
    percent: number
  ) => {
    const validPercent = Math.max(0, Math.min(100, isNaN(percent) ? 0 : percent));
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId && (item.presentationId || null) === (presentationId || null)) {
          const grossAmount = Number((item.quantity * item.unitPrice).toFixed(2));
          const discountAmount = Number(((grossAmount * validPercent) / 100).toFixed(2));
          const subtotal = Number((grossAmount - discountAmount).toFixed(2));
          const taxAmount = Number(((subtotal * item.taxRatePercent) / 100).toFixed(2));
          const total = Number((subtotal + taxAmount).toFixed(2));
          return {
            ...item,
            discountPercent: validPercent,
            discountAmount,
            grossAmount,
            subtotal,
            taxAmount,
            total,
          };
        }
        return item;
      })
    );
    setEditingDiscountItem(null);
    toast.success(`Descuento de ${validPercent}% aplicado al producto.`);
  };

  const updateCartQty = (
    productId: string,
    presentationId: string | null | undefined,
    delta: number
  ) => {
    const targetPresId = presentationId || null;
    const existing = cart.find(
      (item) => item.productId === productId && (item.presentationId || null) === targetPresId
    );
    if (!existing) return;

    const targetQty = existing.quantity + delta;
    if (targetQty <= 0) {
      removeFromCart(productId, targetPresId);
      return;
    }

    const product = products.find((p) => p.id === productId);
    const availableStock = product?.stock ?? 0;
    const multiplier = existing.multiplier || 1;

    // Unidades base comprometidas por otros renglones del mismo producto
    const otherCommittedUnits = cart
      .filter((i) => i.productId === productId && (i.presentationId || null) !== targetPresId)
      .reduce((sum, i) => sum + i.quantity * (i.multiplier || 1), 0);

    const totalBaseUnitsRequested = otherCommittedUnits + targetQty * multiplier;

    // Solo se valida stock si se está aumentando la cantidad
    if (delta > 0 && totalBaseUnitsRequested > availableStock) {
      if (!businessRules.allowNegativeStock) {
        toast.error(
          `Existencia insuficiente para "${existing.name}" en almacén (Disponible: ${availableStock} unidades base, Solicitado total: ${totalBaseUnitsRequested}). Las reglas de negocio no permiten ventas con existencia en negativo.`
        );
        return;
      }

      if (businessRules.requireApprovalNegativeStock) {
        setPendingStockApproval({
          productId: existing.productId,
          productName: existing.name,
          sku: existing.sku,
          availableStock,
          targetQty,
          deficit: totalBaseUnitsRequested - availableStock,
          action: 'UPDATE',
          presentationId: targetPresId,
          presentationName: existing.presentationName,
          multiplier,
          unitPrice: existing.unitPrice,
        });
        setSupervisorAuthError(null);
        setSupervisorUsername('');
        setSupervisorPassword('');
        setSupervisorNotes('');
        setIsSupervisorModalOpen(true);
        toast.warning(
          `Modificación a cantidad ${targetQty} de "${existing.name}" dejará existencia en negativo (${availableStock - totalBaseUnitsRequested} unidades). Se requiere autorización de supervisor.`
        );
        return;
      }

      toast.warning(
        `Atención: Cantidad solicitada (${targetQty}) para "${existing.name}" excede la existencia disponible (${availableStock} unidades).`
      );
    }

    if (product) {
      const presObj = product.presentations?.find((pr) => pr.id === targetPresId) || null;
      applyCartItem(product, targetQty, presObj);
    } else {
      setCart((prev) =>
        prev.map((item) => {
          if (item.productId === productId && (item.presentationId || null) === targetPresId) {
            const grossAmount = Number((targetQty * item.unitPrice).toFixed(2));
            const discountAmount = Number(((grossAmount * (item.discountPercent || 0)) / 100).toFixed(2));
            const subtotal = Number((grossAmount - discountAmount).toFixed(2));
            const taxAmount = Number(((subtotal * item.taxRatePercent) / 100).toFixed(2));
            const total = Number((subtotal + taxAmount).toFixed(2));
            return {
              ...item,
              quantity: targetQty,
              grossAmount,
              discountAmount,
              subtotal,
              taxAmount,
              total,
            };
          }
          return item;
        })
      );
    }
  };

  // Confirmar autorización de supervisor para stock negativo o presentaciones restringidas
  const handleConfirmSupervisorApproval = async (selfAuth = false) => {
    if (!pendingStockApproval) return;
    if (!selfAuth && (!supervisorUsername.trim() || !supervisorPassword)) {
      setSupervisorAuthError('Ingrese usuario o correo y contraseña del supervisor');
      return;
    }

    if (!selfAuth && !canAuthorizeOperations(user?.role, user?.permissions)) {
      const inputUser = supervisorUsername.trim().toLowerCase();
      const currentEmail = (user?.email || '').toLowerCase();
      const currentUsername = (user?.username || '').toLowerCase();
      if ((currentEmail && inputUser === currentEmail) || (currentUsername && inputUser === currentUsername)) {
        setSupervisorAuthError(
          'Su usuario actual no posee nivel de administrador o supervisor. Las autorizaciones deben ser emitidas por un usuario administrador o con nivel para autorizar.'
        );
        return;
      }
    }

    setIsAuthorizingSupervisor(true);
    setSupervisorAuthError(null);

    const isPresAuth = pendingStockApproval.action === 'PRESENTATION_AUTH';

    try {
      const res = await fetch('/api/pos/authorize-supervisor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          selfAuthorize: selfAuth,
          usernameOrEmail: selfAuth ? undefined : supervisorUsername.trim(),
          password: selfAuth ? undefined : supervisorPassword,
          reason:
            supervisorNotes.trim() ||
            (isPresAuth
              ? `Autorización de venta para presentación restringida: ${pendingStockApproval.productName}`
              : `Autorización de stock negativo para ${pendingStockApproval.productName}`),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Autorización de supervisor rechazada');
      }

      const approverName = json.data?.approvedByUserName || 'Supervisor';
      const product = products.find((p) => p.id === pendingStockApproval.productId) || {
        id: pendingStockApproval.productId,
        sku: pendingStockApproval.sku,
        name: pendingStockApproval.productName,
        priceUSD: cart.find((i) => i.productId === pendingStockApproval.productId)?.unitPrice || 0,
        taxRatePercent: cart.find((i) => i.productId === pendingStockApproval.productId)?.taxRatePercent || 16,
        stock: pendingStockApproval.availableStock,
      };

      const presObj = pendingStockApproval.presentationId
        ? product.presentations?.find((pr) => pr.id === pendingStockApproval.presentationId) || {
            id: pendingStockApproval.presentationId,
            name: pendingStockApproval.presentationName || '',
            multiplier: pendingStockApproval.multiplier || 1,
            basePrice: pendingStockApproval.unitPrice || 0,
            requiresAuthorization: isPresAuth,
          }
        : null;

      applyCartItem(
        product,
        pendingStockApproval.targetQty,
        presObj,
        !isPresAuth, // isNegativeStockAuthorized
        approverName,
        isPresAuth // isPresentationAuthorized
      );

      toast.success(
        isPresAuth
          ? `Venta de presentación autorizada por ${approverName} para "${pendingStockApproval.productName}"`
          : `Venta con existencia en negativo aprobada por ${approverName} para "${pendingStockApproval.productName}"`
      );
      setIsSupervisorModalOpen(false);
      setPendingStockApproval(null);
    } catch (err: any) {
      setSupervisorAuthError(err.message || 'Error al autorizar operación');
    } finally {
      setIsAuthorizingSupervisor(false);
    }
  };

  const removeFromCart = (productId: string, presentationId?: string | null) => {
    const targetPresId = presentationId || null;
    setCart((prev) =>
      prev.filter(
        (item) => !(item.productId === productId && (item.presentationId || null) === targetPresId)
      )
    );
  };

  // Cálculos de Totales
  const baseExempt = Number(
    cart
      .filter((i) => i.taxRatePercent === 0)
      .reduce((sum, i) => sum + i.subtotal, 0)
      .toFixed(2)
  );
  const baseTaxable = Number(
    cart
      .filter((i) => i.taxRatePercent > 0)
      .reduce((sum, i) => sum + i.subtotal, 0)
      .toFixed(2)
  );
  const taxAmount = Number(
    cart.reduce((sum, i) => sum + i.taxAmount, 0).toFixed(2)
  );
  const discountTotalAmount = Number(
    cart.reduce((sum, i) => sum + (i.discountAmount || 0), 0).toFixed(2)
  );
  const subtotalBeforeIGTF = Number((baseExempt + baseTaxable + taxAmount).toFixed(2));

  // IGTF calculado de los pagos registrados
  const totalIGTFUSD = Number(
    payments.reduce((sum, p) => sum + p.igtfAmountUSD, 0).toFixed(2)
  );
  const finalTotalUSD = Number((subtotalBeforeIGTF + totalIGTFUSD).toFixed(2));
  const finalTotalVES = Number((finalTotalUSD * exchangeRateBCV).toFixed(2));

  // Total pagado acumulado
  const totalPaidUSD = Number(
    payments.reduce((sum, p) => sum + p.amountUSD, 0).toFixed(2)
  );
  // El saldo restante debe ser contra el Total Final exigible (incluyendo IGTF)
  const remainingUSD = Math.max(0, Number((finalTotalUSD - totalPaidUSD).toFixed(2)));
  const remainingVES = Number((remainingUSD * exchangeRateBCV).toFixed(2));

  // Verificar si un medio de pago requiere número de referencia bancaria o lote
  const isMethodRequiringReference = (methodCode: string): boolean => {
    const conf = availablePaymentMethods.find((m) => m.code === methodCode);
    if (conf) {
      return Boolean(conf.requiresReference);
    }
    return ['PAGO_MOVIL', 'DEBIT_CARD', 'CREDIT_CARD', 'TRANSFER', 'ZELLE'].includes(methodCode);
  };

  const getMethodName = (methodCode: string): string => {
    const conf = availablePaymentMethods.find((m) => m.code === methodCode);
    if (conf?.name) return conf.name;
    switch (methodCode) {
      case 'DEBIT_CARD':
        return 'Punto Débito';
      case 'CREDIT_CARD':
        return 'Punto Crédito';
      case 'PAGO_MOVIL':
        return 'Pago Móvil';
      case 'CASH_USD':
        return 'Efectivo $';
      case 'CASH_VES':
        return 'Efectivo Bs';
      case 'TRANSFER':
        return 'Transferencia Bancaria';
      case 'ZELLE':
        return 'Zelle';
      default:
        return methodCode;
    }
  };

  // Cobro rápido con verificación automática de referencia bancaria
  const handleQuickPay = (method: string, amount: number, isAmountInVES = false) => {
    if (amount <= 0.005) return;
    setCurrentMethod(method);

    const requiresRef = isMethodRequiringReference(method);
    const currentRef = paymentRefInput.trim();

    // Si requiere referencia y no se ha especificado, abrir modal prompt de captura
    if (requiresRef && !currentRef) {
      const amtUSD = isAmountInVES ? Number((amount / exchangeRateBCV).toFixed(2)) : amount;
      const amtVES = Number((amtUSD * exchangeRateBCV).toFixed(2));
      setQuickRefPrompt({
        isOpen: true,
        method,
        methodName: getMethodName(method),
        amountUSD: amtUSD,
        amountVES: amtVES,
        isVES: isAmountInVES,
        refValue: '',
      });
      return;
    }

    // Agregar directamente el pago con la referencia ya indicada o sin referencia si no la requiere
    handleAddPayment(method, amount, isAmountInVES, currentRef || undefined);
  };

  // Confirmar la referencia bancaria del modal prompt
  const handleConfirmQuickRef = () => {
    const trimmed = quickRefPrompt.refValue.trim();
    if (!trimmed) {
      toast.error('Por favor ingrese el número de referencia para continuar');
      return;
    }

    if (quickRefPrompt.isEditingPaymentIndex !== undefined) {
      const idx = quickRefPrompt.isEditingPaymentIndex;
      setPayments((prev) =>
        prev.map((p, i) =>
          i === idx ? { ...p, referenceNumber: trimmed } : p
        )
      );
      toast.success('Referencia bancaria actualizada');
    } else {
      handleAddPayment(
        quickRefPrompt.method,
        quickRefPrompt.isVES ? quickRefPrompt.amountVES : quickRefPrompt.amountUSD,
        quickRefPrompt.isVES,
        trimmed
      );
    }

    setQuickRefPrompt({
      isOpen: false,
      method: '',
      methodName: '',
      amountUSD: 0,
      amountVES: 0,
      isVES: false,
      refValue: '',
    });
  };

  // Agregar forma de pago
  const handleAddPayment = (method: string, amount: number, isAmountInVES = false, ref?: string) => {
    let amountUSD = amount;
    if (isAmountInVES) {
      amountUSD = Number((amount / exchangeRateBCV).toFixed(2));
    }
    if (amountUSD <= 0) return;

    const requiresRef = isMethodRequiringReference(method);
    const trimmedRef = ref?.trim();
    if (requiresRef && !trimmedRef) {
      const amtVES = Number((amountUSD * exchangeRateBCV).toFixed(2));
      setQuickRefPrompt({
        isOpen: true,
        method,
        methodName: getMethodName(method),
        amountUSD,
        amountVES: amtVES,
        isVES: isAmountInVES,
        refValue: '',
      });
      return;
    }

    // Si ya se cubrió el valor de la mercancía (subtotal previo a IGTF), los pagos subsiguientes
    // corresponden a la liquidación del IGTF. Por principio de no doble tributación (COT Art. 3),
    // no se aplica IGTF sobre el pago del propio impuesto IGTF.
    const isPayingOnlyIGTF = totalPaidUSD >= subtotalBeforeIGTF && totalIGTFUSD > 0;
    const methodConfig = availablePaymentMethods.find((m) => m.code === method);
    const appliesIGTF = !isPayingOnlyIGTF && (methodConfig ? methodConfig.appliesIGTF : (method === 'CASH_USD' || method === 'ZELLE'));
    const igtfAmountUSD = appliesIGTF ? Number((amountUSD * 0.03).toFixed(2)) : 0;
    const amountVES = Number((amountUSD * exchangeRateBCV).toFixed(2));
    const igtfAmountVES = Number((igtfAmountUSD * exchangeRateBCV).toFixed(2));

    const newPayment: PaymentEntry = {
      method,
      methodName: methodConfig?.name || getMethodName(method),
      amountUSD,
      amountVES,
      exchangeRate: exchangeRateBCV,
      referenceNumber: trimmedRef || (null as any),
      appliesIGTF,
      igtfAmountUSD,
      igtfAmountVES,
    };

    setPayments((prev) => [...prev, newPayment]);
    setPaymentAmountInput('');
    setPaymentRefInput('');
  };

  const removePayment = (index: number) => {
    setPayments((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Procesar Venta Fiscal
  const handleProcessSale = async () => {
    if (cart.length === 0) {
      toast.error('El carrito de compras está vacío');
      return;
    }
    if (remainingUSD > 0.01) {
      toast.error(`Falta pagar ${formatMoneyUSD(remainingUSD)} para completar el total`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        branchId: activeBranchId || 'b1111111-1111-1111-1111-111111111111',
        warehouseId: activeShift?.warehouseId || activeWarehouseId || 'w1111111-1111-1111-1111-111111111111',
        customerId: selectedCustomerId || undefined,
        customerDocType,
        customerDocNumber: customerDocNumber.trim(),
        customerName: customerName.trim(),
        customerAddress: customerAddress.trim() || 'Caracas, Venezuela',
        invoiceMode: isFiscal ? 'fiscal_printer' : 'normal_printer',
        currency: 'USD',
        exchangeRate: exchangeRateBCV,
        items: cart.map((item) => ({
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent || 0,
          taxRatePercent: item.taxRatePercent,
          subtotal: item.subtotal,
          taxAmount: item.taxAmount,
          total: item.total,
          presentationId: item.presentationId || null,
          multiplier: item.multiplier || 1,
          isNegativeStockAuthorized: Boolean(item.isNegativeStockAuthorized),
          isPresentationAuthorized: Boolean(item.isPresentationAuthorized),
          supervisorApprovedBy: item.supervisorApprovedBy || null,
        })),
        payments: payments.map((p) => ({
          method: p.method,
          amountVES: p.amountVES,
          amountUSD: p.amountUSD,
          exchangeRate: p.exchangeRate,
          referenceNumber: p.referenceNumber || null,
          appliesIGTF: p.appliesIGTF,
          igtfAmountVES: p.igtfAmountVES,
          igtfAmountUSD: p.igtfAmountUSD,
        })),
        baseExemptAmount: baseExempt,
        baseTaxableAmount: baseTaxable,
        taxAmount,
        igtfTotalAmount: totalIGTFUSD,
        discountTotalAmount,
        finalTotalAmount: finalTotalUSD,
      };

      const res = await fetch('/api/pos/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al procesar la venta');
      }

      if (isFiscal) {
        toast.success('¡Factura fiscal emitida y registrada en memoria fiscal!');
      } else {
        toast.success('¡Venta registrada exitosamente!');
      }

      // Preparar datos para el ticket impreso
      setInvoiceTicketData({
        invoiceId: json.data.invoiceId,
        invoiceNumber: json.data.invoiceNumber || 'FACT-00010452',
        controlNumber: json.data.controlNumber || '00-0010452',
        invoiceDate: new Date().toISOString(),
        cashierName: activeShift?.cashierName || user?.fullName || 'Cajero',
        customerName,
        customerRif: `${customerDocType}-${customerDocNumber}`,
        customerAddress: customerAddress || 'Caracas, Venezuela',
        items: cart.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          taxRate: i.taxRatePercent,
          total: i.total,
        })),
        baseExempt,
        baseTaxable,
        taxAmount,
        igtfAmount: totalIGTFUSD,
        totalUSD: finalTotalUSD,
        totalVES: finalTotalVES,
        exchangeRate: exchangeRateBCV,
        payments: payments.map((p) => ({
          method: p.method,
          amountUSD: p.amountUSD,
          amountVES: p.amountVES,
        })),
      });

      // Limpiar carrito y cerrar modal de pago
      setCart([]);
      setPayments([]);
      setIsPaymentModalOpen(false);

      // Si es fiscal, abrir directamente el comprobante fiscal; si no, preguntar si desea imprimir ticket
      if (isFiscal) {
        setIsInvoiceModalOpen(true);
      } else {
        setShowPrintPromptModal(true);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar venta');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingShift) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] p-6 space-y-4">
        <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center animate-pulse">
          <Loader2 className="w-5 h-5 text-neutral-400 animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-neutral-700">Verificando turno de caja...</p>
          <p className="text-xs text-neutral-400">Consultando estado de caja en la sucursal actual</p>
        </div>
      </div>
    );
  }

  if (!activeShift) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] p-4 sm:p-6">
        <div className="max-w-md w-full bg-white border border-neutral-200 rounded-lg p-6 sm:p-8 text-center space-y-5 shadow-xs">
          <div className="w-12 h-12 mx-auto rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
            <Lock className="w-5 h-5 text-amber-700" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-neutral-900">
              Turno de Caja Requerido
            </h2>
            <p className="text-xs text-neutral-500 leading-relaxed">
              No tienes un turno de caja abierto en esta sucursal. Para registrar ventas, cobrar productos y emitir comprobantes en el Punto de Venta, es necesario realizar la apertura de turno.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <Button
              type="button"
              onClick={() => {
                fetchRegistersForShift();
                setShowOpenShiftModal(true);
              }}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold cursor-pointer"
            >
              <Unlock className="w-4 h-4 mr-1.5" />
              Abrir Turno de Caja
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/pos/cierre')}
              className="w-full sm:w-auto px-4 py-2.5 text-xs text-neutral-700 cursor-pointer"
            >
              Gestión de Cajas
            </Button>
          </div>
        </div>

        {/* Modal: Apertura de Turno de Caja */}
        {showOpenShiftModal && (
          <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-neutral-200 my-auto">
              {/* Header */}
              <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-2">
                  <Unlock className="w-5 h-5 text-sky-600" />
                  <h3 className="text-sm font-bold text-neutral-900">Apertura de Turno de Caja</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOpenShiftModal(false)}
                  className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 cursor-pointer"
                  title="Cerrar modal (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleOpenShiftSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Caja Registradora *
                    </label>
                    {loadingRegisters ? (
                      <div className="h-9 px-3 border border-neutral-200 rounded-lg bg-neutral-50 flex items-center text-xs text-neutral-400">
                        Cargando cajas disponibles...
                      </div>
                    ) : (
                      <select
                        value={openRegisterId}
                        onChange={(e) => setOpenRegisterId(e.target.value)}
                        className="w-full h-9 px-3 border border-neutral-300 rounded-lg text-xs bg-white"
                        required
                      >
                        <option value="">Seleccione una caja...</option>
                        {availableRegisters.map((r) => {
                          const isRegFiscal =
                            r.invoiceMode === 'fiscal_printer' ||
                            Boolean(r.fiscalPrinterSerial && r.fiscalPrinterSerial.trim());
                          return (
                            <option key={r.id} value={r.id} disabled={r.hasActiveShift}>
                              {r.code} - {r.name} ({isRegFiscal ? 'Fiscal' : 'No Fiscal'}) [Almacén: {r.warehouseName || 'Principal'}] {r.hasActiveShift ? `(Ocupada por ${r.activeCashierName || 'otro cajero'})` : '(Disponible)'}
                            </option>
                          );
                        })}
                      </select>
                    )}
                    {openRegisterId && (
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Almacén de descarga de stock: <strong>{availableRegisters.find((r) => r.id === openRegisterId)?.warehouseName || 'Almacén Principal'}</strong>
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">
                        Fondo Inicial USD ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={openInitialUSD}
                        onChange={(e) => setOpenInitialUSD(e.target.value)}
                        className="w-full h-9 px-3 border border-neutral-300 rounded-lg text-xs font-mono"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">
                        Fondo Inicial VES (Bs)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={openInitialVES}
                        onChange={(e) => setOpenInitialVES(e.target.value)}
                        className="w-full h-9 px-3 border border-neutral-300 rounded-lg text-xs font-mono"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Observaciones / Notas
                    </label>
                    <input
                      type="text"
                      value={openNotes}
                      onChange={(e) => setOpenNotes(e.target.value)}
                      className="w-full h-9 px-3 border border-neutral-300 rounded-lg text-xs"
                      placeholder="Ej: Turno de la mañana, cambio inicial en caja"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowOpenShiftModal(false)}
                    disabled={isOpeningShift}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isOpeningShift || !openRegisterId}
                  >
                    {isOpeningShift ? 'Abriendo Turno...' : 'Abrir Turno'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
      {/* Columna Izquierda: Catálogo y Búsqueda */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Banner de Caja Activa y Modalidad Fiscal */}
        {activeShift && (
          <div className="bg-white border border-neutral-200 rounded-lg p-2.5 flex items-center justify-between text-xs shadow-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-neutral-900">
                {activeShift.cashRegisterCode || 'CAJA-01'}
              </span>
              <span className="text-neutral-300">•</span>
              <span className="text-neutral-600 font-medium">
                {activeShift.cashRegisterName || 'Punto de Venta'}
              </span>
              <span className="text-neutral-300">•</span>
              <span className="text-neutral-500">
                Cajero: <strong className="text-neutral-700">{activeShift.cashierName || user?.fullName}</strong>
              </span>
              <span className="text-neutral-300">•</span>
              <span className="text-neutral-500 flex items-center gap-1 font-medium">
                <Warehouse className="w-3.5 h-3.5 text-neutral-400" />
                Almacén: <strong className="text-neutral-700">{activeShift.warehouseName || 'Almacén Principal'}</strong>
              </span>
            </div>
            <div>
              {isFiscal ? (
                <Badge variant="success" className="font-mono text-[10px] flex items-center gap-1">
                  <Printer className="w-3 h-3" />
                  Impresora Fiscal {activeShift.fiscalPrinterSerial ? `[${activeShift.fiscalPrinterSerial}]` : 'Conectada'}
                </Badge>
              ) : (
                <Badge variant="neutral" className="text-[10px] flex items-center gap-1">
                  <Printer className="w-3 h-3" />
                  Modo No Fiscal (Ticket Estándar)
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Barra de Búsqueda Rápida / Código de Barras */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleBarcodeOrSkuScan(searchTerm);
              }
            }}
            placeholder="Escanear código de barras o buscar producto/presentación (Enter para añadir)..."
            className="w-full h-11 pl-10 pr-10 text-xs bg-white border border-neutral-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
          />
          <Barcode className="w-5 h-5 absolute right-3 top-3 text-neutral-400" />
        </div>

        {/* Contenedor del Catálogo: Toolbar + Grid o Lista Densa */}
        <div className="flex-1 bg-white border border-neutral-200 rounded-lg p-3 sm:p-4 overflow-hidden flex flex-col shadow-sm">
          {/* Toolbar del Catálogo */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-neutral-200 shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                Catálogo de Productos ({filteredProducts.length})
              </h2>
              <span className="text-[11px] text-neutral-400 font-mono hidden sm:inline">
                • Tasa BCV: Bs. {formatExchangeRate(exchangeRateBCV, 2)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Selector de Modo de Vista: Cuadrícula Compacta vs Lista Densa */}
              <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setCatalogViewMode('grid')}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    catalogViewMode === 'grid'
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                  title="Vista Cuadrícula Compacta"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    catalogViewMode === 'list'
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                  title="Vista Lista / Tabla Densa"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Botón y Dropdown de Opciones de Visualización de Información */}
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOptionsDropdownOpen((prev) => !prev)}
                  className="h-8 px-2 text-xs text-neutral-700 border-neutral-300 hover:bg-neutral-50"
                  title="Configurar información visible del producto"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1 text-neutral-500" />
                  <span>Columnas e Info</span>
                </Button>

                {isOptionsDropdownOpen && (
                  <div className="absolute right-0 top-9 z-30 w-56 bg-white border border-neutral-200 rounded-lg shadow-lg p-2.5 text-xs space-y-2">
                    <div className="font-semibold text-neutral-800 pb-1 border-b border-neutral-100 flex items-center justify-between">
                      <span>Mostrar en Producto:</span>
                      <button
                        type="button"
                        onClick={() => setIsOptionsDropdownOpen(false)}
                        className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-neutral-700 hover:text-neutral-900">
                      <input
                        type="checkbox"
                        checked={catalogOptions.showSku}
                        onChange={(e) =>
                          setCatalogOptions((o) => ({ ...o, showSku: e.target.checked }))
                        }
                        className="rounded border-neutral-300 text-sky-600 focus:ring-sky-500 h-3.5 w-3.5"
                      />
                      <span>Código de Producto (SKU)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-neutral-700 hover:text-neutral-900">
                      <input
                        type="checkbox"
                        checked={catalogOptions.showBarcode}
                        onChange={(e) =>
                          setCatalogOptions((o) => ({ ...o, showBarcode: e.target.checked }))
                        }
                        className="rounded border-neutral-300 text-sky-600 focus:ring-sky-500 h-3.5 w-3.5"
                      />
                      <span>Código de Barras</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-neutral-700 hover:text-neutral-900">
                      <input
                        type="checkbox"
                        checked={catalogOptions.showPrice}
                        onChange={(e) =>
                          setCatalogOptions((o) => ({ ...o, showPrice: e.target.checked }))
                        }
                        className="rounded border-neutral-300 text-sky-600 focus:ring-sky-500 h-3.5 w-3.5"
                      />
                      <span>Precio (USD / Bs.)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-neutral-700 hover:text-neutral-900">
                      <input
                        type="checkbox"
                        checked={catalogOptions.showStock}
                        onChange={(e) =>
                          setCatalogOptions((o) => ({ ...o, showStock: e.target.checked }))
                        }
                        className="rounded border-neutral-300 text-sky-600 focus:ring-sky-500 h-3.5 w-3.5"
                      />
                      <span>Stock Actual</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-neutral-700 hover:text-neutral-900">
                      <input
                        type="checkbox"
                        checked={catalogOptions.showDescription}
                        onChange={(e) =>
                          setCatalogOptions((o) => ({ ...o, showDescription: e.target.checked }))
                        }
                        className="rounded border-neutral-300 text-sky-600 focus:ring-sky-500 h-3.5 w-3.5"
                      />
                      <span>Descripción del Producto</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Área de Visualización: Grid Compacto o Lista Densa */}
          <div className="flex-1 overflow-y-auto pt-3">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-neutral-400 py-12">
                <Search className="w-8 h-8 mb-2 stroke-1 text-neutral-300" />
                <p className="text-xs">No se encontraron productos coincidentes</p>
              </div>
            ) : catalogViewMode === 'grid' ? (
              /* Cuadrícula Compacta */
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
                {filteredProducts.map((p) => {
                  const priceVES = p.priceUSD * exchangeRateBCV;
                  const hasNoStock = (p.stock ?? 0) <= 0;
                  const hasPresentations = Boolean(p.presentations && p.presentations.length > 0);

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className="flex flex-col text-left p-2.5 rounded-lg border border-neutral-200 hover:border-sky-500 hover:bg-sky-50/20 transition-all cursor-pointer group bg-white shadow-xs"
                    >
                      {/* Cabecera de la tarjeta: SKU, Barra, Stock */}
                      <div className="flex items-center justify-between w-full text-[10px] gap-1">
                        <div className="flex items-center gap-1.5 truncate">
                          {catalogOptions.showSku && (
                            <span className="font-mono text-neutral-400 group-hover:text-sky-600 truncate">
                              {p.sku}
                            </span>
                          )}
                          {catalogOptions.showBarcode && p.barcode && (
                            <span className="font-mono text-neutral-400 truncate flex items-center gap-0.5" title={`Código de barras: ${p.barcode}`}>
                              <Barcode className="w-3 h-3 shrink-0" />
                              <span className="truncate">{p.barcode}</span>
                            </span>
                          )}
                        </div>

                        {catalogOptions.showStock && (
                          hasNoStock ? (
                            <span className="shrink-0 text-[9px] font-semibold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                              Sin stock ({p.stock ?? 0})
                            </span>
                          ) : (
                            <span className="shrink-0 text-[9px] font-mono text-neutral-500 bg-neutral-100 px-1 py-0.2 rounded">
                              Stock: {p.stock}
                            </span>
                          )
                        )}
                      </div>

                      {/* Nombre del producto */}
                      <span className="text-xs font-semibold text-neutral-800 mt-1 line-clamp-2 leading-tight">
                        {p.name}
                      </span>

                      {/* Descripción opcional */}
                      {catalogOptions.showDescription && p.description && (
                        <p className="text-[10px] text-neutral-500 line-clamp-1 mt-0.5 italic">
                          {p.description}
                        </p>
                      )}

                      {/* Precio y Presentaciones */}
                      <div className="mt-auto pt-2 flex items-baseline justify-between gap-1 border-t border-neutral-100/70">
                        {catalogOptions.showPrice ? (
                          <div>
                            <div className="text-xs font-bold text-neutral-900">
                              {formatMoneyUSD(p.priceUSD)}
                            </div>
                            <div className="text-[9px] font-mono text-neutral-400">
                              {formatMoneyVES(priceVES)}
                            </div>
                          </div>
                        ) : (
                          <div></div>
                        )}

                        <Badge variant={p.taxRatePercent === 0 ? 'neutral' : 'info'} className="text-[9px] py-0 px-1">
                          {p.taxRatePercent === 0 ? 'Exento' : `IVA ${p.taxRatePercent}%`}
                        </Badge>
                      </div>

                      {/* Indicador de Presentaciones */}
                      {hasPresentations && (
                        <div className="mt-1.5 pt-1 border-t border-neutral-100 flex items-center justify-between text-[10px] text-sky-700 bg-sky-50/60 px-1.5 py-0.5 rounded">
                          <span className="flex items-center gap-1 font-medium">
                            <Package className="w-3 h-3 text-sky-600" />
                            {p.presentations!.length} {p.presentations!.length === 1 ? 'presentación' : 'presentaciones'}
                          </span>
                          <span className="text-[9px] font-bold text-sky-800">Elegir</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Lista / Tabla Densa de Alta Capacidad */
              <div className="border border-neutral-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-neutral-100 text-neutral-600 font-semibold uppercase text-[10px] tracking-wider sticky top-0 border-b border-neutral-200 z-10">
                    <tr>
                      {catalogOptions.showSku && <th className="py-2 px-2.5">Código (SKU)</th>}
                      {catalogOptions.showBarcode && <th className="py-2 px-2.5">Código de Barras</th>}
                      <th className="py-2 px-2.5">Producto</th>
                      {catalogOptions.showStock && <th className="py-2 px-2 text-center">Stock</th>}
                      {catalogOptions.showPrice && <th className="py-2 px-2.5 text-right">Precio ($)</th>}
                      {catalogOptions.showPrice && <th className="py-2 px-2.5 text-right">Precio (Bs.)</th>}
                      <th className="py-2 px-2 text-center">Presentaciones</th>
                      <th className="py-2 px-2 text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredProducts.map((p) => {
                      const priceVES = p.priceUSD * exchangeRateBCV;
                      const hasNoStock = (p.stock ?? 0) <= 0;
                      const hasPresentations = Boolean(p.presentations && p.presentations.length > 0);

                      return (
                        <tr
                          key={p.id}
                          onClick={() => handleSelectProduct(p)}
                          className="hover:bg-sky-50/40 transition-colors cursor-pointer group"
                        >
                          {catalogOptions.showSku && (
                            <td className="py-1.5 px-2.5 font-mono text-[11px] text-neutral-600 group-hover:text-sky-700 whitespace-nowrap">
                              {p.sku}
                            </td>
                          )}

                          {catalogOptions.showBarcode && (
                            <td className="py-1.5 px-2.5 font-mono text-[11px] text-neutral-500 whitespace-nowrap">
                              {p.barcode || '—'}
                            </td>
                          )}

                          <td className="py-1.5 px-2.5">
                            <div className="font-semibold text-neutral-800 text-xs">
                              {p.name}
                            </div>
                            {catalogOptions.showDescription && p.description && (
                              <div className="text-[10px] text-neutral-400 line-clamp-1 italic">
                                {p.description}
                              </div>
                            )}
                          </td>

                          {catalogOptions.showStock && (
                            <td className="py-1.5 px-2 text-center font-mono text-xs whitespace-nowrap">
                              {hasNoStock ? (
                                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                                  {p.stock ?? 0}
                                </span>
                              ) : (
                                <span className="text-neutral-700">{p.stock}</span>
                              )}
                            </td>
                          )}

                          {catalogOptions.showPrice && (
                            <td className="py-1.5 px-2.5 text-right font-mono font-bold text-neutral-900 text-xs whitespace-nowrap">
                              {formatMoneyUSD(p.priceUSD)}
                            </td>
                          )}

                          {catalogOptions.showPrice && (
                            <td className="py-1.5 px-2.5 text-right font-mono text-neutral-500 text-[11px] whitespace-nowrap">
                              {formatMoneyVES(priceVES)}
                            </td>
                          )}

                          <td className="py-1.5 px-2 text-center whitespace-nowrap">
                            {hasPresentations ? (
                              <span className="text-[10px] font-medium bg-sky-50 text-sky-800 px-1.5 py-0.5 rounded border border-sky-200">
                                {p.presentations!.length} pres.
                              </span>
                            ) : (
                              <span className="text-neutral-400 text-[10px]">—</span>
                            )}
                          </td>

                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectProduct(p);
                              }}
                              className="px-2 py-0.5 text-[11px] font-medium bg-sky-600 hover:bg-sky-700 text-white rounded transition-colors cursor-pointer"
                            >
                              + Añadir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Columna Derecha: Detalle de Venta / Carrito de Alta Densidad */}
      <div className="w-full lg:w-[460px] xl:w-[480px] flex flex-col bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden shrink-0">
        {/* Encabezado */}
        <div className="p-3.5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-neutral-700" />
            <h2 className="text-sm font-bold text-neutral-900">Detalle de la Venta</h2>
          </div>
          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setIsCartReviewModalOpen(true)}
                className="h-7 text-[11px] px-2 text-sky-700 border-sky-300 hover:bg-sky-50"
                title="Abrir modal de verificación detallada del carrito"
              >
                <ListChecks className="w-3.5 h-3.5 mr-1" />
                Verificar ({cart.reduce((s, i) => s + i.quantity, 0)})
              </Button>
            )}
            {activeShift && (
              <span className="text-[11px] font-mono bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-semibold">
                {activeShift.cashRegisterCode}
              </span>
            )}
          </div>
        </div>

        {/* Sección de Cliente */}
        <div className="p-2.5 border-b border-neutral-100 bg-neutral-50/50 space-y-2">
          {/* Si hay un cliente específico asociado */}
          {selectedCustomerId ? (
            <div className="flex items-center justify-between p-2 bg-sky-50/60 border border-sky-200 rounded-lg text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <UserCheck className="w-4 h-4 text-sky-600 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-neutral-900 truncate flex items-center gap-1.5">
                    <span>{customerName}</span>
                    {isSpecialTaxpayer && (
                      <Badge variant="info">Esp.</Badge>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-neutral-500">
                    {customerDocType}-{customerDocNumber} {customerPhone ? `• ${customerPhone}` : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetToConsumerFinal}
                title="Cambiar a Consumidor Final"
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded hover:bg-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 relative">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={customerSearchQuery}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="Buscar cliente (Cédula, RIF, Nombre)..."
                    className="w-full h-8 pl-8 pr-7 text-xs border border-neutral-300 rounded-lg bg-white"
                  />
                  {isSearchingCustomer && (
                    <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 animate-spin" />
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setShowCustomerDropdown(false);
                    setIsNewCustomerModalOpen(true);
                  }}
                  className="h-8 px-2 text-xs text-sky-700 border-sky-300 hover:bg-sky-50 whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1" />
                  + Nuevo
                </Button>

                {/* Dropdown de Autocompletado */}
                {showCustomerDropdown && customerSearchQuery.trim() && (
                  <div className="absolute top-9 left-0 right-16 z-30 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-neutral-100 text-xs">
                    {customerSearchResults.length === 0 ? (
                      <div className="p-3 text-center text-neutral-400">
                        {isSearchingCustomer ? (
                          'Buscando clientes...'
                        ) : (
                          <div>
                            <p>No se encontraron clientes.</p>
                            <button
                              type="button"
                              onClick={() => {
                                setNewCustomerName(customerSearchQuery);
                                setNewCustomerDocNumber('');
                                setShowCustomerDropdown(false);
                                setIsNewCustomerModalOpen(true);
                              }}
                              className="text-sky-600 font-semibold hover:underline mt-1 block w-full text-center cursor-pointer"
                            >
                              + Registrar nuevo cliente
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      customerSearchResults.map((cust) => {
                        const isBlocked = Boolean(cust.isBlocked || cust.is_blocked || cust.status === 'BLOCKED');
                        const blockReason = cust.blockReason || cust.block_reason;

                        return (
                          <button
                            key={cust.id}
                            type="button"
                            onClick={() => {
                              if (isBlocked) {
                                toast.error(
                                  `El cliente "${cust.name}" está BLOQUEADO. Motivo: ${blockReason || 'Consulte con administración'}. No puede ser seleccionado.`
                                );
                                return;
                              }
                              handleSelectCustomer(cust);
                            }}
                            className={`w-full text-left p-2.5 flex flex-col transition-colors border-b border-neutral-100 last:border-b-0 ${
                              isBlocked
                                ? 'bg-red-50/60 hover:bg-red-50/80 cursor-not-allowed opacity-90'
                                : 'hover:bg-sky-50/50 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`font-semibold ${isBlocked ? 'text-red-950' : 'text-neutral-800'}`}>
                                {cust.name}
                              </span>
                              {isBlocked && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 shrink-0">
                                  Bloqueado
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-neutral-500 mt-0.5">
                              {cust.docType}-{cust.docNumber} {cust.phone ? `• ${cust.phone}` : ''}
                            </span>
                            {isBlocked && blockReason && (
                              <span className="text-[11px] text-red-600 font-medium mt-0.5">
                                Motivo: {blockReason}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Campos de edición rápida de Consumidor Final */}
              <div className="flex gap-1.5 items-center">
                <select
                  value={customerDocType}
                  onChange={(e) => setCustomerDocType(e.target.value as any)}
                  className="w-14 h-7 px-1 text-[11px] border border-neutral-300 rounded-lg bg-white"
                >
                  <option value="V">V-</option>
                  <option value="E">E-</option>
                  <option value="J">J-</option>
                  <option value="G">G-</option>
                  <option value="P">P-</option>
                </select>
                <input
                  type="text"
                  value={customerDocNumber}
                  onChange={(e) => setCustomerDocNumber(e.target.value)}
                  placeholder="Doc / RIF"
                  className="w-24 h-7 px-2 text-[11px] border border-neutral-300 rounded-lg font-mono"
                />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nombre cliente"
                  className="flex-1 h-7 px-2 text-[11px] border border-neutral-300 rounded-lg"
                />
              </div>
            </div>
          )}
        </div>

        {/* Tabla de Items del Carrito de Alta Densidad */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-400 py-12">
              <ShoppingCart className="w-8 h-8 mb-2 stroke-1 text-neutral-300" />
              <p className="text-xs">El carrito está vacío</p>
              <p className="text-[10px] text-neutral-400 mt-0.5">Seleccione productos del catálogo para agregarlos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-100 text-neutral-600 font-semibold uppercase text-[10px] tracking-wider sticky top-0 border-b border-neutral-200 z-10">
                  <tr>
                    <th className="py-2 px-2">Descripción</th>
                    <th className="py-2 px-1 text-right">Precio</th>
                    <th className="py-2 px-1 text-center">Cant.</th>
                    <th className="py-2 px-1 text-right">Monto</th>
                    <th className="py-2 px-1 text-center">Desc.</th>
                    <th className="py-2 px-1 text-right">Total</th>
                    <th className="py-2 px-1 text-center w-7"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {cart.map((item) => {
                    const prod = products.find((p) => p.id === item.productId);
                    const availableStock = prod?.stock ?? 0;
                    const totalCommittedUnits = cart
                      .filter((i) => i.productId === item.productId)
                      .reduce((s, i) => s + i.quantity * (i.multiplier || 1), 0);
                    const isNegative = totalCommittedUnits > availableStock;
                    const itemKey = `${item.productId}-${item.presentationId || 'base'}`;
                    const grossAmount = item.grossAmount || Number((item.quantity * item.unitPrice).toFixed(2));
                    const hasDiscount = (item.discountPercent || 0) > 0;

                    return (
                      <tr key={itemKey} className="hover:bg-neutral-50/80 transition-colors">
                        {/* Descripción */}
                        <td className="py-1.5 px-2 max-w-[125px]">
                          <div className="font-semibold text-neutral-800 text-[11px] truncate" title={item.name}>
                            {item.name}
                          </div>
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            {item.presentationName && (
                              <span className="text-[9px] font-medium bg-emerald-50 text-emerald-700 px-1 py-0.2 rounded border border-emerald-200">
                                x{item.multiplier || 1} {item.presentationName}
                              </span>
                            )}
                            {isNegative && (
                              <span className="text-[9px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                                Neg ({availableStock - totalCommittedUnits})
                              </span>
                            )}
                            {item.requiresAuthorization && (
                              item.isPresentationAuthorized ? (
                                <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 flex items-center gap-0.5">
                                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                                  Aut.
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                                  Req. Aut.
                                </span>
                              )
                            )}
                          </div>
                        </td>

                        {/* Precio */}
                        <td className="py-1.5 px-1 text-right font-mono text-[11px] text-neutral-600 whitespace-nowrap">
                          {formatMoneyUSD(item.unitPrice)}
                        </td>

                        {/* Cantidad (- / +) */}
                        <td className="py-1.5 px-1 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.productId, item.presentationId, -1)}
                              className="w-5 h-5 rounded bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700 cursor-pointer"
                              title="Disminuir cantidad"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="text-[11px] font-bold w-5 text-center font-mono">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.productId, item.presentationId, 1)}
                              className="w-5 h-5 rounded bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700 cursor-pointer"
                              title="Aumentar cantidad"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </td>

                        {/* Monto Bruto */}
                        <td className="py-1.5 px-1 text-right font-mono text-[11px] text-neutral-700 whitespace-nowrap">
                          {formatMoneyUSD(grossAmount)}
                        </td>

                        {/* Descuento si existe */}
                        <td className="py-1.5 px-1 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDiscountItem({
                                productId: item.productId,
                                presentationId: item.presentationId || null,
                                productName: item.name,
                                currentDiscountPercent: item.discountPercent || 0,
                              });
                              setDiscountInputPercent(String(item.discountPercent || 0));
                            }}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium border cursor-pointer transition-colors ${
                              hasDiscount
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-neutral-50 text-neutral-400 border-neutral-200 hover:text-sky-600 hover:border-sky-300'
                            }`}
                            title="Modificar descuento para este producto"
                          >
                            {hasDiscount ? `-${item.discountPercent}%` : '0%'}
                          </button>
                        </td>

                        {/* Total del producto */}
                        <td className="py-1.5 px-1 text-right font-mono font-bold text-[11px] text-neutral-900 whitespace-nowrap">
                          {formatMoneyUSD(item.total)}
                        </td>

                        {/* Eliminar */}
                        <td className="py-1.5 px-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.productId, item.presentationId)}
                            className="text-neutral-300 hover:text-red-500 p-0.5 rounded cursor-pointer transition-colors"
                            title="Eliminar producto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Resumen Fiscal */}
        <div className="p-3 border-t border-neutral-200 bg-neutral-50 space-y-1.5 text-xs">
          {discountTotalAmount > 0 && (
            <div className="flex justify-between text-emerald-700 font-medium">
              <span>Descuento Aplicado:</span>
              <span className="font-mono">-{formatMoneyUSD(discountTotalAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-neutral-600">
            <span>Base Exenta:</span>
            <span className="font-mono">{formatMoneyUSD(baseExempt)}</span>
          </div>
          <div className="flex justify-between text-neutral-600">
            <span>Base Imponible (16%):</span>
            <span className="font-mono">{formatMoneyUSD(baseTaxable)}</span>
          </div>
          <div className="flex justify-between text-neutral-600">
            <span>IVA (16%):</span>
            <span className="font-mono">{formatMoneyUSD(taxAmount)}</span>
          </div>

          <div className="border-t border-neutral-300 pt-2 flex items-baseline justify-between">
            <span className="text-sm font-bold text-neutral-900">Total a Pagar:</span>
            <div className="text-right">
              <div className="text-xl font-bold font-mono text-sky-700">{formatMoneyUSD(subtotalBeforeIGTF)}</div>
              <div className="text-xs font-mono text-neutral-500">
                {formatMoneyVES(subtotalBeforeIGTF * exchangeRateBCV)}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={cart.length === 0}
              onClick={() => setIsCartReviewModalOpen(true)}
              className="flex-1 h-8 text-xs text-neutral-700"
            >
              <ListChecks className="w-3.5 h-3.5 mr-1 text-sky-600" />
              Verificar Carrito ({cart.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={cart.length === 0}
              onClick={async () => {
                const confirmed = await showClearCartAlert();
                if (confirmed) setCart([]);
              }}
              className="h-8 px-2 text-neutral-400 hover:text-red-600"
              title="Vaciar Carrito"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>

          <Button
            className="w-full mt-2 h-11 text-xs font-bold shadow-md"
            disabled={cart.length === 0}
            onClick={() => {
              setPayments([]);
              setIsPaymentModalOpen(true);
            }}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Cobrar & Emitir Factura Fiscal
          </Button>
        </div>
      </div>

      {/* Modal de Pago Multi-Moneda y Mixto */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-xl w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-neutral-200 my-auto">
            {/* Header (Fijo / Pinned) */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-sky-600" />
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Cobro Multi-Moneda & Facturación Fiscal</h3>
                  <p className="text-[11px] text-neutral-500">
                    Tasa Oficial BCV: Bs. {formatExchangeRate(exchangeRateBCV, 2)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 cursor-pointer p-1 rounded-lg hover:bg-neutral-100"
                  title="Cerrar modal (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body (Scrollable con overflow-y-auto) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Totalizador & Pendiente */}
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-neutral-500 block">Total a Pagar:</span>
                  <span className="text-base font-bold font-mono text-neutral-900">
                    {formatMoneyUSD(finalTotalUSD)}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-mono block">
                    {formatMoneyVES(finalTotalVES)}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Restante por Pagar:</span>
                  <span className={`text-base font-bold font-mono ${remainingUSD <= 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatMoneyUSD(remainingUSD)}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-mono block">
                    {formatMoneyVES(remainingVES)}
                  </span>
                </div>
              </div>

              {/* Banner de Liquidación de Diferencia por IGTF (Permite cancelar diferencia con 1-click) */}
              {totalIGTFUSD > 0 && remainingUSD > 0.005 && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs space-y-2">
                  <div className="flex items-center justify-between font-semibold text-indigo-950">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                      Diferencia IGTF (3%) por cancelar:
                    </span>
                    <span className="font-mono text-indigo-800 font-extrabold text-sm">
                      {formatMoneyUSD(remainingUSD)} <span className="text-[11px] font-normal text-indigo-600">({formatMoneyVES(remainingVES)})</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-800 leading-tight">
                    Seleccione el método de pago para liquidar la diferencia remanente:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-0.5">
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => handleQuickPay('DEBIT_CARD', remainingUSD, false)}
                      className="text-[11px] h-8 px-2 border-indigo-300 text-indigo-900 bg-white hover:bg-indigo-100 justify-start"
                    >
                      Punto Débito ({formatMoneyVES(remainingVES)})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => handleQuickPay('CREDIT_CARD', remainingUSD, false)}
                      className="text-[11px] h-8 px-2 border-indigo-300 text-indigo-900 bg-white hover:bg-indigo-100 justify-start"
                    >
                      Punto Crédito ({formatMoneyVES(remainingVES)})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => handleQuickPay('PAGO_MOVIL', remainingUSD, false)}
                      className="text-[11px] h-8 px-2 border-indigo-300 text-indigo-900 bg-white hover:bg-indigo-100 justify-start"
                    >
                      Pago Móvil ({formatMoneyVES(remainingVES)})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => handleQuickPay('CASH_VES', remainingUSD, false)}
                      className="text-[11px] h-8 px-2 border-indigo-300 text-indigo-900 bg-white hover:bg-indigo-100 justify-start"
                    >
                      Efectivo Bs ({formatMoneyVES(remainingVES)})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => handleQuickPay('CASH_USD', remainingUSD, false)}
                      className="text-[11px] h-8 px-2 border-indigo-300 text-indigo-900 bg-white hover:bg-indigo-100 justify-start"
                    >
                      Efectivo $ ({formatMoneyUSD(remainingUSD)})
                    </Button>
                  </div>
                </div>
              )}

              {/* Accesos Rápidos de Cobro Total (1-click para pagar saldo completo con método predilecto) */}
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-neutral-600 tracking-wider">
                    Cobro Rápido Total:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-neutral-500 font-medium">Ref / Lote:</span>
                    <input
                      type="text"
                      value={paymentRefInput}
                      onChange={(e) => setPaymentRefInput(e.target.value)}
                      placeholder="N° Referencia..."
                      className="h-6 w-36 px-2 border border-neutral-300 rounded text-[11px] font-mono bg-white focus-visible:ring-1 focus-visible:ring-sky-500"
                      title="Opcional: Si ingresa la referencia aquí, se aplicará directamente al presionar el medio."
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickPay('DEBIT_CARD', remainingUSD, false)}
                    disabled={remainingUSD <= 0.01}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-sky-100 text-sky-800 hover:bg-sky-200 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Punto Débito ({formatMoneyVES(remainingVES)})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPay('CREDIT_CARD', remainingUSD, false)}
                    disabled={remainingUSD <= 0.01}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Punto Crédito ({formatMoneyVES(remainingVES)})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPay('PAGO_MOVIL', remainingUSD, false)}
                    disabled={remainingUSD <= 0.01}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Pago Móvil ({formatMoneyVES(remainingVES)})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPay('CASH_USD', remainingUSD, false)}
                    disabled={remainingUSD <= 0.01}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Efectivo $ ({formatMoneyUSD(remainingUSD)})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPay('CASH_VES', remainingUSD, false)}
                    disabled={remainingUSD <= 0.01}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-neutral-200 text-neutral-800 hover:bg-neutral-300 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Efectivo Bs ({formatMoneyVES(remainingVES)})
                  </button>
                </div>
              </div>

              {/* Formulario de Agregar Pago Personalizado */}
              <div className="space-y-3 text-xs border border-neutral-200 p-3 rounded-lg bg-neutral-50/40">
                <span className="font-semibold text-neutral-800 block">Agregar Forma de Pago Personalizada:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-600 mb-1">Medio de Pago</label>
                    <select
                      value={currentMethod}
                      onChange={(e) => {
                        const m = e.target.value;
                        setCurrentMethod(m);
                        const conf = availablePaymentMethods.find((c) => c.code === m);
                        if (conf && conf.currency === 'VES') {
                          setPaymentCurrencyMode('VES');
                        } else if (conf && conf.currency === 'USD') {
                          setPaymentCurrencyMode('USD');
                        }
                      }}
                      className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs bg-white font-medium focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                      {availablePaymentMethods
                        .filter((m) => m.isActive)
                        .map((m) => (
                          <option key={m.code} value={m.code}>
                            {m.name} {m.appliesIGTF ? '[+3% IGTF]' : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-1.5">
                        <label className="text-neutral-600">Monto</label>
                        <button
                          type="button"
                          onClick={() => setPaymentCurrencyMode((prev) => (prev === 'USD' ? 'VES' : 'USD'))}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-100 hover:bg-sky-100 text-sky-800 transition-colors cursor-pointer"
                          title="Cambiar moneda de entrada"
                        >
                          <ArrowLeftRight className="w-2.5 h-2.5" />
                          {paymentCurrencyMode === 'USD' ? 'USD ($)' : 'Bs (VES)'}
                        </button>
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {paymentCurrencyMode === 'USD' ? (
                          <>Equiv: {formatMoneyVES(((parseFormattedNumber(paymentAmountInput) || remainingUSD)) * exchangeRateBCV)}</>
                        ) : (
                          <>Equiv: {formatMoneyUSD(((parseFormattedNumber(paymentAmountInput) || remainingVES)) / exchangeRateBCV)}</>
                        )}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={paymentAmountInput}
                      onChange={(e) => setPaymentAmountInput(e.target.value)}
                      placeholder={
                        paymentCurrencyMode === 'USD'
                          ? (remainingUSD > 0 ? remainingUSD.toFixed(2) : '0.00')
                          : (remainingVES > 0 ? remainingVES.toFixed(2) : '0.00')
                      }
                      className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs font-mono font-bold focus-visible:ring-2 focus-visible:ring-sky-500"
                    />
                  </div>
                </div>

                {(() => {
                  const showRef = isMethodRequiringReference(currentMethod);
                  if (!showRef) return null;
                  return (
                    <div>
                      <label className="block text-neutral-600 mb-1">
                        Número de Referencia / Lote Bancario <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={paymentRefInput}
                        onChange={(e) => setPaymentRefInput(e.target.value)}
                        placeholder="Últimos 4 o 6 dígitos del lote o confirmación"
                        className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs font-mono focus-visible:ring-2 focus-visible:ring-sky-500"
                      />
                    </div>
                  );
                })()}

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => {
                      const parsed = parseFormattedNumber(paymentAmountInput);
                      const isVES = paymentCurrencyMode === 'VES';
                      const amt = parsed > 0 ? parsed : (isVES ? remainingVES : remainingUSD);
                      handleAddPayment(currentMethod, amt, isVES, paymentRefInput);
                    }}
                    disabled={remainingUSD <= 0.01 && !paymentAmountInput}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Agregar Pago
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => {
                      if (paymentCurrencyMode === 'VES') {
                        handleAddPayment(currentMethod, remainingVES, true, paymentRefInput);
                      } else {
                        handleAddPayment(currentMethod, remainingUSD, false, paymentRefInput);
                      }
                    }}
                    disabled={remainingUSD <= 0.01}
                    className="text-sky-700 border-sky-300 hover:bg-sky-50"
                  >
                    Pagar Restante Total ({formatMoneyUSD(remainingUSD)} / {formatMoneyVES(remainingVES)})
                  </Button>
                </div>
              </div>

              {/* Lista de Pagos Agregados */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-neutral-800 block">
                  Pagos Registrados ({payments.length}):
                </span>
                {payments.length === 0 ? (
                  <div className="p-3 text-center text-xs text-neutral-400 bg-neutral-50 rounded-lg border border-dashed border-neutral-200">
                    No se han registrado pagos aún
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {payments.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-1.5">
                          <div>
                            <span className="font-semibold text-neutral-800">{p.methodName || p.method}</span>
                            {p.referenceNumber ? (
                              <span className="font-mono text-[11px] text-neutral-600 bg-neutral-200/60 px-1.5 py-0.5 rounded ml-1.5">
                                Ref: {p.referenceNumber}
                              </span>
                            ) : isMethodRequiringReference(p.method) ? (
                              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded ml-1.5">
                                Sin Referencia
                              </span>
                            ) : null}
                            {p.appliesIGTF && (
                              <span className="text-[10px] text-indigo-600 block">
                                +IGTF 3%: {formatMoneyUSD(p.igtfAmountUSD)}
                              </span>
                            )}
                          </div>
                          {isMethodRequiringReference(p.method) && (
                            <button
                              type="button"
                              onClick={() => {
                                setQuickRefPrompt({
                                  isOpen: true,
                                  method: p.method,
                                  methodName: p.methodName || p.method,
                                  amountUSD: p.amountUSD,
                                  amountVES: p.amountVES,
                                  isVES: false,
                                  refValue: p.referenceNumber || '',
                                  isEditingPaymentIndex: idx,
                                });
                              }}
                              className="text-neutral-400 hover:text-sky-600 p-1 rounded hover:bg-neutral-200/50"
                              title="Editar o agregar número de referencia"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{formatMoneyUSD(p.amountUSD)}</span>
                          <span className="font-mono text-neutral-400 text-[10px]">({formatMoneyVES(p.amountVES)})</span>
                          <button
                            type="button"
                            onClick={() => removePayment(idx)}
                            className="text-neutral-400 hover:text-red-500 p-1 rounded hover:bg-red-50"
                            title="Eliminar este pago"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Pinned (Acciones siempre visibles sin importar scroll o altura) */}
            <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-500">Saldo pendiente:</span>
                <span className={`font-mono font-bold ${remainingUSD <= 0.01 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {remainingUSD <= 0.01 ? 'Pagado Totalmente' : `${formatMoneyUSD(remainingUSD)} (${formatMoneyVES(remainingVES)})`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  title="Cancelar cobro (Esc)"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  type="button"
                  disabled={isSubmitting || remainingUSD > 0.01}
                  onClick={handleProcessSale}
                  className="font-bold shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Procesando Venta...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1.5" />
                      Emitir Factura Fiscal SENIAT
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Prompt para Captura / Edición de Referencia de Pago */}
      {quickRefPrompt.isOpen && (
        <div className="fixed inset-0 bg-neutral-900/70 z-[60] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-sm w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-neutral-200 my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header (Pinned) */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-sky-600" />
                <h4 className="text-xs font-bold text-neutral-900">
                  {quickRefPrompt.isEditingPaymentIndex !== undefined ? 'Editar Referencia' : 'Referencia de Pago Requerida'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() =>
                  setQuickRefPrompt({
                    isOpen: false,
                    method: '',
                    methodName: '',
                    amountUSD: 0,
                    amountVES: 0,
                    isVES: false,
                    refValue: '',
                  })
                }
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100"
                title="Cerrar (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 text-xs">
              <div className="p-2.5 bg-sky-50 border border-sky-100 rounded-lg text-sky-900">
                <div className="font-semibold">{quickRefPrompt.methodName}</div>
                <div className="text-[11px] font-mono">
                  Monto: {formatMoneyUSD(quickRefPrompt.amountUSD)} ({formatMoneyVES(quickRefPrompt.amountVES)})
                </div>
              </div>

              <div>
                <label className="block text-neutral-700 font-semibold mb-1">
                  Número de Referencia / Lote / Aprobación *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={quickRefPrompt.refValue}
                  onChange={(e) =>
                    setQuickRefPrompt((prev) => ({ ...prev, refValue: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmQuickRef();
                    }
                  }}
                  placeholder="Ej: 489201 ó 1234"
                  className="w-full h-9 px-3 border border-neutral-300 rounded-lg font-mono text-sm focus-visible:ring-2 focus-visible:ring-sky-500"
                />
                <p className="text-[10px] text-neutral-400 mt-1">
                  Presione Enter para confirmar o Esc para cancelar
                </p>
              </div>
            </div>

            {/* Footer (Pinned) */}
            <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() =>
                  setQuickRefPrompt({
                    isOpen: false,
                    method: '',
                    methodName: '',
                    amountUSD: 0,
                    amountVES: 0,
                    isVES: false,
                    refValue: '',
                  })
                }
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                type="button"
                onClick={handleConfirmQuickRef}
                className="font-bold"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registrar Nuevo Cliente */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-neutral-200 my-auto">
            {/* Header (Pinned) */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-neutral-800" />
                <h3 className="text-sm font-bold text-neutral-900">Registrar Nuevo Cliente</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 focus-visible:ring-2 rounded p-1"
                title="Cerrar modal (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 text-xs">
                {newCustomerError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    {newCustomerError}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Tipo</label>
                  <select
                    value={newCustomerDocType}
                    onChange={(e) => setNewCustomerDocType(e.target.value as any)}
                    className="w-full h-9 px-2 border border-neutral-300 rounded-lg bg-white"
                  >
                    <option value="V">V - Venezolano</option>
                    <option value="E">E - Extranjero</option>
                    <option value="J">J - Jurídico</option>
                    <option value="G">G - Gubernamental</option>
                    <option value="P">P - Pasaporte</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block font-semibold text-neutral-700 mb-1">Cédula / RIF *</label>
                  <input
                    type="text"
                    required
                    value={newCustomerDocNumber}
                    onChange={(e) => setNewCustomerDocNumber(e.target.value)}
                    placeholder="Ej: 18222333 ó 30555666-0"
                    className="w-full h-9 px-3 border border-neutral-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Nombre o Razón Social *</label>
                <input
                  type="text"
                  required
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Ej: Juan Carlos Mendoza / Inversiones ABC C.A."
                  className="w-full h-9 px-3 border border-neutral-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="Ej: 0414-1234567"
                    className="w-full h-9 px-3 border border-neutral-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                    placeholder="cliente@ejemplo.com"
                    className="w-full h-9 px-3 border border-neutral-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Dirección Fiscal</label>
                <input
                  type="text"
                  value={newCustomerAddress}
                  onChange={(e) => setNewCustomerAddress(e.target.value)}
                  placeholder="Ej: Av. Francisco de Miranda, Caracas"
                  className="w-full h-9 px-3 border border-neutral-300 rounded-lg"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-neutral-700">
                  <input
                    type="checkbox"
                    checked={newCustomerIsSpecialTaxpayer}
                    onChange={(e) => setNewCustomerIsSpecialTaxpayer(e.target.checked)}
                    className="rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>Contribuyente Especial SENIAT (Sujeto a retención)</span>
                </label>
              </div>
            </div>

            {/* Footer (Pinned) */}
            <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewCustomerModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isCreatingCustomer}
              >
                {isCreatingCustomer ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Guardar y Asociar a Venta
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    )}

      {/* Modal de Ticket Fiscal Emitido / Ticket de Venta */}
      <FiscalInvoiceModal
        isOpen={isInvoiceModalOpen}
        data={invoiceTicketData}
        onClose={() => setIsInvoiceModalOpen(false)}
        isFiscal={isFiscal}
      />

      {/* Modal de Pregunta: ¿Desea imprimir un ticket de venta? (Modo No Fiscal) */}
      {showPrintPromptModal && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-sm w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-neutral-200 my-auto">
            {/* Header (Pinned) */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-sky-600" />
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    ¿Imprimir Ticket de Venta?
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Venta completada en modo no fiscal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintPromptModal(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100"
                title="Cerrar modal (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 text-xs">
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-neutral-600 space-y-1">
                <p>
                  La venta ha sido registrada exitosamente y el inventario fue actualizado.
                </p>
                <p className="text-[11px] text-neutral-500">
                  ¿Desea imprimir el comprobante de entrega para el cliente o continuar con la siguiente transacción?
                </p>
              </div>
            </div>

            {/* Footer (Pinned) */}
            <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPrintPromptModal(false)}
              >
                No Imprimir
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setShowPrintPromptModal(false);
                  setIsInvoiceModalOpen(true);
                }}
              >
                <Printer className="w-4 h-4 mr-1.5" />
                Imprimir Ticket
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Verificación y Auditoría del Carrito de Compras */}
      {isCartReviewModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-neutral-200 my-auto">
            {/* Header (Pinned) */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-sky-600" />
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Verificación Detallada del Carrito de Compras
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    {cart.length} líneas de producto • {cart.reduce((s, i) => s + i.quantity, 0)} unidades • Tasa BCV: Bs. {formatExchangeRate(exchangeRateBCV, 2)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCartReviewModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100"
                title="Cerrar modal (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 flex flex-col items-center">
                  <ShoppingCart className="w-10 h-10 mb-2 stroke-1 text-neutral-300" />
                  <p className="text-sm font-semibold">El carrito está vacío</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Agregue productos desde el catálogo para visualizarlos y auditarlos aquí.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-100 text-neutral-700 font-semibold uppercase text-[10px] tracking-wider sticky top-0 border-b border-neutral-200">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-3 text-center">Cant.</th>
                        <th className="py-2.5 px-3 text-right">P. Unit ($)</th>
                        <th className="py-2.5 px-3 text-right">P. Unit (Bs.)</th>
                        <th className="py-2.5 px-3 text-center">IVA</th>
                        <th className="py-2.5 px-3 text-right">Subtotal ($)</th>
                        <th className="py-2.5 px-3 text-right">Total ($)</th>
                        <th className="py-2.5 px-3 text-right">Total (Bs.)</th>
                        <th className="py-2.5 px-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {cart.map((item, idx) => {
                        const unitPriceVES = item.unitPrice * exchangeRateBCV;
                        const totalVES = item.total * exchangeRateBCV;
                        const itemKey = `${item.productId}-${item.presentationId || 'base'}`;
                        const prod = products.find((p) => p.id === item.productId);
                        const availableStock = prod?.stock ?? 0;
                        const totalCommittedUnits = cart
                          .filter((i) => i.productId === item.productId)
                          .reduce((s, i) => s + i.quantity * (i.multiplier || 1), 0);
                        const isNegative = totalCommittedUnits > availableStock;

                        return (
                          <tr key={itemKey} className="hover:bg-neutral-50/70 transition-colors">
                            <td className="py-2 px-3 font-mono text-neutral-400">{idx + 1}</td>
                            <td className="py-2 px-3 font-mono font-medium text-neutral-700">{item.sku}</td>
                            <td className="py-2 px-3">
                              <div className="font-semibold text-neutral-900 flex items-center gap-1.5">
                                <span>{item.name}</span>
                                {item.presentationName && (
                                  <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200">
                                    x{item.multiplier || 1}
                                  </span>
                                )}
                              </div>
                              {isNegative && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                    Stock neg ({availableStock - totalCommittedUnits})
                                  </span>
                                  {item.isNegativeStockAuthorized && (
                                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 flex items-center gap-0.5 font-medium">
                                      <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                                      {item.supervisorApprovedBy || 'Autorizado'}
                                    </span>
                                  )}
                                </div>
                              )}
                              {item.requiresAuthorization && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  {item.isPresentationAuthorized ? (
                                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 flex items-center gap-0.5 font-medium">
                                      <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                                      Pres. Autorizada ({item.supervisorApprovedBy || 'Supervisor'})
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 flex items-center gap-0.5">
                                      <ShieldCheck className="w-2.5 h-2.5 text-amber-600" />
                                      Req. Autorización
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item.productId, item.presentationId, -1)}
                                  className="w-5 h-5 rounded bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700 cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-7 text-center font-mono font-bold">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item.productId, item.presentationId, 1)}
                                  className="w-5 h-5 rounded bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right font-mono">{formatMoneyUSD(item.unitPrice)}</td>
                            <td className="py-2 px-3 text-right font-mono text-neutral-500">
                              {formatMoneyVES(unitPriceVES)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <Badge variant={item.taxRatePercent === 0 ? 'neutral' : 'info'}>
                                {item.taxRatePercent === 0 ? 'Exento' : `${item.taxRatePercent}%`}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 text-right font-mono">{formatMoneyUSD(item.subtotal)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-neutral-900">
                              {formatMoneyUSD(item.total)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-sky-700">
                              {formatMoneyVES(totalVES)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => removeFromCart(item.productId, item.presentationId)}
                                className="text-neutral-400 hover:text-red-600 p-1 rounded cursor-pointer"
                                title="Eliminar del carrito"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Resumen Fiscal / Totales */}
            {cart.length > 0 && (
              <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-neutral-500 block">Base Exenta:</span>
                  <span className="font-mono font-bold text-neutral-900 text-sm">
                    {formatMoneyUSD(baseExempt)}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono block">
                    {formatMoneyVES(baseExempt * exchangeRateBCV)}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Base Imponible (16%):</span>
                  <span className="font-mono font-bold text-neutral-900 text-sm">
                    {formatMoneyUSD(baseTaxable)}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono block">
                    {formatMoneyVES(baseTaxable * exchangeRateBCV)}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">IVA Acumulado:</span>
                  <span className="font-mono font-bold text-neutral-900 text-sm">
                    {formatMoneyUSD(taxAmount)}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono block">
                    {formatMoneyVES(taxAmount * exchangeRateBCV)}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-sky-200">
                  <span className="text-sky-800 font-semibold block">Total General:</span>
                  <span className="font-mono font-extrabold text-sky-700 text-base">
                    {formatMoneyUSD(subtotalBeforeIGTF)}
                  </span>
                  <span className="text-xs text-sky-900 font-mono block font-semibold">
                    {formatMoneyVES(subtotalBeforeIGTF * exchangeRateBCV)}
                  </span>
                </div>
              </div>
            )}

            {/* Footer (Pinned) */}
            <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between gap-2 shrink-0">
              <div>
                {cart.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={async () => {
                      const confirmed = await showClearCartAlert();
                      if (confirmed) {
                        setCart([]);
                        setIsCartReviewModalOpen(false);
                      }
                    }}
                    className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Vaciar Carrito
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCartReviewModalOpen(false)}
                >
                  Volver a la Caja
                </Button>
                <Button
                  size="sm"
                  disabled={cart.length === 0}
                  onClick={() => {
                    setIsCartReviewModalOpen(false);
                    setPayments([]);
                    setIsPaymentModalOpen(true);
                  }}
                >
                  <CreditCard className="w-4 h-4 mr-1.5" />
                  Proceder al Cobro ({formatMoneyUSD(subtotalBeforeIGTF)})
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Autorización de Supervisor para Stock en Negativo */}
      {isSupervisorModalOpen && pendingStockApproval && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-md w-full shadow-2xl flex flex-col overflow-hidden border border-neutral-200 my-auto">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Autorización de Supervisor Requerida
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    {pendingStockApproval.action === 'PRESENTATION_AUTH'
                      ? 'Presentación de producto restringida para la venta'
                      : 'Venta con existencia de inventario en negativo'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSupervisorModalOpen(false);
                  setPendingStockApproval(null);
                }}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              {pendingStockApproval.action === 'PRESENTATION_AUTH' ? (
                /* Tarjeta de Resumen para Presentación Restringida */
                <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-neutral-900 block text-xs">
                        {pendingStockApproval.productName}
                      </span>
                      <span className="font-mono text-[11px] text-neutral-500">
                        SKU: {pendingStockApproval.sku}
                      </span>
                    </div>
                    <Badge variant="warning" className="text-[10px]">
                      Req. Autorización
                    </Badge>
                  </div>

                  <div className="pt-2 border-t border-amber-200/60 text-[11px] text-neutral-700 space-y-1">
                    <p>
                      La presentación o empaque <strong>{pendingStockApproval.presentationName || 'seleccionada'}</strong> (x{pendingStockApproval.multiplier || 1}) está configurada para requerir autorización expresa de supervisor antes de ser comercializada en caja.
                    </p>
                    <p className="text-neutral-500 text-[10px]">
                      Por favor, solicite a un supervisor que ingrese sus credenciales para autorizar el despacho.
                    </p>
                  </div>
                </div>
              ) : (
                /* Tarjeta de Resumen de Stock */
                <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-neutral-900 block text-xs">
                        {pendingStockApproval.productName}
                      </span>
                      <span className="font-mono text-[11px] text-neutral-500">
                        SKU: {pendingStockApproval.sku}
                      </span>
                    </div>
                    <Badge variant="warning" className="text-[10px]">
                      Déficit: -{pendingStockApproval.deficit}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-200/60 text-[11px]">
                    <div>
                      <span className="text-neutral-500 block">Almacén de la Caja:</span>
                      <span className="font-semibold text-neutral-800">
                        {activeShift?.warehouseName || 'Almacén Principal'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Existencia Actual:</span>
                      <span className={`font-mono font-bold ${pendingStockApproval.availableStock <= 0 ? 'text-red-600' : 'text-neutral-800'}`}>
                        {pendingStockApproval.availableStock} unidades
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Cantidad a Vender:</span>
                      <span className="font-mono font-bold text-neutral-900">
                        {pendingStockApproval.targetQty} unidades
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Saldo Resultante:</span>
                      <span className="font-mono font-bold text-red-600">
                        {pendingStockApproval.availableStock - pendingStockApproval.targetQty} unidades
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Opción rápida si el usuario actual es Administrador o Supervisor con nivel para autorizar */}
              {canAuthorizeOperations(user?.role, user?.permissions) ? (
                <div className="p-3 bg-sky-50 rounded-lg border border-sky-200 space-y-2">
                  <p className="text-[11px] text-sky-800">
                    Su sesión actual posee rango de <strong>{user?.role || 'Administrador / Supervisor'}</strong> con nivel para autorizar operaciones. Puede autorizar esta venta inmediatamente:
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={isAuthorizingSupervisor}
                    onClick={() => handleConfirmSupervisorApproval(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>{isAuthorizingSupervisor ? 'Autorizando...' : 'Autorizar como Administrador / Supervisor'}</span>
                  </Button>
                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-sky-200"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase text-sky-500 bg-sky-50 px-2 font-medium">
                      O ingresar credenciales de otro supervisor
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-neutral-600">
                    Las autorizaciones deben ser aprobadas exclusivamente por un usuario que sea <strong>Administrador</strong> o cuente con nivel de <strong>Supervisor</strong> autorizado. Ingrese a continuación las credenciales del autorizador.
                  </p>
                </div>
              )}

              {/* Formulario de Credenciales de Supervisor */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConfirmSupervisorApproval(false);
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Usuario o Correo del Supervisor *
                  </label>
                  <input
                    type="text"
                    value={supervisorUsername}
                    onChange={(e) => setSupervisorUsername(e.target.value)}
                    placeholder="ej: supervisor / admin@empresa.com"
                    className="w-full h-9 rounded-lg border border-neutral-300 bg-white px-3 text-xs text-neutral-900 focus-visible:ring-2 focus-visible:ring-sky-500"
                    required={!canAuthorizeOperations(user?.role, user?.permissions)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Contraseña del Supervisor *
                  </label>
                  <input
                    type="password"
                    value={supervisorPassword}
                    onChange={(e) => setSupervisorPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-9 rounded-lg border border-neutral-300 bg-white px-3 text-xs text-neutral-900 focus-visible:ring-2 focus-visible:ring-sky-500"
                    required={!canAuthorizeOperations(user?.role, user?.permissions)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Motivo u Observación (Opcional)
                  </label>
                  <input
                    type="text"
                    value={supervisorNotes}
                    onChange={(e) => setSupervisorNotes(e.target.value)}
                    placeholder="ej: Mercancía física disponible pendiente por recepción"
                    className="w-full h-9 rounded-lg border border-neutral-300 bg-white px-3 text-xs text-neutral-900 focus-visible:ring-2 focus-visible:ring-sky-500"
                  />
                </div>

                {supervisorAuthError && (
                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                    {supervisorAuthError}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsSupervisorModalOpen(false);
                      setPendingStockApproval(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isAuthorizingSupervisor || (!supervisorUsername.trim() || !supervisorPassword)}
                  >
                    {isAuthorizingSupervisor ? 'Validando...' : 'Autorizar Venta'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Selección de Presentaciones */}
      {isPresentationModalOpen && selectedProductForPresentation && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
            {/* Cabecera del Modal */}
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-100 rounded-lg text-sky-700">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Seleccionar Presentación
                  </h3>
                  <p className="text-xs text-neutral-500 font-mono">
                    {selectedProductForPresentation.name} • SKU: {selectedProductForPresentation.sku}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPresentationModalOpen(false);
                  setSelectedProductForPresentation(null);
                  setPresentationModalError(null);
                }}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido / Listado de Presentaciones */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Información base del producto */}
              <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Precio Base (Unidad)</span>
                  <span className="font-bold text-neutral-900">{formatMoneyUSD(selectedProductForPresentation.priceUSD)}</span>
                  <span className="text-[11px] font-mono text-neutral-500 ml-1.5">
                    ({formatMoneyVES(selectedProductForPresentation.priceUSD * exchangeRateBCV)})
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Stock en Almacén</span>
                  <span className={`font-mono font-bold ${(selectedProductForPresentation.stock ?? 0) <= 0 ? 'text-amber-600' : 'text-neutral-800'}`}>
                    {selectedProductForPresentation.stock ?? 0} unidades base
                  </span>
                </div>
              </div>

              {/* Lista de presentaciones disponibles */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-2">
                  Presentaciones Disponibles ({selectedProductForPresentation.presentations?.length || 0}):
                </label>
                <div className="space-y-2">
                  {selectedProductForPresentation.presentations?.map((pres) => {
                    const isSelected = selectedPresentationId === pres.id;
                    const presPrice =
                      pres.basePrice !== null && pres.basePrice !== undefined
                        ? pres.basePrice
                        : Number((selectedProductForPresentation.priceUSD * (pres.multiplier || 1)).toFixed(4));
                    const presPriceVES = presPrice * exchangeRateBCV;

                    return (
                      <div
                        key={pres.id}
                        onClick={() => {
                          setSelectedPresentationId(pres.id);
                          setPresentationModalError(null);
                        }}
                        className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-sky-500 bg-sky-50/50 ring-1 ring-sky-500'
                            : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/50 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <input
                            type="radio"
                            name="pos-product-presentation"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedPresentationId(pres.id);
                              setPresentationModalError(null);
                            }}
                            className="mt-1 h-4 w-4 text-sky-600 border-neutral-300 focus:ring-sky-500 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-neutral-900">
                                {pres.name}
                              </span>
                              {pres.isDefault && (
                                <span className="text-[10px] font-semibold bg-sky-100 text-sky-800 border border-sky-300 px-1.5 py-0.2 rounded">
                                  Predeterminada
                                </span>
                              )}
                              {pres.requiresAuthorization && (
                                <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                  <Lock className="w-2.5 h-2.5" />
                                  Requiere Autorización
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-2">
                              <span>Contiene: <strong className="text-neutral-700">{pres.multiplier || 1} unidades base</strong></span>
                              {pres.sku && <span>• SKU: <span className="font-mono">{pres.sku}</span></span>}
                              {pres.barcode && <span>• Barras: <span className="font-mono">{pres.barcode}</span></span>}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-neutral-900 font-mono">
                            {formatMoneyUSD(presPrice)}
                          </div>
                          <div className="text-[10px] font-mono text-neutral-500">
                            {formatMoneyVES(presPriceVES)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selector de Cantidad */}
              <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Cantidad a agregar:
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPresentationQty((q) => Math.max(1, q - 1))}
                      className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 flex items-center justify-center text-neutral-700 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={presentationQty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setPresentationQty(isNaN(val) ? 1 : Math.max(1, val));
                        setPresentationModalError(null);
                      }}
                      className="w-16 h-8 text-center text-xs font-bold font-mono border border-neutral-300 rounded-lg bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setPresentationQty((q) => q + 1)}
                      className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 flex items-center justify-center text-neutral-700 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Subtotal estimado */}
                {selectedPresentationId && (
                  <div className="text-right">
                    <span className="text-[10px] text-neutral-500 block uppercase font-semibold">Subtotal Estimado</span>
                    {(() => {
                      const pres = selectedProductForPresentation.presentations?.find(
                        (p) => p.id === selectedPresentationId
                      );
                      const presPrice = pres
                        ? pres.basePrice !== null && pres.basePrice !== undefined
                          ? pres.basePrice
                          : Number((selectedProductForPresentation.priceUSD * (pres.multiplier || 1)).toFixed(4))
                        : 0;
                      const subTotal = presPrice * (presentationQty || 1);
                      return (
                        <div>
                          <span className="text-sm font-bold text-neutral-900 font-mono">
                            {formatMoneyUSD(subTotal)}
                          </span>
                          <span className="block text-[11px] font-mono text-neutral-500">
                            {formatMoneyVES(subTotal * exchangeRateBCV)}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Mensaje de error / advertencia de autorización */}
              {presentationModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 font-medium">
                      {presentationModalError}
                    </p>
                  </div>
                  {/* Botón de solicitar supervisor si la causa es falta de autorización */}
                  {selectedProductForPresentation.presentations?.find((p) => p.id === selectedPresentationId)?.requiresAuthorization &&
                    !canAuthorizeOperations(user?.role, user?.permissions) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRequestSupervisorForPresentation}
                        className="w-full mt-1 border-red-300 text-red-800 hover:bg-red-100 flex items-center justify-center gap-1.5 text-xs"
                      >
                        <ShieldCheck className="w-4 h-4 text-red-600" />
                        <span>Solicitar Autorización de Supervisor</span>
                      </Button>
                    )}
                </div>
              )}
            </div>

            {/* Pie del Modal */}
            <div className="p-3.5 border-t border-neutral-200 flex items-center justify-end gap-2 bg-neutral-50 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsPresentationModalOpen(false);
                  setSelectedProductForPresentation(null);
                  setPresentationModalError(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleConfirmAddPresentation}
                className="flex items-center gap-1.5"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Agregar al Carrito</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición de Descuento por Renglón */}
      {editingDiscountItem && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-sm w-full p-4 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-bold text-neutral-900">Descuento de Producto</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingDiscountItem(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 font-medium">
              Producto: <strong className="text-neutral-900">{editingDiscountItem.productName}</strong>
            </p>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Porcentaje de Descuento (0% - 100%):
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={discountInputPercent}
                  onChange={(e) => setDiscountInputPercent(e.target.value)}
                  placeholder="0"
                  className="w-full h-9 pl-3 pr-8 text-xs font-mono font-bold border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-neutral-400 font-bold">%</span>
              </div>
            </div>

            {/* Atajos Rápidos */}
            <div className="space-y-1">
              <span className="text-[10px] text-neutral-500 font-semibold uppercase">Atajos rápidos:</span>
              <div className="flex gap-1.5 flex-wrap">
                {[0, 5, 10, 15, 20, 25, 50].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setDiscountInputPercent(String(pct))}
                    className="px-2 py-1 text-[11px] font-mono rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 transition-colors cursor-pointer"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingDiscountItem(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() =>
                  handleApplyItemDiscount(
                    editingDiscountItem.productId,
                    editingDiscountItem.presentationId,
                    parseFloat(discountInputPercent) || 0
                  )
                }
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
