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
  Settings2,
  ArrowLeftRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { useExchangeRateStore } from '../../stores/exchangeRateStore';
import { FiscalInvoiceModal, FiscalInvoiceTicketData } from './FiscalInvoiceModal';
import { PaymentMethodsModal } from './PaymentMethodsModal';
import {
  formatNumber,
  formatCurrency,
  formatMoneyUSD,
  formatMoneyVES,
  formatExchangeRate,
  formatPercent,
  parseFormattedNumber,
  PaymentMethod,
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

const DEFAULT_PRODUCTS: ProductItem[] = [
  { id: 'p1', sku: 'HAR-PAN-01', name: 'Harina PAN Blanca 1Kg', priceUSD: 1.4, taxRatePercent: 0, barcode: '759101234567' },
  { id: 'p2', sku: 'LEC-POL-01', name: 'Leche en Polvo Completa 1Kg', priceUSD: 9.2, taxRatePercent: 16, barcode: '759101234568' },
  { id: 'p3', sku: 'DES-SET-06', name: 'Juego Destornilladores 6 Piezas', priceUSD: 14.5, taxRatePercent: 16, barcode: '759101234569' },
];

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

  const [products, setProducts] = useState<ProductItem[]>(DEFAULT_PRODUCTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [loadingShift, setLoadingShift] = useState(false);

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
  const [isPaymentMethodsModalOpen, setIsPaymentMethodsModalOpen] = useState(false);
  const [paymentCurrencyMode, setPaymentCurrencyMode] = useState<'USD' | 'VES'>('USD');
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
  const [paymentRefInput, setPaymentRefInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de Ticket Fiscal Emitido / Ticket de Venta
  const [invoiceTicketData, setInvoiceTicketData] = useState<FiscalInvoiceTicketData | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [showPrintPromptModal, setShowPrintPromptModal] = useState(false);

  // Determinar si la caja activa opera con impresora fiscal
  const isFiscal = useMemo(() => {
    if (!activeShift) return false;
    return activeShift.invoiceMode === 'fiscal_printer';
  }, [activeShift]);

  useEffect(() => {
    checkCurrentShift();
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
        } else {
          setActiveShift(null);
        }
      }
    } catch {
      // Demo fallback: assume shift open for testing
      setActiveShift({
        id: 'shift-demo-01',
        cashRegisterCode: 'CAJA-01',
        cashRegisterName: 'Caja Principal Entrada',
        cashierName: user?.fullName || 'Cajero Demo',
        invoiceMode: 'fiscal_printer',
        fiscalPrinterSerial: 'Z5A8812341',
      });
    } finally {
      setLoadingShift(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch('/api/inventory/products', { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const mapped: ProductItem[] = json.data.map((p: any) => {
            const rawTax = p.taxRate ?? p.tax_rate_percentage ?? p.tax_rate;
            const parsedTax = rawTax !== undefined && rawTax !== null ? parseFloat(rawTax) : 16.0;
            const price = parseFloat(p.basePrice ?? p.sale_price_usd ?? p.base_price ?? 0);
            const stock = parseFloat(p.currentStock ?? p.stock ?? 0);

            return {
              id: p.id,
              sku: p.sku,
              name: p.name,
              priceUSD: isNaN(price) || price <= 0 ? 1.0 : price,
              taxRatePercent: isNaN(parsedTax) ? 16.0 : parsedTax,
              stock: isNaN(stock) ? 0 : stock,
              barcode: p.barcode,
            };
          });
          setProducts(mapped);
        }
      }
    } catch {
      setProducts(DEFAULT_PRODUCTS);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch('/api/pos/payment-methods', { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setAvailablePaymentMethods(json.data);
          return;
        }
      }
    } catch {
      // fallback to standards below
    }
    setAvailablePaymentMethods([
      { id: '1', code: 'CASH_USD', name: 'Efectivo Divisas ($)', currency: 'USD', type: 'CASH', appliesIGTF: true, requiresReference: false, requiresBankAccount: false, isActive: true, displayOrder: 1 },
      { id: '2', code: 'DEBIT_CARD', name: 'Punto de Venta / Débito (Bs)', currency: 'VES', type: 'CARD', appliesIGTF: false, requiresReference: true, requiresBankAccount: false, isActive: true, displayOrder: 2 },
      { id: '3', code: 'CREDIT_CARD', name: 'Punto de Venta / Crédito (Bs)', currency: 'VES', type: 'CARD', appliesIGTF: false, requiresReference: true, requiresBankAccount: false, isActive: true, displayOrder: 3 },
      { id: '4', code: 'PAGO_MOVIL', name: 'Pago Móvil (Bs)', currency: 'VES', type: 'ELECTRONIC', appliesIGTF: false, requiresReference: true, requiresBankAccount: false, isActive: true, displayOrder: 4 },
      { id: '5', code: 'ZELLE', name: 'Zelle / Transferencia USD', currency: 'USD', type: 'ELECTRONIC', appliesIGTF: true, requiresReference: true, requiresBankAccount: false, isActive: true, displayOrder: 5 },
      { id: '6', code: 'CASH_VES', name: 'Efectivo Bolívares (Bs)', currency: 'VES', type: 'CASH', appliesIGTF: false, requiresReference: false, requiresBankAccount: false, isActive: true, displayOrder: 6 },
      { id: '7', code: 'BIOPAGO', name: 'Biopago BDV (Bs)', currency: 'VES', type: 'CARD', appliesIGTF: false, requiresReference: true, requiresBankAccount: false, isActive: true, displayOrder: 7 },
      { id: '8', code: 'CASHEA', name: 'Cashea / Financiamiento', currency: 'USD', type: 'CREDIT', appliesIGTF: false, requiresReference: true, requiresBankAccount: false, isActive: true, displayOrder: 8 },
    ]);
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

  // Manejo de Carrito
  const addToCart = (product: ProductItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        const updatedQty = existing.quantity + 1;
        const subtotal = Number((updatedQty * product.priceUSD).toFixed(2));
        const taxAmount = Number(((subtotal * product.taxRatePercent) / 100).toFixed(2));
        const total = Number((subtotal + taxAmount).toFixed(2));
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: updatedQty, subtotal, taxAmount, total }
            : item
        );
      }
      const subtotal = Number(product.priceUSD.toFixed(2));
      const taxAmount = Number(((subtotal * product.taxRatePercent) / 100).toFixed(2));
      const total = Number((subtotal + taxAmount).toFixed(2));
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: 1,
          unitPrice: product.priceUSD,
          taxRatePercent: product.taxRatePercent,
          subtotal,
          taxAmount,
          total,
        },
      ];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const updatedQty = item.quantity + delta;
            if (updatedQty <= 0) return null;
            const subtotal = Number((updatedQty * item.unitPrice).toFixed(2));
            const taxAmount = Number(((subtotal * item.taxRatePercent) / 100).toFixed(2));
            const total = Number((subtotal + taxAmount).toFixed(2));
            return { ...item, quantity: updatedQty, subtotal, taxAmount, total };
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
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

  // Agregar forma de pago
  const handleAddPayment = (method: string, amount: number, isAmountInVES = false, ref?: string) => {
    let amountUSD = amount;
    if (isAmountInVES) {
      amountUSD = Number((amount / exchangeRateBCV).toFixed(2));
    }
    if (amountUSD <= 0) return;

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
      methodName: methodConfig?.name || method,
      amountUSD,
      amountVES,
      exchangeRate: exchangeRateBCV,
      referenceNumber: ref || (null as any),
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
        warehouseId: activeWarehouseId || 'w1111111-1111-1111-1111-111111111111',
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
        cashierName: activeShift?.cashierName || user?.fullName || 'Cajero Demo',
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
              onClick={() => navigate('/pos/cierre')}
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
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="flex flex-col text-left p-3 rounded-lg border border-neutral-200 hover:border-sky-500 hover:bg-sky-50/20 transition-colors cursor-pointer group bg-neutral-50/30"
                >
                  <span className="text-[10px] font-mono text-neutral-400 group-hover:text-sky-600">
                    {p.sku}
                  </span>
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
            cart.map((item) => (
              <div key={item.productId} className="py-2.5 flex items-center justify-between">
                <div className="flex-1 pr-2">
                  <div className="text-xs font-semibold text-neutral-800">{item.name}</div>
                  <div className="text-[11px] text-neutral-500 font-mono">
                    {formatMoneyUSD(item.unitPrice)} c/u • {item.taxRatePercent === 0 ? 'Exento' : `IVA ${formatPercent(item.taxRatePercent, 0)}`}
                  </div>
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
            ))
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
              onClick={() => {
                if (confirm('¿Desea vaciar todos los productos del carrito actual?')) setCart([]);
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
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-sky-600" />
                <h3 className="text-sm font-bold text-neutral-900">Cobro Multi-Moneda & Fiscal</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentMethodsModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:text-sky-700 hover:bg-sky-50 rounded-lg border border-neutral-300 transition-colors cursor-pointer"
                  title="Configurar y crear métodos de pago"
                >
                  <Settings2 className="w-3.5 h-3.5 text-sky-600" />
                  <span>Gestionar Medios</span>
                </button>
                <button
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 cursor-pointer p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

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
                    onClick={() => {
                      setCurrentMethod('DEBIT_CARD');
                      handleAddPayment('DEBIT_CARD', remainingUSD, false, paymentRefInput);
                    }}
                    className="text-[11px] h-8 px-2 border-indigo-300 text-indigo-900 bg-white hover:bg-indigo-100 justify-start"
                  >
                    Punto Débito ({formatMoneyVES(remainingVES)})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => {
                      setCurrentMethod('CREDIT_CARD');
                      handleAddPayment('CREDIT_CARD', remainingUSD, false, paymentRefInput);
                    }}
                    className="text-[11px] h-8 px-2 border-indigo-300 text-indigo-900 bg-white hover:bg-indigo-100 justify-start"
                  >
                    Punto Crédito ({formatMoneyVES(remainingVES)})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => {
                      setCurrentMethod('PAGO_MOVIL');
                      handleAddPayment('PAGO_MOVIL', remainingUSD, false, paymentRefInput);
                    }}
                    className="text-[11px] h-8 px-2 border-indigo-300 text-indigo-900 bg-white hover:bg-indigo-100 justify-start"
                  >
                    Pago Móvil ({formatMoneyVES(remainingVES)})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => {
                      setCurrentMethod('CASH_VES');
                      handleAddPayment('CASH_VES', remainingUSD, false);
                    }}
                    className="text-[11px] h-8 px-2 border-indigo-300 text-indigo-900 bg-white hover:bg-indigo-100 justify-start"
                  >
                    Efectivo Bs ({formatMoneyVES(remainingVES)})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => {
                      setCurrentMethod('CASH_USD');
                      handleAddPayment('CASH_USD', remainingUSD, false);
                    }}
                    className="text-[11px] h-8 px-2 border-indigo-300 text-indigo-900 bg-white hover:bg-indigo-100 justify-start"
                  >
                    Efectivo $ ({formatMoneyUSD(remainingUSD)})
                  </Button>
                </div>
              </div>
            )}

            {/* Accesos Rápidos de Cobro (1-click para pagar saldo completo con método predilecto) */}
            <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider block">
                Cobro Rápido Total:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentMethod('DEBIT_CARD');
                    handleAddPayment('DEBIT_CARD', remainingUSD, false, paymentRefInput);
                  }}
                  disabled={remainingUSD <= 0.01}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-sky-100 text-sky-800 hover:bg-sky-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Punto Débito ({formatMoneyVES(remainingVES)})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentMethod('CREDIT_CARD');
                    handleAddPayment('CREDIT_CARD', remainingUSD, false, paymentRefInput);
                  }}
                  disabled={remainingUSD <= 0.01}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Punto Crédito ({formatMoneyVES(remainingVES)})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentMethod('PAGO_MOVIL');
                    handleAddPayment('PAGO_MOVIL', remainingUSD, false, paymentRefInput);
                  }}
                  disabled={remainingUSD <= 0.01}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Pago Móvil ({formatMoneyVES(remainingVES)})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentMethod('CASH_USD');
                    handleAddPayment('CASH_USD', remainingUSD, false);
                  }}
                  disabled={remainingUSD <= 0.01}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Efectivo $ ({formatMoneyUSD(remainingUSD)})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentMethod('CASH_VES');
                    handleAddPayment('CASH_VES', remainingUSD, false);
                  }}
                  disabled={remainingUSD <= 0.01}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-neutral-200 text-neutral-800 hover:bg-neutral-300 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Efectivo Bs ({formatMoneyVES(remainingVES)})
                </button>
              </div>
            </div>

            {/* Formulario de Agregar Pago */}
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
                const conf = availablePaymentMethods.find((m) => m.code === currentMethod);
                const showRef = conf ? conf.requiresReference : ['PAGO_MOVIL', 'DEBIT_CARD', 'CREDIT_CARD', 'ZELLE'].includes(currentMethod);
                if (!showRef) return null;
                return (
                  <div>
                    <label className="block text-neutral-600 mb-1">
                      Número de Referencia / Lote Bancario {conf?.requiresReference && <span className="text-red-500">*</span>}
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
                      <div>
                        <span className="font-semibold text-neutral-800">{p.methodName || p.method}</span>
                        {p.referenceNumber && (
                          <span className="font-mono text-[11px] text-neutral-500 ml-1.5">
                            Ref: {p.referenceNumber}
                          </span>
                        )}
                        {p.appliesIGTF && (
                          <span className="text-[10px] text-indigo-600 block">
                            +IGTF 3%: {formatMoneyUSD(p.igtfAmountUSD)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold">{formatMoneyUSD(p.amountUSD)}</span>
                        <span className="font-mono text-neutral-400 text-[10px]">({formatMoneyVES(p.amountVES)})</span>
                        <button
                          onClick={() => removePayment(idx)}
                          className="text-neutral-400 hover:text-red-500 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPaymentModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={isSubmitting || remainingUSD > 0.01}
                onClick={handleProcessSale}
              >
                <Check className="w-4 h-4 mr-1.5" />
                Emitir Factura Fiscal SENIAT
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registrar Nuevo Cliente */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-neutral-800" />
                <h3 className="text-sm font-bold text-neutral-900">Registrar Nuevo Cliente</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 focus-visible:ring-2 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {newCustomerError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {newCustomerError}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
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

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
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
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-sm w-full p-5 shadow-2xl space-y-4 border border-neutral-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  ¿Desea imprimir un ticket de venta?
                </h3>
                <p className="text-xs text-neutral-500">
                  Venta completada en modo no fiscal
                </p>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-xs text-neutral-600 space-y-1">
              <p>
                La venta ha sido registrada exitosamente y el inventario fue actualizado.
              </p>
              <p className="text-[11px] text-neutral-500">
                ¿Desea imprimir el comprobante de entrega para el cliente o continuar con la siguiente transacción?
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
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
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] flex flex-col">
            {/* Encabezado del Modal */}
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-sky-600" />
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Verificación Detallada del Carrito de Compras
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {cart.length} líneas de producto • {cart.reduce((s, i) => s + i.quantity, 0)} unidades • Tasa BCV: Bs. {formatExchangeRate(exchangeRateBCV, 2)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCartReviewModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido / Tabla de Productos */}
            <div className="flex-1 overflow-y-auto">
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
                            <td className="py-2 px-3 font-semibold text-neutral-900">{item.name}</td>
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

            {/* Acciones del Modal */}
            <div className="pt-3 border-t border-neutral-200 flex items-center justify-between">
              <div>
                {cart.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => {
                      if (confirm('¿Está seguro de que desea vaciar todos los productos del carrito?')) {
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

      {/* Modal de Configuración y Gestión de Métodos de Pago */}
      <PaymentMethodsModal
        isOpen={isPaymentMethodsModalOpen}
        onClose={() => setIsPaymentMethodsModalOpen(false)}
        onMethodsUpdated={fetchPaymentMethods}
      />
    </div>
  );
};
