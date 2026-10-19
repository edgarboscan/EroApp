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
} from '@ero/shared';

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  priceUSD: number;
  taxRatePercent: number;
  stock?: number;
  barcode?: string;
}

interface CartItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRatePercent: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  isNegativeStockAuthorized?: boolean;
  supervisorApprovedBy?: string;
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
  const [loadingShift, setLoadingShift] = useState(false);

  // Reglas de negocio (Stock negativo y autorizaciones)
  const [businessRules, setBusinessRules] = useState<{
    allowNegativeStock: boolean;
    requireApprovalNegativeStock: boolean;
  }>({
    allowNegativeStock: true,
    requireApprovalNegativeStock: true,
  });

  // Modal de Autorización de Supervisor para Stock en Negativo
  interface SupervisorApprovalRequest {
    productId: string;
    productName: string;
    sku: string;
    availableStock: number;
    targetQty: number;
    deficit: number;
    action: 'ADD' | 'UPDATE';
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
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    quickRefPrompt.isOpen,
    showPrintPromptModal,
    isNewCustomerModalOpen,
    isCartReviewModalOpen,
    isInvoiceModalOpen,
    isPaymentModalOpen,
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
              priceUSD: isNaN(price) || price <= 0 ? 0 : price,
              taxRatePercent: isNaN(parsedTax) ? 16.0 : parsedTax,
              stock: isNaN(stock) ? 0 : stock,
              barcode: p.barcode,
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

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.toLowerCase().includes(term))
    );
  }, [products, searchTerm]);

  // Aplica la modificación al carrito registrando el estado de autorización si aplica
  const applyCartItem = (
    product: ProductItem,
    newQuantity: number,
    isAuthorized = false,
    authorizedBy?: string
  ) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (newQuantity <= 0) {
        return prev.filter((item) => item.productId !== product.id);
      }
      const subtotal = Number((newQuantity * product.priceUSD).toFixed(2));
      const taxAmount = Number(((subtotal * product.taxRatePercent) / 100).toFixed(2));
      const total = Number((subtotal + taxAmount).toFixed(2));

      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: newQuantity,
                subtotal,
                taxAmount,
                total,
                isNegativeStockAuthorized: isAuthorized || item.isNegativeStockAuthorized,
                supervisorApprovedBy: authorizedBy || item.supervisorApprovedBy,
              }
            : item
        );
      }

      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: newQuantity,
          unitPrice: product.priceUSD,
          taxRatePercent: product.taxRatePercent,
          subtotal,
          taxAmount,
          total,
          isNegativeStockAuthorized: isAuthorized,
          supervisorApprovedBy: authorizedBy,
        },
      ];
    });
  };

  // Manejo de Carrito con validación de stock y reglas de negocio
  const addToCart = (product: ProductItem) => {
    const existing = cart.find((item) => item.productId === product.id);
    const currentQty = existing ? existing.quantity : 0;
    const targetQty = currentQty + 1;
    const availableStock = product.stock ?? 0;

    // Validar si el producto no tiene existencia o la nueva cantidad excede el stock
    if (targetQty > availableStock) {
      if (!businessRules.allowNegativeStock) {
        toast.error(
          `El producto "${product.name}" no tiene existencia suficiente en almacén (Disponible: ${availableStock}, Solicitado: ${targetQty}). Las reglas de negocio no permiten ventas con existencia en negativo.`
        );
        return;
      }

      if (businessRules.requireApprovalNegativeStock) {
        setPendingStockApproval({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          availableStock,
          targetQty,
          deficit: targetQty - availableStock,
          action: existing ? 'UPDATE' : 'ADD',
        });
        setSupervisorAuthError(null);
        setSupervisorUsername('');
        setSupervisorPassword('');
        setSupervisorNotes('');
        setIsSupervisorModalOpen(true);
        toast.warning(
          `El producto "${product.name}" no tiene existencia suficiente (Disponible: ${availableStock}). Se requiere autorización de supervisor para continuar.`
        );
        return;
      }

      toast.warning(
        `Atención: El producto "${product.name}" no tiene existencia suficiente (Disponible: ${availableStock}). Se registrará con existencia en negativo.`
      );
    }

    applyCartItem(product, targetQty);
  };

  const updateCartQty = (productId: string, delta: number) => {
    const existing = cart.find((item) => item.productId === productId);
    if (!existing) return;

    const targetQty = existing.quantity + delta;
    if (targetQty <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find((p) => p.id === productId);
    const availableStock = product?.stock ?? 0;

    // Solo se valida stock si se está aumentando la cantidad
    if (delta > 0 && targetQty > availableStock) {
      if (!businessRules.allowNegativeStock) {
        toast.error(
          `Existencia insuficiente para "${existing.name}" en almacén (Disponible: ${availableStock}, Solicitado: ${targetQty}). Las reglas de negocio no permiten ventas con existencia en negativo.`
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
          deficit: targetQty - availableStock,
          action: 'UPDATE',
        });
        setSupervisorAuthError(null);
        setSupervisorUsername('');
        setSupervisorPassword('');
        setSupervisorNotes('');
        setIsSupervisorModalOpen(true);
        toast.warning(
          `Modificación a cantidad ${targetQty} de "${existing.name}" dejará existencia en negativo (${availableStock - targetQty}). Se requiere autorización de supervisor.`
        );
        return;
      }

      toast.warning(
        `Atención: Cantidad solicitada (${targetQty}) para "${existing.name}" excede la existencia disponible (${availableStock}).`
      );
    }

    if (product) {
      applyCartItem(product, targetQty);
    } else {
      setCart((prev) =>
        prev.map((item) => {
          if (item.productId === productId) {
            const subtotal = Number((targetQty * item.unitPrice).toFixed(2));
            const taxAmount = Number(((subtotal * item.taxRatePercent) / 100).toFixed(2));
            const total = Number((subtotal + taxAmount).toFixed(2));
            return { ...item, quantity: targetQty, subtotal, taxAmount, total };
          }
          return item;
        })
      );
    }
  };

  // Confirmar autorización de supervisor para stock negativo
  const handleConfirmSupervisorApproval = async (selfAuth = false) => {
    if (!pendingStockApproval) return;
    if (!selfAuth && (!supervisorUsername.trim() || !supervisorPassword)) {
      setSupervisorAuthError('Ingrese usuario o correo y contraseña del supervisor');
      return;
    }

    setIsAuthorizingSupervisor(true);
    setSupervisorAuthError(null);

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
          reason: supervisorNotes.trim() || `Autorización de stock negativo para ${pendingStockApproval.productName}`,
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

      applyCartItem(product, pendingStockApproval.targetQty, true, approverName);

      toast.success(
        `Venta con existencia en negativo aprobada por ${approverName} para "${pendingStockApproval.productName}"`
      );
      setIsSupervisorModalOpen(false);
      setPendingStockApproval(null);
    } catch (err: any) {
      setSupervisorAuthError(err.message || 'Error al autorizar operación');
    } finally {
      setIsAuthorizingSupervisor(false);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
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
          taxRatePercent: item.taxRatePercent,
          subtotal: item.subtotal,
          taxAmount: item.taxAmount,
          total: item.total,
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

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
      {/* Columna Izquierda: Catálogo y Búsqueda */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Banner de Estado del Turno */}
        {!loadingShift && !activeShift && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Atención:</strong> No tienes un turno de caja abierto en esta sucursal.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (cart.length > 0) {
                  const confirmLeave = await showLeaveCartAlert();
                  if (!confirmLeave) return;
                  setCart([]);
                }
                navigate('/pos/cierre');
              }}
              className="text-amber-900 border-amber-300 hover:bg-amber-100"
            >
              <Unlock className="w-3.5 h-3.5 mr-1" />
              Abrir Turno
            </Button>
          </div>
        )}

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
              if (e.key === 'Enter' && filteredProducts.length > 0) {
                addToCart(filteredProducts[0]);
                setSearchTerm('');
              }
            }}
            placeholder="Escanear código de barras o buscar producto por nombre/SKU (Enter para añadir)..."
            className="w-full h-11 pl-10 pr-10 text-xs bg-white border border-neutral-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
          />
          <Barcode className="w-5 h-5 absolute right-3 top-3 text-neutral-400" />
        </div>

        {/* Grid de Productos Frecuentes */}
        <div className="flex-1 bg-white border border-neutral-200 rounded-lg p-4 overflow-y-auto shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Catálogo de Productos ({filteredProducts.length})
            </h2>
            <span className="text-[11px] text-neutral-400 font-mono">
              Tasa BCV: Bs. {formatExchangeRate(exchangeRateBCV, 2)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map((p) => {
              const priceVES = p.priceUSD * exchangeRateBCV;
              const hasNoStock = (p.stock ?? 0) <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="flex flex-col text-left p-3 rounded-lg border border-neutral-200 hover:border-sky-500 hover:bg-sky-50/20 transition-colors cursor-pointer group bg-neutral-50/30"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-mono text-neutral-400 group-hover:text-sky-600">
                      {p.sku}
                    </span>
                    {hasNoStock ? (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                        Sin stock ({p.stock ?? 0})
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-neutral-500">
                        Stock: {p.stock}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-neutral-800 mt-1 line-clamp-2">
                    {p.name}
                  </span>
                  <div className="mt-auto pt-2 flex items-baseline justify-between">
                    <div>
                      <div className="text-sm font-bold text-neutral-900">{formatMoneyUSD(p.priceUSD)}</div>
                      <div className="text-[10px] font-mono text-neutral-500">
                        {formatMoneyVES(priceVES)}
                      </div>
                    </div>
                    <Badge variant={p.taxRatePercent === 0 ? 'neutral' : 'info'}>
                      {p.taxRatePercent === 0 ? 'Exento' : `IVA ${p.taxRatePercent}%`}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Columna Derecha: Detalle de Venta / Carrito */}
      <div className="w-full lg:w-96 flex flex-col bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
        {/* Encabezado */}
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
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
        <div className="p-3 border-b border-neutral-100 bg-neutral-50/50 space-y-2">
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
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded hover:bg-white transition-colors"
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
                              className="text-sky-600 font-semibold hover:underline mt-1 block w-full text-center"
                            >
                              + Registrar nuevo cliente
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      customerSearchResults.map((cust) => (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => handleSelectCustomer(cust)}
                          className="w-full text-left p-2 hover:bg-sky-50/50 flex flex-col transition-colors cursor-pointer"
                        >
                          <span className="font-semibold text-neutral-800">{cust.name}</span>
                          <span className="text-[11px] font-mono text-neutral-500">
                            {cust.docType}-{cust.docNumber} {cust.phone ? `• ${cust.phone}` : ''}
                          </span>
                        </button>
                      ))
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

        {/* Lista de Items */}
        <div className="flex-1 p-3 overflow-y-auto divide-y divide-neutral-100">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-400 py-12">
              <ShoppingCart className="w-8 h-8 mb-2 stroke-1" />
              <p className="text-xs">El carrito está vacío</p>
            </div>
          ) : (
            cart.map((item) => {
              const prod = products.find((p) => p.id === item.productId);
              const availableStock = prod?.stock ?? 0;
              const isNegative = item.quantity > availableStock;
              return (
                <div key={item.productId} className="py-2.5 flex items-center justify-between">
                  <div className="flex-1 pr-2">
                    <div className="text-xs font-semibold text-neutral-800">{item.name}</div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      {formatMoneyUSD(item.unitPrice)} c/u • {item.taxRatePercent === 0 ? 'Exento' : `IVA ${formatPercent(item.taxRatePercent, 0)}`}
                    </div>
                    {isNegative && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                          Stock neg ({availableStock - item.quantity})
                        </span>
                        {item.isNegativeStockAuthorized && (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 flex items-center gap-0.5 font-medium">
                            <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                            {item.supervisorApprovedBy || 'Autorizado'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateCartQty(item.productId, -1)}
                    className="w-6 h-6 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-bold w-5 text-center font-mono">{item.quantity}</span>
                  <button
                    onClick={() => updateCartQty(item.productId, 1)}
                    className="w-6 h-6 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="w-16 text-right font-mono font-bold text-xs text-neutral-900 pl-2">
                  {formatMoneyUSD(item.total)}
                </div>

                <button
                  onClick={() => removeFromCart(item.productId)}
                  className="text-neutral-300 hover:text-red-500 p-1 ml-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
          )}
        </div>

        {/* Resumen Fiscal */}
        <div className="p-4 border-t border-neutral-200 bg-neutral-50 space-y-2 text-xs">
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
                        return (
                          <tr key={item.productId} className="hover:bg-neutral-50/70 transition-colors">
                            <td className="py-2 px-3 font-mono text-neutral-400">{idx + 1}</td>
                            <td className="py-2 px-3 font-mono font-medium text-neutral-700">{item.sku}</td>
                            <td className="py-2 px-3">
                              <div className="font-semibold text-neutral-900">{item.name}</div>
                              {(() => {
                                const prod = products.find((p) => p.id === item.productId);
                                const availableStock = prod?.stock ?? 0;
                                const isNegative = item.quantity > availableStock;
                                if (!isNegative) return null;
                                return (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                      Stock neg ({availableStock - item.quantity})
                                    </span>
                                    {item.isNegativeStockAuthorized && (
                                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 flex items-center gap-0.5 font-medium">
                                        <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                                        {item.supervisorApprovedBy || 'Autorizado'}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item.productId, -1)}
                                  className="w-5 h-5 rounded bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700 cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-7 text-center font-mono font-bold">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item.productId, 1)}
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
                                onClick={() => removeFromCart(item.productId)}
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
                    Venta con existencia de inventario en negativo
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
              {/* Tarjeta de Resumen de Stock */}
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

              {/* Opción rápida si el usuario actual es SuperAdmin o Supervisor */}
              {isSuperAdminRole(user?.role) && (
                <div className="p-3 bg-sky-50 rounded-lg border border-sky-200 space-y-2">
                  <p className="text-[11px] text-sky-800">
                    Su sesión actual posee rango de <strong>{user?.role || 'Administrador'}</strong>. Puede autorizar esta venta inmediatamente:
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={isAuthorizingSupervisor}
                    onClick={() => handleConfirmSupervisorApproval(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>{isAuthorizingSupervisor ? 'Autorizando...' : 'Autorizar como Administrador'}</span>
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
                    required={!isSuperAdminRole(user?.role)}
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
                    required={!isSuperAdminRole(user?.role)}
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
    </div>
  );
};
