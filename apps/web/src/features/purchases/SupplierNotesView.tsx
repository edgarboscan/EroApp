import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useExchangeRateStore } from '../../stores/exchangeRateStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ProductSearchModal, ProductSearchItem } from '../../components/search';
import { toast } from 'sonner';
import { formatMoneyUSD } from '../../utils/formatters';
import { showConfirmQuestion } from '../../lib/sweetalert';
import {
  FileText,
  Search,
  Plus,
  Truck,
  Building2,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Package,
  Layers,
  ArrowRight,
  Receipt,
  Calendar,
  Eye,
  Ban,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import {
  SupplierNote,
  SupplierNoteType,
  SupplierNoteReasonType,
  SupplierInvoiceOption,
} from '@ero/shared';

interface WarehouseOption {
  id: string;
  name: string;
  code?: string;
}

interface SupplierOption {
  id: string;
  name: string;
  rif: string;
  currentBalance: number;
}

interface PayablePendingOption {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  dueDate: string;
  amountTotal: number;
  amountPaid: number;
  amountBalance: number;
}

export const SupplierNotesView: React.FC = () => {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const liveRate = useExchangeRateStore((state) => state.rate);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const canManageNotes = hasPermission('purchases', 'create') || hasPermission('payables', 'create');
  const exchangeRateBCV = liveRate && liveRate > 0 ? liveRate : 36.5;

  // Estados de datos
  const [notes, setNotes] = useState<SupplierNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isAnnulModalOpen, setIsAnnulModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<SupplierNote | null>(null);

  // Formulario de creación
  const [formType, setFormType] = useState<SupplierNoteType>('CREDIT');
  const [formSupplierId, setFormSupplierId] = useState('');
  const [suppliersList, setSuppliersList] = useState<SupplierOption[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoiceOption[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [formReasonType, setFormReasonType] = useState<SupplierNoteReasonType>('RETURN');
  const [formReasonDescription, setFormReasonDescription] = useState('');
  const [formNoteNumber, setFormNoteNumber] = useState('');
  const [formControlNumber, setFormControlNumber] = useState('');
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [formAutoApply, setFormAutoApply] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Catálogo de productos y buscador
  const [catalogProducts, setCatalogProducts] = useState<ProductSearchItem[]>([]);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<any[]>([]);
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const [activeSearchRowIdx, setActiveSearchRowIdx] = useState<number | null>(null);

  // Cargar catálogo de productos para el select y el buscador
  useEffect(() => {
    if (!token) return;
    const loadProducts = async () => {
      try {
        const res = await fetch('/api/inventory/products', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setCatalogProducts(json.data);
          }
        }
      } catch {
        // Ignorar error de carga de catálogo
      }
    };
    loadProducts();
  }, [token]);

  // Renglones de la nota
  const [items, setItems] = useState<
    Array<{
      productId?: string | null;
      description: string;
      quantity: number;
      unitCost: number;
      taxRate: number;
      returnFromInventory: boolean;
      invoicedQuantity?: number;
      availableQuantity?: number;
    }>
  >([
    {
      productId: null,
      description: '',
      quantity: 1,
      unitCost: 0,
      taxRate: 16.0,
      returnFromInventory: false,
    },
  ]);

  // Modal de Aplicación en CxP
  const [pendingPayables, setPendingPayables] = useState<PayablePendingOption[]>([]);
  const [selectedPayableId, setSelectedPayableId] = useState<string>('');
  const [applyAmount, setApplyAmount] = useState<number>(0);
  const [applyNotes, setApplyNotes] = useState<string>('');
  const [isApplying, setIsApplying] = useState(false);

  // Modal de Anulación
  const [annulReason, setAnnulReason] = useState('');
  const [isAnnulling, setIsAnnulling] = useState(false);

  // Cargar notas con filtros
  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeBranchId) params.append('branchId', activeBranchId);
      if (activeTab !== 'ALL') params.append('type', activeTab);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/supplier-notes?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setNotes(json.data || []);
      } else {
        setNotes([]);
      }
    } catch {
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchNotes();
    }, 300);
    return () => clearTimeout(timer);
  }, [activeBranchId, activeTab, statusFilter, search]);

  // Cargar proveedores y depósitos al inicio
  useEffect(() => {
    const loadPrerequisites = async () => {
      try {
        const [suppRes, whRes] = await Promise.all([
          fetch('/api/suppliers', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/config/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (suppRes.ok) {
          const suppJson = await suppRes.json();
          setSuppliersList(suppJson.data || []);
        }

        if (whRes.ok) {
          const whJson = await whRes.json();
          setWarehouses(whJson.data || []);
          if (whJson.data && whJson.data.length > 0) {
            setFormWarehouseId(whJson.data[0].id);
          }
        }
      } catch {
        // Fallback silencioso
      }
    };

    loadPrerequisites();
  }, [token]);

  // Cuando cambia el proveedor seleccionado en el formulario, cargar sus facturas
  useEffect(() => {
    if (!formSupplierId) {
      setSupplierInvoices([]);
      setSelectedInvoiceId('');
      return;
    }

    const loadSupplierInvoices = async () => {
      try {
        const res = await fetch(`/api/supplier-notes/supplier/${formSupplierId}/invoices`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setSupplierInvoices(json.data || []);
        }
      } catch {
        setSupplierInvoices([]);
      }
    };

    loadSupplierInvoices();
  }, [formSupplierId, token]);

  // Cuando se selecciona una factura de compra afectada, ofrecer importar renglones
  const handleSelectInvoice = async (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    if (!invoiceId) {
      setSelectedInvoiceItems([]);
      return;
    }

    try {
      const res = await fetch(`/api/supplier-notes/invoices/${invoiceId}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const invoiceItems = json.data || [];
        setSelectedInvoiceItems(invoiceItems);
        if (invoiceItems.length > 0) {
          setItems(
            invoiceItems.map((it: any) => ({
              productId: it.productId,
              description: it.productName || it.sku || 'Producto facturado',
              quantity: it.availableQuantity > 0 ? it.availableQuantity : 1,
              unitCost: it.unitCost || 0,
              taxRate: it.taxRate || 16.0,
              returnFromInventory: formReasonType === 'RETURN',
              invoicedQuantity: it.invoicedQuantity,
              availableQuantity: it.availableQuantity,
            }))
          );
          toast.info('Se precargaron los productos de la factura para facilitar la nota');
        }
      }
    } catch {
      // Ignorar error de precarga
    }
  };

  // Cálculos dinámicos del formulario
  const formCalculations = useMemo(() => {
    let subtotal = 0;
    let tax = 0;

    for (const it of items) {
      const lineSubtotal = Number((it.quantity * it.unitCost).toFixed(2));
      const lineTax = Number(((lineSubtotal * it.taxRate) / 100).toFixed(2));
      subtotal += lineSubtotal;
      tax += lineTax;
    }

    const total = Number((subtotal + tax).toFixed(2));
    return { subtotal, tax, total };
  }, [items]);

  // Manejo de renglones
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: null,
        description: '',
        quantity: 1,
        unitCost: 0,
        taxRate: 16.0,
        returnFromInventory: formReasonType === 'RETURN',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.warning('La nota debe contener al menos un renglón');
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Buscador de productos en catálogo (ProductSearchModal)
  const handleOpenProductSearch = (idx: number | null) => {
    setActiveSearchRowIdx(idx);
    setIsProductSearchOpen(true);
  };

  const handleSelectProductFromModal = (prod: ProductSearchItem) => {
    const cost = Number(prod.defaultCost ?? prod.cost ?? prod.costPrice ?? 0);
    const tax = Number(prod.taxRate ?? 16.0);

    if (activeSearchRowIdx !== null) {
      setItems((prev) => {
        const next = [...prev];
        if (next[activeSearchRowIdx]) {
          next[activeSearchRowIdx] = {
            ...next[activeSearchRowIdx],
            productId: prod.id,
            description: prod.name,
            unitCost: cost > 0 ? cost : next[activeSearchRowIdx].unitCost,
            taxRate: tax,
          };
        }
        return next;
      });
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: prod.id,
          description: prod.name,
          quantity: 1,
          unitCost: cost,
          taxRate: tax,
          returnFromInventory: formReasonType === 'RETURN',
        },
      ]);
      toast.success(`Producto "${prod.name}" añadido a la nota`);
    }
    setIsProductSearchOpen(false);
    setActiveSearchRowIdx(null);
  };

  // Selección rápida de producto mediante el <select>
  const handleProductSelect = (idx: number, productId: string) => {
    if (!productId) {
      handleItemChange(idx, 'productId', null);
      return;
    }

    // Verificar si es un ítem de la factura de compra afectada
    const invItem = selectedInvoiceItems.find((it) => it.productId === productId);
    if (invItem) {
      setItems((prev) => {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          productId: invItem.productId,
          description: invItem.productName || invItem.sku || next[idx].description,
          unitCost: Number(invItem.unitCost || 0),
          taxRate: Number(invItem.taxRate || 16.0),
          quantity: invItem.availableQuantity > 0 ? Number(invItem.availableQuantity) : next[idx].quantity,
          invoicedQuantity: invItem.invoicedQuantity,
          availableQuantity: invItem.availableQuantity,
        };
        return next;
      });
      return;
    }

    // Verificar si es del catálogo general de productos
    const catItem = catalogProducts.find((p) => p.id === productId);
    if (catItem) {
      const cost = Number(catItem.defaultCost ?? catItem.cost ?? catItem.costPrice ?? 0);
      const tax = Number(catItem.taxRate ?? 16.0);
      setItems((prev) => {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          productId: catItem.id,
          description: catItem.name,
          unitCost: cost > 0 ? cost : next[idx].unitCost,
          taxRate: tax,
        };
        return next;
      });
    }
  };

  // Abrir Modal de Creación
  const handleOpenCreateModal = () => {
    setFormType('CREDIT');
    setFormSupplierId('');
    setSelectedInvoiceId('');
    setSelectedInvoiceItems([]);
    setFormReasonType('RETURN');
    setFormReasonDescription('');
    setFormNoteNumber('');
    setFormControlNumber('');
    setFormAutoApply(true);
    setItems([
      {
        productId: null,
        description: '',
        quantity: 1,
        unitCost: 0,
        taxRate: 16.0,
        returnFromInventory: true,
      },
    ]);
    setIsCreateModalOpen(true);
  };

  // Enviar Creación de Nota
  const handleSubmitCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupplierId) {
      toast.error('Debe seleccionar un proveedor');
      return;
    }
    if (!activeBranchId) {
      toast.error('No se ha detectado una sucursal activa');
      return;
    }
    if (formCalculations.total <= 0) {
      toast.error('El monto total de la nota debe ser superior a 0');
      return;
    }

    const payload = {
      branchId: activeBranchId,
      supplierId: formSupplierId,
      type: formType,
      warehouseId: formWarehouseId || null,
      affectedInvoiceId: selectedInvoiceId || null,
      noteNumber: formNoteNumber.trim() || null,
      controlNumber: formControlNumber.trim() || null,
      reasonType: formReasonType,
      reasonDescription: formReasonDescription.trim() || 'Emisión de nota comercial',
      currency: 'USD',
      exchangeRate: exchangeRateBCV,
      autoApplyToInvoice: formAutoApply,
      items: items.map((it) => ({
        productId: it.productId || null,
        description: it.description.trim() || 'Concepto comercial',
        quantity: Number(it.quantity),
        unitCost: Number(it.unitCost),
        taxRate: Number(it.taxRate),
        returnFromInventory: Boolean(it.returnFromInventory),
      })),
    };

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/supplier-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        toast.success(
          formType === 'CREDIT'
            ? `Nota de Crédito ${json.data.noteNumber} emitida correctamente`
            : `Nota de Débito ${json.data.noteNumber} emitida correctamente`
        );
        setIsCreateModalOpen(false);
        fetchNotes();
      } else {
        const err = await res.json();
        toast.error(err.error?.message || 'Error al emitir la nota');
      }
    } catch {
      toast.error('Error de conexión al procesar la nota');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir Modal de Aplicación de Saldo de Nota de Crédito
  const handleOpenApplyModal = async (note: SupplierNote) => {
    setSelectedNote(note);
    setSelectedPayableId('');
    setApplyAmount(note.availableBalance);
    setApplyNotes('');
    setIsApplyModalOpen(true);

    try {
      const res = await fetch(`/api/payables?supplierId=${note.supplierId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const pending = (json.data || []).filter((p: any) => p.amountBalance > 0);
        setPendingPayables(pending);
        if (pending.length > 0) {
          setSelectedPayableId(pending[0].id);
          const maxApply = Math.min(note.availableBalance, pending[0].amountBalance);
          setApplyAmount(Number(maxApply.toFixed(2)));
        }
      }
    } catch {
      setPendingPayables([]);
    }
  };

  // Cambiar cuenta por pagar seleccionada en el modal de aplicación
  const handleSelectPayable = (payableId: string) => {
    setSelectedPayableId(payableId);
    const pay = pendingPayables.find((p) => p.id === payableId);
    if (pay && selectedNote) {
      const maxApply = Math.min(selectedNote.availableBalance, pay.amountBalance);
      setApplyAmount(Number(maxApply.toFixed(2)));
    }
  };

  // Confirmar Aplicación de Nota de Crédito
  const handleSubmitApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNote || !selectedPayableId) {
      toast.error('Seleccione una cuenta por pagar para amortizar');
      return;
    }
    if (applyAmount <= 0) {
      toast.error('El monto a aplicar debe ser mayor a 0');
      return;
    }

    setIsApplying(true);
    try {
      const res = await fetch('/api/supplier-notes/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          noteId: selectedNote.id,
          payableId: selectedPayableId,
          amount: Number(applyAmount),
          notes: applyNotes.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast.success('Nota de Crédito aplicada satisfactoriamente a la cuenta por pagar');
        setIsApplyModalOpen(false);
        fetchNotes();
      } else {
        const err = await res.json();
        toast.error(err.error?.message || 'Error al aplicar Nota de Crédito');
      }
    } catch {
      toast.error('Error de conexión al aplicar crédito');
    } finally {
      setIsApplying(false);
    }
  };

  // Abrir Modal de Detalle
  const handleOpenDetailModal = async (note: SupplierNote) => {
    try {
      const res = await fetch(`/api/supplier-notes/${note.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setSelectedNote(json.data);
      } else {
        setSelectedNote(note);
      }
    } catch {
      setSelectedNote(note);
    }
    setIsDetailModalOpen(true);
  };

  // Abrir Modal de Anulación
  const handleOpenAnnulModal = (note: SupplierNote) => {
    setSelectedNote(note);
    setAnnulReason('');
    setIsAnnulModalOpen(true);
  };

  // Confirmar Anulación
  const handleSubmitAnnul = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNote || !annulReason.trim()) {
      toast.error('Debe especificar un motivo de anulación válido');
      return;
    }

    const confirmed = await showConfirmQuestion({
      title: '¿Confirmar anulación?',
      text: `Se anulará la nota ${selectedNote.noteNumber}. Se revertirán las amortizaciones en cuentas por pagar y movimientos de inventario asociados.`,
      confirmButtonText: 'Sí, anular nota',
      cancelButtonText: 'Cancelar',
      icon: 'warning',
    });
    if (!confirmed) return;

    setIsAnnulling(true);
    try {
      const res = await fetch(`/api/supplier-notes/${selectedNote.id}/annul`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: annulReason.trim() }),
      });

      if (res.ok) {
        toast.success(`Nota ${selectedNote.noteNumber} anulada correctamente`);
        setIsAnnulModalOpen(false);
        fetchNotes();
      } else {
        const err = await res.json();
        toast.error(err.error?.message || 'Error al anular la nota');
      }
    } catch {
      toast.error('Error de conexión al anular la nota');
    } finally {
      setIsAnnulling(false);
    }
  };

  // Totales KPI
  const kpiData = useMemo(() => {
    let creditTotal = 0;
    let availableCreditTotal = 0;
    let debitTotal = 0;
    let appliedCount = 0;

    for (const n of notes) {
      if (n.status !== 'ANNULLED') {
        if (n.type === 'CREDIT') {
          creditTotal += n.totalAmount;
          availableCreditTotal += n.availableBalance;
          if (n.status === 'APPLIED') appliedCount++;
        } else {
          debitTotal += n.totalAmount;
        }
      }
    }

    return {
      creditTotal,
      availableCreditTotal,
      debitTotal,
      appliedCount,
    };
  }, [notes]);

  // Filtrado de proveedores en el buscador del formulario
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliersList.slice(0, 30);
    const q = supplierSearch.toLowerCase();
    return suppliersList.filter(
      (s) => s.name.toLowerCase().includes(q) || s.rif.toLowerCase().includes(q)
    );
  }, [suppliersList, supplierSearch]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-800 dark:text-neutral-100 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-600" />
            Notas de Crédito y Débito a Proveedores
          </h1>
          <p className="text-sm text-neutral-500">
            Devoluciones a proveedores, descuentos, fletes y compensación con Cuentas por Pagar (CxP)
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/payables')}
            className="flex-1 sm:flex-none rounded-lg"
          >
            <Clock className="w-4 h-4 mr-1 text-neutral-600" />
            Ver CxP
          </Button>
          {canManageNotes && (
            <Button
              size="sm"
              onClick={handleOpenCreateModal}
              className="flex-1 sm:flex-none rounded-lg bg-sky-600 hover:bg-sky-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nueva Nota
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-emerald-500 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Total Notas de Crédito
              </p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-500 mt-1">
                {formatMoneyUSD(kpiData.creditTotal)}
              </p>
              <span className="text-xs text-neutral-500">A favor de la empresa</span>
            </div>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-sky-500 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Saldo a Favor Disponible
              </p>
              <p className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1">
                {formatMoneyUSD(kpiData.availableCreditTotal)}
              </p>
              <span className="text-xs text-sky-600 font-medium">Por aplicar en CxP</span>
            </div>
            <div className="p-2 bg-sky-50 dark:bg-sky-950/40 rounded-lg text-sky-600 dark:text-sky-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Total Notas de Débito
              </p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-500 mt-1">
                {formatMoneyUSD(kpiData.debitTotal)}
              </p>
              <span className="text-xs text-neutral-500">Recargos y mayor deuda</span>
            </div>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-purple-500 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Créditos Compensados
              </p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {kpiData.appliedCount}
              </p>
              <span className="text-xs text-neutral-500">Notas aplicadas totalmente</span>
            </div>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 rounded-lg text-purple-600 dark:text-purple-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Control Bar: Tabs and Search Filters */}
      <Card className="p-4 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-lg">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 border-b lg:border-b-0 border-neutral-200 dark:border-neutral-800 pb-2 lg:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'ALL'
                  ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
              }`}
            >
              Todas las Notas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('CREDIT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'CREDIT'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
              }`}
            >
              Notas de Crédito (NC)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('DEBIT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'DEBIT'
                  ? 'bg-amber-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
              }`}
            >
              Notas de Débito (ND)
            </button>
          </div>

          {/* Search & Status Filter */}
          <div className="flex flex-1 items-center gap-2 max-w-xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar por número de nota, RIF, proveedor o factura..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 text-xs border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-neutral-800 dark:text-neutral-200"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="ACTIVE">Activa (Con saldo)</option>
              <option value="APPLIED">Aplicada Total</option>
              <option value="ANNULLED">Anulada</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Table */}
      <Card className="border-neutral-200 dark:border-neutral-800 overflow-hidden rounded-lg bg-white dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 uppercase text-xs tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4">Nota / Tipo</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Proveedor</th>
                <th className="py-3 px-4">Factura Afectada</th>
                <th className="py-3 px-4">Motivo</th>
                <th className="py-3 px-4 text-right">Total Nota</th>
                <th className="py-3 px-4 text-right">Saldo Disponible</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3 px-4">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-28 mb-1" />
                      <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded w-16" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-20" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-36 mb-1" />
                      <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded w-20" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-28" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-16 ml-auto" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-16 ml-auto" />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-16 mx-auto" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="h-7 bg-neutral-200 dark:bg-neutral-700 rounded w-28 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : notes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-neutral-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="font-medium text-neutral-600 dark:text-neutral-400">
                      No se encontraron notas de proveedores
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Ajusta los filtros o registra una nueva nota con el botón superior.
                    </p>
                  </td>
                </tr>
              ) : (
                notes.map((note) => {
                  const isCredit = note.type === 'CREDIT';

                  return (
                    <tr
                      key={note.id}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                          {isCredit ? (
                            <span className="p-1 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                              <ArrowDownRight className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="p-1 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <span>{note.noteNumber}</span>
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          {isCredit ? 'Nota de Crédito' : 'Nota de Débito'}
                          {note.controlNumber ? ` | Ctrl: ${note.controlNumber}` : ''}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-neutral-600 dark:text-neutral-400">
                        {note.noteDate ? new Date(note.noteDate).toLocaleDateString() : '-'}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {note.supplierName}
                        </div>
                        <div className="text-[11px] font-mono text-sky-600 dark:text-sky-400">
                          {note.supplierRif}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {note.affectedInvoiceNumber ? (
                          <div className="font-mono text-neutral-800 dark:text-neutral-200">
                            Fac: {note.affectedInvoiceNumber}
                          </div>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <Badge variant="neutral">
                          {note.reasonType === 'RETURN'
                            ? 'Devolución'
                            : note.reasonType === 'DISCOUNT'
                            ? 'Descuento'
                            : note.reasonType === 'PRICE_CORRECTION'
                            ? 'Corrección'
                            : note.reasonType === 'FREIGHT_SURCHARGE'
                            ? 'Flete/Recargo'
                            : note.reasonType === 'LATE_FEE'
                            ? 'Interés'
                            : 'Otro'}
                        </Badge>
                        {note.reasonDescription && (
                          <div className="text-[11px] text-neutral-500 truncate max-w-[160px] mt-0.5">
                            {note.reasonDescription}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span
                          className={
                            isCredit
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {formatMoneyUSD(note.totalAmount)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono">
                        {isCredit ? (
                          note.availableBalance > 0.009 ? (
                            <span className="font-bold text-sky-600 dark:text-sky-400">
                              {formatMoneyUSD(note.availableBalance)}
                            </span>
                          ) : (
                            <span className="text-neutral-400">$0.00</span>
                          )
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={
                            note.status === 'APPLIED'
                              ? 'success'
                              : note.status === 'ACTIVE'
                              ? 'info'
                              : 'danger'
                          }
                        >
                          {note.status === 'ACTIVE'
                            ? 'Activa'
                            : note.status === 'APPLIED'
                            ? 'Aplicada'
                            : 'Anulada'}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Botón Aplicar Crédito */}
                          {isCredit && note.status === 'ACTIVE' && note.availableBalance > 0.009 && canManageNotes && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenApplyModal(note)}
                              className="h-7 px-2 text-xs text-sky-600 border-sky-300 dark:border-sky-800 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-lg"
                              title="Aplicar saldo a Cuenta por Pagar"
                            >
                              <Layers className="w-3.5 h-3.5 mr-1" />
                              Aplicar
                            </Button>
                          )}

                          {/* Botón Ver Detalle */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDetailModal(note)}
                            className="h-7 px-2 text-xs rounded-lg"
                            title="Ver desglose e ítems"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>

                          {/* Botón Anular */}
                          {note.status !== 'ANNULLED' && canManageNotes && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenAnnulModal(note)}
                              className="h-7 px-2 text-xs text-red-600 hover:text-red-700 border-red-200 dark:border-red-900 rounded-lg"
                              title="Anular nota"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL: EMITIR NOTA DE CRÉDITO O DÉBITO */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Registrar Nota de Proveedor"
        subtitle="Emisión de Nota de Crédito o Débito con impacto en inventario y Cuentas por Pagar"
        size="4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs">
              <span className="text-neutral-500">Total Nota: </span>
              <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100 font-mono">
                {formatMoneyUSD(formCalculations.total)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                type="submit"
                form="createNoteForm"
                disabled={isSubmitting}
                className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white"
              >
                {isSubmitting ? 'Procesando...' : 'Emitir Nota'}
              </Button>
            </div>
          </div>
        }
      >
        <form
          id="createNoteForm"
          onSubmit={handleSubmitCreateNote}
          className="space-y-4 text-xs"
        >
          {/* Tipo de Nota Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setFormType('CREDIT');
                setFormReasonType('RETURN');
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                formType === 'CREDIT'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              Nota de Crédito (Disminuye deuda / Saldo a favor)
            </button>
            <button
              type="button"
              onClick={() => {
                setFormType('DEBIT');
                setFormReasonType('FREIGHT_SURCHARGE');
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                formType === 'DEBIT'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              Nota de Débito (Aumenta deuda por pagar)
            </button>
          </div>

          {/* Proveedor y Factura Afectada */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Proveedor *
              </label>
              <select
                value={formSupplierId}
                onChange={(e) => setFormSupplierId(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                <option value="">-- Seleccionar Proveedor --</option>
                {filteredSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.rif}] {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Factura de Compra Afectada (Opcional)
              </label>
              <select
                value={selectedInvoiceId}
                onChange={(e) => handleSelectInvoice(e.target.value)}
                disabled={!formSupplierId}
                className="w-full px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 disabled:opacity-50"
              >
                <option value="">-- Sin Factura Afectada / Ajuste Directo --</option>
                {supplierInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    Factura: {inv.invoiceNumber} ({inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : ''}) - Total: ${inv.totalAmount.toFixed(2)}
                    {typeof inv.payableBalance === 'number' ? ` | Saldo CxP: $${inv.payableBalance.toFixed(2)}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Motivo y Datos Fiscales */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Motivo de la Nota *
              </label>
              <select
                value={formReasonType}
                onChange={(e) => setFormReasonType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                {formType === 'CREDIT' ? (
                  <>
                    <option value="RETURN">Devolución de Mercancía</option>
                    <option value="DISCOUNT">Descuento o Bonificación</option>
                    <option value="PRICE_CORRECTION">Corrección de Precio Facturado</option>
                    <option value="OTHER">Otro Concepto de Crédito</option>
                  </>
                ) : (
                  <>
                    <option value="FREIGHT_SURCHARGE">Flete o Recargo de Transporte</option>
                    <option value="LATE_FEE">Intereses o Gastos de Cobranza</option>
                    <option value="PRICE_CORRECTION">Ajuste por Mayor Precio</option>
                    <option value="OTHER">Otro Concepto de Débito</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                N° Nota del Proveedor (Opcional)
              </label>
              <Input
                placeholder="Ej. NC-009842 (automático si vacío)"
                value={formNoteNumber}
                onChange={(e) => setFormNoteNumber(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                N° Control SENIAT (Opcional)
              </label>
              <Input
                placeholder="00-0012345"
                value={formControlNumber}
                onChange={(e) => setFormControlNumber(e.target.value)}
              />
            </div>
          </div>

          {/* Almacén de Devolución & Auto-aplicación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Almacén para Descargo de Inventario
              </label>
              <select
                value={formWarehouseId}
                onChange={(e) => setFormWarehouseId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.code ? `(${w.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-center">
              {formType === 'CREDIT' && selectedInvoiceId ? (
                <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer mt-3">
                  <input
                    type="checkbox"
                    checked={formAutoApply}
                    onChange={(e) => setFormAutoApply(e.target.checked)}
                    className="w-4 h-4 text-sky-600 rounded accent-sky-600"
                  />
                  Aplicar automáticamente a la cuenta por pagar de la factura
                </label>
              ) : (
                <p className="text-[11px] text-neutral-500 mt-2">
                  {formType === 'CREDIT'
                    ? 'El monto total quedará disponible como saldo a favor para amortizar futuras cuentas por pagar.'
                    : 'Se generará o actualizará la obligación de pago en Cuentas por Pagar.'}
                </p>
              )}
            </div>
          </div>

          {/* Descripción / Justificación */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Descripción detallada o Justificación *
            </label>
            <input
              type="text"
              required
              placeholder="Explicación clara del motivo de la nota..."
              value={formReasonDescription}
              onChange={(e) => setFormReasonDescription(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          {/* Renglones de la Nota */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-neutral-800 dark:text-neutral-200">
                Renglones / Conceptos de la Nota ({items.length})
              </h4>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenProductSearch(null)}
                  className="h-7 text-xs rounded-lg text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-800 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                >
                  <Search className="w-3.5 h-3.5 mr-1" />
                  Buscar en Catálogo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="h-7 text-xs rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5 mr-1 text-sky-600" />
                  Agregar Renglón
                </Button>
              </div>
            </div>

            <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 uppercase">
                  <tr>
                    <th className="py-2 px-3">Descripción / Producto</th>
                    <th className="py-2 px-3 text-center w-24">Cantidad</th>
                    <th className="py-2 px-3 text-right w-28">Costo ($ USD)</th>
                    <th className="py-2 px-3 text-center w-20">% IVA</th>
                    <th className="py-2 px-3 text-right w-28">Subtotal</th>
                    {formType === 'CREDIT' && (
                      <th className="py-2 px-3 text-center w-24">Descargar Stock</th>
                    )}
                    <th className="py-2 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                      <td className="py-2 px-3 min-w-[280px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <select
                              value={it.productId || ''}
                              onChange={(e) => handleProductSelect(idx, e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            >
                              <option value="">-- Concepto manual / Seleccionar producto --</option>
                              {selectedInvoiceItems.length > 0 && (
                                <optgroup label="Ítems de la Factura de Compra">
                                  {selectedInvoiceItems.map((invItem) => (
                                    <option key={`inv-${invItem.productId || invItem.sku}`} value={invItem.productId}>
                                      [Facturado] {invItem.sku ? `${invItem.sku} - ` : ''}{invItem.productName} (Disp: {invItem.availableQuantity})
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              <optgroup label="Catálogo General de Productos">
                                {catalogProducts.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.sku ? `${p.sku} - ` : ''}{p.name}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenProductSearch(idx)}
                              title="Buscar producto en catálogo"
                              className="h-7 px-2 shrink-0 rounded-lg border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                              <Search className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
                            </Button>
                          </div>
                          <input
                            type="text"
                            required
                            placeholder="Descripción o concepto del ítem..."
                            value={it.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-mono" 

                          />
                        </div>
                      </td>

                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          value={it.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                          className="w-full px-2 py-1 text-xs text-center border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 font-mono"
                        />
                      </td>

                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          required
                          value={it.unitCost}
                          onChange={(e) => handleItemChange(idx, 'unitCost', Number(e.target.value))}
                          className="w-full px-2 py-1 text-xs text-right border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 font-mono"
                        />
                      </td>

                      <td className="py-2 px-3 text-center">
                        <select
                          value={it.taxRate}
                          onChange={(e) => handleItemChange(idx, 'taxRate', Number(e.target.value))}
                          className="w-full px-1.5 py-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-center"
                        >
                          <option value="16">16%</option>
                          <option value="8">8%</option>
                          <option value="0">0%</option>
                        </select>
                      </td>

                      <td className="py-2 px-3 text-right font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                        {formatMoneyUSD(it.quantity * it.unitCost)}
                      </td>

                      {formType === 'CREDIT' && (
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={it.returnFromInventory}
                            onChange={(e) =>
                              handleItemChange(idx, 'returnFromInventory', e.target.checked)
                            }
                            className="w-4 h-4 text-sky-600 rounded accent-sky-600"
                            title="Descargar del stock por devolución"
                          />
                        </td>
                      )}

                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-red-500 hover:text-red-700 transition-colors"
                          title="Eliminar renglón"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Subtotales */}
            <div className="mt-2 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 flex justify-end gap-6 text-xs">
              <div>
                <span className="text-neutral-500">Subtotal: </span>
                <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">
                  {formatMoneyUSD(formCalculations.subtotal)}
                </span>
              </div>
              <div>
                <span className="text-neutral-500">Impuesto (IVA): </span>
                <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">
                  {formatMoneyUSD(formCalculations.tax)}
                </span>
              </div>
              <div>
                <span className="text-neutral-500">Total: </span>
                <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                  {formatMoneyUSD(formCalculations.total)}
                </span>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL: APLICAR NOTA DE CRÉDITO A CUENTA POR PAGAR */}
      <Modal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        title="Aplicar Saldo de Nota de Crédito"
        subtitle={`Amortización de deuda para ${selectedNote?.supplierName || ''} - Saldo disponible: ${formatMoneyUSD(selectedNote?.availableBalance || 0)}`}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsApplyModalOpen(false)}
              className="rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              type="submit"
              form="applyCreditForm"
              disabled={isApplying || !selectedPayableId || applyAmount <= 0}
              className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white"
            >
              {isApplying ? 'Aplicando...' : 'Confirmar Amortización'}
            </Button>
          </div>
        }
      >
        <form id="applyCreditForm" onSubmit={handleSubmitApply} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Seleccionar Cuenta por Pagar Pendiente *
            </label>
            {pendingPayables.length === 0 ? (
              <p className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-lg border border-amber-200 dark:border-amber-900">
                Este proveedor no tiene cuentas por pagar con saldo pendiente en este momento.
              </p>
            ) : (
              <select
                value={selectedPayableId}
                onChange={(e) => handleSelectPayable(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                {pendingPayables.map((p) => (
                  <option key={p.id} value={p.id}>
                    Factura: {p.invoiceNumber} | Vence: {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '-'} | Saldo Pendiente: ${p.amountBalance.toFixed(2)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Monto a Amortizar ($ USD) *
              </label>
              <button
                type="button"
                onClick={() => {
                  const pay = pendingPayables.find((p) => p.id === selectedPayableId);
                  if (pay && selectedNote) {
                    const max = Math.min(selectedNote.availableBalance, pay.amountBalance);
                    setApplyAmount(Number(max.toFixed(2)));
                  }
                }}
                className="text-[11px] text-sky-600 hover:underline font-medium"
              >
                Amortizar máximo posible
              </button>
            </div>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={applyAmount}
              onChange={(e) => setApplyAmount(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Notas u Observaciones
            </label>
            <Input
              placeholder="Ej. Compensación acordada por devolución parcial"
              value={applyNotes}
              onChange={(e) => setApplyNotes(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* MODAL: DETALLE COMPLETO DE LA NOTA */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Detalle de ${selectedNote?.type === 'CREDIT' ? 'Nota de Crédito' : 'Nota de Débito'}: ${selectedNote?.noteNumber || ''}`}
        subtitle={`Proveedor: ${selectedNote?.supplierName || ''} (${selectedNote?.supplierRif || ''})`}
        size="lg"
        footer={
          <div className="flex items-center justify-end w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDetailModalOpen(false)}
              className="rounded-lg"
            >
              Cerrar
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Header Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <div>
              <span className="text-neutral-500 block">Total Nota:</span>
              <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100 font-mono">
                {formatMoneyUSD(selectedNote?.totalAmount || 0)}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block">Saldo Disponible:</span>
              <span className="font-bold text-sm text-sky-600 dark:text-sky-400 font-mono">
                {formatMoneyUSD(selectedNote?.availableBalance || 0)}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block">Estado:</span>
              <Badge
                variant={
                  selectedNote?.status === 'APPLIED'
                    ? 'success'
                    : selectedNote?.status === 'ACTIVE'
                    ? 'info'
                    : 'danger'
                }
              >
                {selectedNote?.status}
              </Badge>
            </div>
            <div>
              <span className="text-neutral-500 block">Fecha:</span>
              <span className="font-mono text-neutral-700 dark:text-neutral-300">
                {selectedNote?.noteDate ? new Date(selectedNote.noteDate).toLocaleDateString() : '-'}
              </span>
            </div>
          </div>

          {/* Justificación */}
          {selectedNote?.reasonDescription && (
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                Motivo / Justificación:
              </span>
              <p className="text-neutral-600 dark:text-neutral-400">
                {selectedNote.reasonDescription}
              </p>
            </div>
          )}

          {/* Renglones */}
          <div>
            <h4 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
              Renglones de la Nota ({selectedNote?.items?.length || 0})
            </h4>
            <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 uppercase">
                  <tr>
                    <th className="py-2 px-3">Descripción</th>
                    <th className="py-2 px-3 text-center">Cant.</th>
                    <th className="py-2 px-3 text-right">Costo Unit.</th>
                    <th className="py-2 px-3 text-center">% IVA</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {selectedNote?.items?.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 px-3 font-medium text-neutral-800 dark:text-neutral-200">
                        {it.description}
                        {it.returnFromInventory && (
                          <span className="ml-1 text-[10px] text-amber-600 font-normal">
                            (Devuelto a inventario)
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-mono">{it.quantity}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatMoneyUSD(it.unitCost)}</td>
                      <td className="py-2 px-3 text-center font-mono">{it.taxRate}%</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                        {formatMoneyUSD(it.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Historial de Aplicaciones en CxP */}
          {selectedNote?.type === 'CREDIT' && selectedNote.applications && selectedNote.applications.length > 0 && (
            <div>
              <h4 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
                Amortizaciones en Cuentas por Pagar ({selectedNote.applications.length})
              </h4>
              <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 uppercase">
                    <tr>
                      <th className="py-2 px-3">Fecha Aplicación</th>
                      <th className="py-2 px-3">Factura Amortizada</th>
                      <th className="py-2 px-3">Usuario</th>
                      <th className="py-2 px-3 text-right">Monto Amortizado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {selectedNote.applications.map((ap) => (
                      <tr key={ap.id}>
                        <td className="py-2 px-3 font-mono text-neutral-600 dark:text-neutral-400">
                          {ap.appliedDate ? new Date(ap.appliedDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-2 px-3 font-mono font-medium text-sky-600">
                          {ap.invoiceNumber || 'Factura CxP'}
                        </td>
                        <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400">
                          {ap.userName || 'Sistema'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                          {formatMoneyUSD(ap.amountApplied)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL: ANULACIÓN DE NOTA */}
      <Modal
        isOpen={isAnnulModalOpen}
        onClose={() => setIsAnnulModalOpen(false)}
        title={`Anular Nota ${selectedNote?.noteNumber || ''}`}
        subtitle="Esta acción es irreversible y revertirá saldos en cuentas por pagar e inventario"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsAnnulModalOpen(false)}
              className="rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              type="submit"
              form="annulNoteForm"
              disabled={isAnnulling || !annulReason.trim()}
              className="rounded-lg bg-red-600 hover:bg-red-700 text-white"
            >
              {isAnnulling ? 'Anulando...' : 'Confirmar Anulación'}
            </Button>
          </div>
        }
      >
        <form id="annulNoteForm" onSubmit={handleSubmitAnnul} className="space-y-4 text-xs">
          <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300">
            <p className="font-semibold mb-1">Advertencia de control contable:</p>
            <p>
              Si la nota tiene aplicaciones registradas en Cuentas por Pagar, los saldos adeudados a este proveedor se restablecerán. Si se realizó devolución física a inventario, el stock será repuesto.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Motivo de la Anulación *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Explique el motivo por el cual se anula este documento fiscal..."
              value={annulReason}
              onChange={(e) => setAnnulReason(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </form>
      </Modal>

      {/* MODAL: BUSCADOR DE PRODUCTOS EN CATÁLOGO */}
      <ProductSearchModal
        isOpen={isProductSearchOpen}
        onClose={() => {
          setIsProductSearchOpen(false);
          setActiveSearchRowIdx(null);
        }}
        onSelect={handleSelectProductFromModal}
        products={catalogProducts}
        mode="purchase"
        title="Buscador de Productos para Nota de Proveedor"
        subtitle="Busque por código SKU, código de barras o nombre comercial para cargar al comprobante"
      />
    </div>
  );
};
