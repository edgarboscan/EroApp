import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useExchangeRateStore } from '../../stores/exchangeRateStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CustomerSearchModal } from '../../components/search/CustomerSearchModal';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';
import { toast } from 'sonner';
import {
  FileText,
  Plus,
  Search,
  Filter,
  ArrowRight,
  Eye,
  Printer,
  Ban,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Receipt,
  RotateCcw,
  Building2,
  Trash2,
  Download,
  Calendar,
} from 'lucide-react';
import {
  CustomerNote,
  CustomerNoteType,
  CustomerNoteReasonType,
  CreateCustomerNoteInput,
} from '@ero/shared';
import { formatMoneyUSD } from '../../utils/formatters';

interface CustomerInvoiceOption {
  id: string;
  invoiceNumber: string;
  controlNumber?: string | null;
  invoiceDate: string;
  currency: string;
  exchangeRate: number;
  totalAmount: number;
  status: string;
  pendingBalance: number;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

export const CustomerNotesView: React.FC = () => {
  const token = useAuthStore((state) => state.token);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const liveRate = useExchangeRateStore((state) => state.rate);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canManageNotes = hasPermission('sales', 'credit_notes');
  const canApplyCredits = hasPermission('receivables', 'create');
  const exchangeRateBCV = liveRate && liveRate > 0 ? liveRate : 37.0;

  // Estados de datos
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isAnnulModalOpen, setIsAnnulModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<CustomerNote | null>(null);

  // Formulario de creación
  const [formType, setFormType] = useState<CustomerNoteType>('CREDIT');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerDoc, setFormCustomerDoc] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerInvoices, setCustomerInvoices] = useState<CustomerInvoiceOption[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [formReasonType, setFormReasonType] = useState<CustomerNoteReasonType>('RETURN');
  const [formReasonDescription, setFormReasonDescription] = useState('');
  const [formControlNumber, setFormControlNumber] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [formAutoApply, setFormAutoApply] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Renglones de la nota
  const [items, setItems] = useState<
    Array<{
      productId?: string | null;
      description: string;
      quantity: number;
      unitPrice: number;
      taxRate: number;
      returnToInventory: boolean;
      invoicedQuantity?: number;
      alreadyCreditedQuantity?: number;
      availableQuantity?: number;
    }>
  >([
    {
      productId: null,
      description: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: 16.0,
      returnToInventory: false,
    },
  ]);

  // Estado para modal de aplicación
  const [applyReceivables, setApplyReceivables] = useState<any[]>([]);
  const [selectedReceivableId, setSelectedReceivableId] = useState<string>('');
  const [applyAmount, setApplyAmount] = useState<number>(0);
  const [applyNotes, setApplyNotes] = useState<string>('');
  const [isApplying, setIsApplying] = useState(false);

  // Estado para modal de anulación
  const [annulReason, setAnnulReason] = useState('');
  const [isAnnulling, setIsAnnulling] = useState(false);

  // Estado para visor y generador oficial de PDF
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    endpoint: string;
    title: string;
    filename: string;
  }>({
    isOpen: false,
    endpoint: '',
    title: '',
    filename: '',
  });

  const handleOpenPdf = (note: CustomerNote) => {
    setPdfModal({
      isOpen: true,
      endpoint: `/api/customer-notes/${note.id}/pdf`,
      title: `${note.type === 'CREDIT' ? 'Nota de Crédito' : 'Nota de Débito'} ${note.noteNumber}`,
      filename: `${note.noteNumber}.pdf`,
    });
  };

  // Cargar notas principales
  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      let url = '/api/customer-notes?';
      if (activeBranchId) url += `branchId=${activeBranchId}&`;
      if (activeTab !== 'ALL') url += `type=${activeTab}&`;
      if (statusFilter !== 'ALL') url += `status=${statusFilter}&`;
      if (search.trim()) url += `search=${encodeURIComponent(search.trim())}&`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setNotes(json.data);
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
    fetchNotes();
  }, [activeBranchId, activeTab, statusFilter, token]);

  // Cargar almacenes disponibles desde las sucursales del usuario
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await fetch('/api/auth/branches', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const branchList = json.data;
          const allWh: WarehouseOption[] = [];
          let defaultSalesWhId = '';

          // 1. Filtrar o priorizar por la sucursal activa
          branchList.forEach((b: any) => {
            if (Array.isArray(b.warehouses)) {
              b.warehouses.forEach((w: any) => {
                const isCurrentBranch = !activeBranchId || b.id === activeBranchId;
                if (isCurrentBranch) {
                  allWh.push({
                    id: w.id,
                    name: branchList.length > 1 ? `${b.name} - ${w.name}` : w.name,
                    code: w.code || '',
                  });
                  if ((w.isDefaultSales || w.isDefault) && !defaultSalesWhId) {
                    defaultSalesWhId = w.id;
                  }
                }
              });
            }
          });

          // 2. Si no hay almacenes en la sucursal activa, listar de todas
          if (allWh.length === 0) {
            branchList.forEach((b: any) => {
              if (Array.isArray(b.warehouses)) {
                b.warehouses.forEach((w: any) => {
                  allWh.push({
                    id: w.id,
                    name: `${b.name} - ${w.name}`,
                    code: w.code || '',
                  });
                  if ((w.isDefaultSales || w.isDefault) && !defaultSalesWhId) {
                    defaultSalesWhId = w.id;
                  }
                });
              }
            });
          }

          setWarehouses(allWh);
          if (allWh.length > 0) {
            setFormWarehouseId(defaultSalesWhId || allWh[0].id);
          }
        }
      } catch {
        // Ignorar
      }
    };

    if (token) {
      fetchWarehouses();
    }
  }, [token, activeBranchId]);

  // Al seleccionar cliente, cargar sus facturas
  useEffect(() => {
    if (!formCustomerId) {
      setCustomerInvoices([]);
      setSelectedInvoiceId('');
      return;
    }

    const fetchInvoices = async () => {
      try {
        const res = await fetch(`/api/customer-notes/customer/${formCustomerId}/invoices`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setCustomerInvoices(json.data);
        } else {
          setCustomerInvoices([]);
        }
      } catch {
        setCustomerInvoices([]);
      }
    };

    fetchInvoices();
  }, [formCustomerId, token]);

  // Cargar ítems de factura afectada
  const handleLoadInvoiceItems = async () => {
    if (!selectedInvoiceId) return;
    try {
      const res = await fetch(`/api/customer-notes/invoices/${selectedInvoiceId}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const loadedItems = json.data.map((it: any) => ({
          productId: it.productId,
          description: it.description || it.productName || 'Producto',
          quantity: it.availableQuantity > 0 ? it.availableQuantity : 0,
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
          returnToInventory: formType === 'CREDIT',
          invoicedQuantity: it.invoicedQuantity,
          alreadyCreditedQuantity: it.alreadyCreditedQuantity,
          availableQuantity: it.availableQuantity,
        }));

        setItems(loadedItems);

        const availableCount = loadedItems.filter((it: any) => it.availableQuantity > 0).length;
        const fullyCreditedCount = loadedItems.filter((it: any) => it.availableQuantity <= 0).length;

        if (availableCount === 0) {
          toast.error('Todos los productos de esta factura ya fueron acreditados en su totalidad en notas previas');
        } else if (fullyCreditedCount > 0) {
          toast.warning(
            `${availableCount} producto(s) cargados con saldo disponible (${fullyCreditedCount} ya se habían devuelto/acreditado previamente)`
          );
        } else {
          toast.success(`${loadedItems.length} producto(s) cargados desde la factura`);
        }
      } else {
        toast.info('La factura seleccionada no posee ítems detallados para cargar');
      }
    } catch {
      toast.error('Error al cargar ítems de la factura');
    }
  };

  // Cálculos del formulario en vivo
  const formCalculations = useMemo(() => {
    let baseExempt = 0;
    let baseTaxable = 0;
    let taxAmount = 0;

    items.forEach((it) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unitPrice) || 0;
      const rate = Number(it.taxRate) || 0;
      const subtotal = qty * price;
      const tax = (subtotal * rate) / 100;

      if (rate === 0) {
        baseExempt += subtotal;
      } else {
        baseTaxable += subtotal;
      }
      taxAmount += tax;
    });

    const totalUSD = baseExempt + baseTaxable + taxAmount;
    const totalVES = totalUSD * exchangeRateBCV;

    return {
      baseExempt,
      baseTaxable,
      taxAmount,
      totalUSD,
      totalVES,
    };
  }, [items, exchangeRateBCV]);

  // Manejo de ítems en creación
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: null,
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: 16.0,
        returnToInventory: formType === 'CREDIT',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) {
      toast.error('Debe incluir al menos un ítem o concepto');
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      if (field === 'quantity' && copy[index].availableQuantity !== undefined) {
        const numVal = parseFloat(value) || 0;
        if (numVal > copy[index].availableQuantity!) {
          toast.warning(
            `La cantidad excede el disponible de la factura (${copy[index].availableQuantity}). No podrá guardar más de esta cantidad.`
          );
        }
      }
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Crear Nota
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBranchId) {
      toast.error('Debe seleccionar una sucursal activa');
      return;
    }
    if (!formCustomerId) {
      toast.error('Debe seleccionar un cliente');
      return;
    }
    if (!formReasonDescription.trim()) {
      toast.error('Debe indicar el motivo o justificación de la nota');
      return;
    }
    if (items.some((it) => !it.description.trim() || it.quantity <= 0)) {
      toast.error('Todos los renglones deben tener descripción y cantidad mayor a cero');
      return;
    }

    // Validar que ningún ítem exceda la cantidad disponible de la factura
    if (formType === 'CREDIT' && selectedInvoiceId) {
      const overQuantityItem = items.find(
        (it) => it.availableQuantity !== undefined && it.quantity > it.availableQuantity + 0.0001
      );
      if (overQuantityItem) {
        toast.error(
          `La cantidad de "${overQuantityItem.description}" (${overQuantityItem.quantity}) supera el disponible de la factura (${overQuantityItem.availableQuantity})`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: CreateCustomerNoteInput = {
        branchId: activeBranchId,
        customerId: formCustomerId,
        type: formType,
        warehouseId: formWarehouseId || undefined,
        affectedInvoiceId: selectedInvoiceId || undefined,
        controlNumber: formControlNumber.trim() || undefined,
        dueDate: formType === 'DEBIT' && formDueDate ? formDueDate : undefined,
        reasonType: formReasonType,
        reasonDescription: formReasonDescription.trim(),
        currency: 'USD',
        exchangeRate: exchangeRateBCV,
        autoApplyToInvoice: formAutoApply,
        items: items.map((it) => ({
          productId: it.productId || undefined,
          description: it.description.trim(),
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          taxRate: Number(it.taxRate),
          returnToInventory: Boolean(it.returnToInventory),
        })),
      };

      const res = await fetch('/api/customer-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al emitir nota');
      }

      toast.success(
        `${formType === 'CREDIT' ? 'Nota de Crédito' : 'Nota de Débito'} emitida exitosamente (${json.data.noteNumber})`
      );
      setIsCreateModalOpen(false);
      resetCreateForm();
      fetchNotes();

      // Abrir visualizador oficial de PDF
      if (json.data && json.data.id) {
        handleOpenPdf(json.data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar la nota');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setFormType('CREDIT');
    setFormCustomerId('');
    setFormCustomerName('');
    setFormCustomerDoc('');
    setSelectedInvoiceId('');
    setFormReasonType('RETURN');
    setFormReasonDescription('');
    setFormControlNumber('');
    setFormDueDate('');
    setFormAutoApply(true);
    setItems([
      {
        productId: null,
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: 16.0,
        returnToInventory: false,
      },
    ]);
  };

  // Abrir modal de detalle
  const handleOpenDetail = async (note: CustomerNote) => {
    try {
      const res = await fetch(`/api/customer-notes/${note.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSelectedNote(json.data);
      } else {
        setSelectedNote(note);
      }
    } catch {
      setSelectedNote(note);
    }
    setIsDetailModalOpen(true);
  };

  // Abrir modal de aplicación
  const handleOpenApply = async (note: CustomerNote) => {
    setSelectedNote(note);
    setApplyAmount(note.amountBalance);
    setApplyNotes('');
    try {
      const res = await fetch(`/api/receivables?customerId=${note.customerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setApplyReceivables(json.data);
        if (json.data.length > 0) {
          setSelectedReceivableId(json.data[0].id);
          const initialMax = Math.min(note.amountBalance, json.data[0].amountBalance);
          setApplyAmount(Number(initialMax.toFixed(2)));
        }
      } else {
        setApplyReceivables([]);
      }
    } catch {
      setApplyReceivables([]);
    }
    setIsApplyModalOpen(true);
  };

  // Ejecutar aplicación de saldo
  const handleExecuteApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNote || !selectedReceivableId) {
      toast.error('Seleccione una cuenta por cobrar');
      return;
    }
    if (applyAmount <= 0) {
      toast.error('El monto a aplicar debe ser mayor a cero');
      return;
    }

    setIsApplying(true);
    try {
      const res = await fetch('/api/customer-notes/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          noteId: selectedNote.id,
          receivableId: selectedReceivableId,
          amount: applyAmount,
          notes: applyNotes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al aplicar Nota de Crédito');
      }

      toast.success('Compensación de saldo aplicada exitosamente a la cuenta por cobrar');
      setIsApplyModalOpen(false);
      fetchNotes();
    } catch (err: any) {
      toast.error(err.message || 'Error en la compensación');
    } finally {
      setIsApplying(false);
    }
  };

  // Abrir modal de anulación
  const handleOpenAnnul = (note: CustomerNote) => {
    setSelectedNote(note);
    setAnnulReason('');
    setIsAnnulModalOpen(true);
  };

  // Ejecutar anulación
  const handleExecuteAnnul = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNote) return;
    if (!annulReason.trim()) {
      toast.error('Debe ingresar un motivo de anulación válido');
      return;
    }

    setIsAnnulling(true);
    try {
      const res = await fetch(`/api/customer-notes/${selectedNote.id}/annul`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: annulReason.trim() }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al anular la nota');
      }

      toast.success('Nota anulada exitosamente');
      setIsAnnulModalOpen(false);
      fetchNotes();
    } catch (err: any) {
      toast.error(err.message || 'Error al anular');
    } finally {
      setIsAnnulling(false);
    }
  };

  // Totales de KPIs
  const totalCreditNotesUSD = notes
    .filter((n) => n.type === 'CREDIT' && n.status !== 'ANNULLED')
    .reduce((acc, n) => acc + n.totalAmount, 0);

  const availableCreditUSD = notes
    .filter((n) => n.type === 'CREDIT' && n.status === 'ACTIVE')
    .reduce((acc, n) => acc + n.amountBalance, 0);

  const totalDebitNotesUSD = notes
    .filter((n) => n.type === 'DEBIT' && n.status !== 'ANNULLED')
    .reduce((acc, n) => acc + n.totalAmount, 0);

  const filteredNotes = notes.filter((n) => {
    if (activeTab === 'CREDIT' && n.type !== 'CREDIT') return false;
    if (activeTab === 'DEBIT' && n.type !== 'DEBIT') return false;
    if (statusFilter !== 'ALL' && n.status !== statusFilter) return false;
    if (search.trim()) {
      const term = search.toLowerCase();
      return (
        n.noteNumber.toLowerCase().includes(term) ||
        (n.customerName && n.customerName.toLowerCase().includes(term)) ||
        (n.customerDoc && n.customerDoc.toLowerCase().includes(term)) ||
        n.reasonDescription.toLowerCase().includes(term) ||
        (n.controlNumber && n.controlNumber.toLowerCase().includes(term))
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">
            Notas de Crédito & Notas de Débito
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Emisión fiscal, ajustes comerciales, devoluciones a stock y compensación de cuentas por cobrar
          </p>
        </div>

        {canManageNotes && (
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Nueva Nota
          </Button>
        )}
      </div>

      {/* Tarjetas KPI Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Notas de Crédito (Total)</span>
            <TrendingDown className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900 mt-2">
            {formatMoneyUSD(totalCreditNotesUSD)}
          </div>
          <span className="text-[11px] text-neutral-400 mt-1 block">
            Ajustes y devoluciones concedidas
          </span>
        </Card>

        <Card className="p-4 bg-white border-l-4 border-l-teal-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-teal-800">Saldo a Favor Disponible</span>
            <RotateCcw className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-xl font-bold text-teal-700 mt-2">
            {formatMoneyUSD(availableCreditUSD)}
          </div>
          <span className="text-[11px] text-neutral-400 mt-1 block">
            Crédito disponible para aplicar a CxC
          </span>
        </Card>

        <Card className="p-4 bg-white border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800">Notas de Débito (Total)</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900 mt-2">
            {formatMoneyUSD(totalDebitNotesUSD)}
          </div>
          <span className="text-[11px] text-neutral-400 mt-1 block">
            Recargos e intereses generados
          </span>
        </Card>

        <Card className="p-4 bg-white border-l-4 border-l-neutral-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-700">Documentos Emitidos</span>
            <Receipt className="w-4 h-4 text-neutral-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900 mt-2">{notes.length}</div>
          <span className="text-[11px] text-neutral-400 mt-1 block">
            En sucursal activa
          </span>
        </Card>
      </div>

      {/* Pestañas y Filtros */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Pestañas */}
        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'ALL'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Todas ({notes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CREDIT')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'CREDIT'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Crédito ({notes.filter((n) => n.type === 'CREDIT').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('DEBIT')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'DEBIT'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Débito ({notes.filter((n) => n.type === 'DEBIT').length})
          </button>
        </div>

        {/* Buscador y Estado */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar cliente, número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto h-9 px-3 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="ACTIVE">Activa / Con Saldo</option>
            <option value="APPLIED">Aplicada / Saldada</option>
            <option value="ANNULLED">Anulada</option>
          </select>
        </div>
      </div>

      {/* Tabla de Documentos */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="h-12 bg-neutral-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-neutral-800">
              No se encontraron Notas de Crédito o Débito
            </h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              Utilice el botón "Nueva Nota" para emitir una nota de crédito o débito a un cliente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-600">
              <thead className="bg-neutral-50 text-[11px] font-semibold text-neutral-700 uppercase tracking-wider border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Nº Nota / Control</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Factura Afectada</th>
                  <th className="py-3 px-4">Motivo</th>
                  <th className="py-3 px-4 text-right">Monto Total</th>
                  <th className="py-3 px-4 text-right">Saldo Remanente</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredNotes.map((note) => {
                  const isCredit = note.type === 'CREDIT';
                  return (
                    <tr key={note.id} className="hover:bg-neutral-50/80 transition-colors">
                      {/* Tipo */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isCredit ? (
                          <Badge variant="success">Nota Crédito</Badge>
                        ) : (
                          <Badge variant="info">Nota Débito</Badge>
                        )}
                      </td>

                      {/* Nº Documento */}
                      <td className="py-3 px-4 font-mono font-bold text-neutral-900 whitespace-nowrap">
                        {note.noteNumber}
                        {note.controlNumber && (
                          <div className="text-[10px] text-neutral-400 font-normal">
                            Ctrl: {note.controlNumber}
                          </div>
                        )}
                      </td>

                      {/* Fecha */}
                      <td className="py-3 px-4 whitespace-nowrap text-neutral-500">
                        {new Date(note.issueDate).toLocaleDateString()}
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-neutral-900">{note.customerName}</div>
                        <div className="text-[10px] text-neutral-400 font-mono">{note.customerDoc}</div>
                      </td>

                      {/* Factura Afectada */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {note.affectedInvoiceNumber ? (
                          <span className="font-mono text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-lg text-[11px]">
                            {note.affectedInvoiceNumber}
                          </span>
                        ) : (
                          <span className="text-neutral-400 italic text-[11px]">General</span>
                        )}
                      </td>

                      {/* Motivo */}
                      <td className="py-3 px-4 max-w-xs truncate" title={note.reasonDescription}>
                        <span className="text-neutral-800">{note.reasonDescription}</span>
                      </td>

                      {/* Total */}
                      <td className="py-3 px-4 text-right font-bold text-neutral-900 whitespace-nowrap">
                        {formatMoneyUSD(note.totalAmount)}
                        <div className="text-[10px] text-neutral-400 font-mono">
                          Bs. {(note.totalAmount * note.exchangeRate).toFixed(2)}
                        </div>
                      </td>

                      {/* Saldo Remanente */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isCredit ? (
                          note.amountBalance > 0.005 ? (
                            <span className="font-bold text-emerald-700">
                              {formatMoneyUSD(note.amountBalance)}
                            </span>
                          ) : (
                            <span className="text-neutral-400">$0.00 (Aplicada)</span>
                          )
                        ) : (
                          <span className="text-neutral-500 font-mono">
                            {formatMoneyUSD(note.totalAmount - note.amountApplied)}
                          </span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {note.status === 'ANNULLED' ? (
                          <Badge variant="danger">Anulada</Badge>
                        ) : note.status === 'APPLIED' ? (
                          <Badge variant="neutral">Saldada / Aplicada</Badge>
                        ) : (
                          <Badge variant="success">Activa</Badge>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Ver Detalle */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(note)}
                            title="Ver Detalle Oficial"
                            className="p-1.5 text-neutral-600 hover:text-sky-600 hover:bg-neutral-100 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Visualizar / Imprimir PDF Oficial */}
                          <button
                            type="button"
                            onClick={() => handleOpenPdf(note)}
                            title="Visualizar e Imprimir PDF"
                            className="p-1.5 text-neutral-600 hover:text-indigo-600 hover:bg-neutral-100 rounded-lg transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Aplicar a CxC (Solo si es crédito activo con saldo) */}
                          {isCredit && note.status === 'ACTIVE' && note.amountBalance > 0.005 && canApplyCredits && (
                            <button
                              type="button"
                              onClick={() => handleOpenApply(note)}
                              title="Aplicar Saldo a Cuenta por Cobrar"
                              className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}

                          {/* Anular (Solo si no está anulada y no tiene saldo aplicado) */}
                          {note.status !== 'ANNULLED' && note.amountApplied <= 0.005 && canManageNotes && (
                            <button
                              type="button"
                              onClick={() => handleOpenAnnul(note)}
                              title="Anular Nota"
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CREAR NOTA DE CRÉDITO O DÉBITO */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Cabecera */}
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div>
                <h2 className="text-base font-bold text-neutral-900">
                  Emitir {formType === 'CREDIT' ? 'Nota de Crédito' : 'Nota de Débito'}
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Ajuste fiscal, devolución de mercancía o recargo comercial a cliente
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleCreateNote} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Selector de Tipo */}
              <div className="flex gap-4 p-3 bg-neutral-100 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-800">
                  <input
                    type="radio"
                    name="noteType"
                    checked={formType === 'CREDIT'}
                    onChange={() => {
                      setFormType('CREDIT');
                      setFormReasonType('RETURN');
                    }}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  Nota de Crédito (Disminuye deuda / Devolución / Descuento)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-800">
                  <input
                    type="radio"
                    name="noteType"
                    checked={formType === 'DEBIT'}
                    onChange={() => {
                      setFormType('DEBIT');
                      setFormReasonType('PRICE_DIFFERENCE');
                    }}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  Nota de Débito (Aumenta deuda / Intereses / Recargos)
                </label>
              </div>

              {/* Fila Cliente y Factura Afectada */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cliente */}
                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">
                    Cliente *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      placeholder="Seleccionar cliente..."
                      value={formCustomerName ? `${formCustomerName} (${formCustomerDoc})` : ''}
                      onClick={() => setShowCustomerSearch(true)}
                      className="w-full h-9 px-3 text-xs bg-neutral-50 border border-neutral-300 rounded-lg cursor-pointer"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCustomerSearch(true)}
                    >
                      Buscar
                    </Button>
                  </div>
                </div>

                {/* Factura Afectada */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-700">
                      Factura Afectada (Opcional)
                    </label>
                    {selectedInvoiceId && (
                      <button
                        type="button"
                        onClick={handleLoadInvoiceItems}
                        className="text-[11px] text-sky-600 hover:underline font-semibold"
                      >
                        Cargar Renglones
                      </button>
                    )}
                  </div>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    disabled={!formCustomerId}
                    className="w-full h-9 px-3 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500 disabled:bg-neutral-100"
                  >
                    <option value="">Sin vincular a factura específica (General)</option>
                    {customerInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} — {new Date(inv.invoiceDate).toLocaleDateString()} (Total: $
                        {inv.totalAmount.toFixed(2)} | Pendiente: ${inv.pendingBalance.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fila Motivo, Control Fiscal y Almacén */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tipo de Motivo */}
                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">
                    Motivo Legal *
                  </label>
                  <select
                    value={formReasonType}
                    onChange={(e) => setFormReasonType(e.target.value as CustomerNoteReasonType)}
                    className="w-full h-9 px-3 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    {formType === 'CREDIT' ? (
                      <>
                        <option value="RETURN">Devolución de Mercancía</option>
                        <option value="DISCOUNT">Descuento o Rebaja Concedida</option>
                        <option value="PRICE_CORRECTION">Corrección por Sobrefacturación</option>
                        <option value="ANNULMENT">Rescisión o Anulación de Factura</option>
                        <option value="OTHER">Otro Ajuste a Favor</option>
                      </>
                    ) : (
                      <>
                        <option value="PRICE_DIFFERENCE">Diferencia de Precio / Subfacturación</option>
                        <option value="LATE_FEE">Intereses de Mora</option>
                        <option value="COLLECTION_FEE">Gastos de Cobranza y Transporte</option>
                        <option value="OTHER">Otro Recargo Comercial</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Número de Control SENIAT */}
                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">
                    Nº Control SENIAT (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 00-001234"
                    value={formControlNumber}
                    onChange={(e) => setFormControlNumber(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
                  />
                </div>

                {/* Almacén o Fecha Vencimiento */}
                {formType === 'CREDIT' ? (
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">
                      Almacén para Reingreso
                    </label>
                    <select
                      value={formWarehouseId}
                      onChange={(e) => setFormWarehouseId(e.target.value)}
                      className="w-full h-9 px-3 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">
                      Fecha Vencimiento en CxC
                    </label>
                    <input
                      type="date"
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                      className="w-full h-9 px-3 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
                    />
                  </div>
                )}
              </div>

              {/* Justificación detallada */}
              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1">
                  Explicación o Concepto de la Nota *
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalle el motivo comercial o técnico del ajuste..."
                  value={formReasonDescription}
                  onChange={(e) => setFormReasonDescription(e.target.value)}
                  className="w-full p-2.5 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
                />
              </div>

              {/* Renglones / Ítems */}
              <div className="border border-neutral-200 rounded-lg p-3 bg-neutral-50/50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-neutral-800">
                    Renglones y Conceptos de la Nota
                  </h3>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Agregar Renglón
                  </Button>
                </div>

                <div className="space-y-2">
                  {items.map((it, idx) => {
                    const rowSubtotal = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center bg-white p-2 border border-neutral-200 rounded-lg text-xs"
                      >
                        {/* Descripción */}
                        <div className="col-span-12 sm:col-span-5">
                          <input
                            type="text"
                            placeholder="Descripción o concepto del ítem..."
                            value={it.description}
                            onChange={(e) => handleUpdateItem(idx, 'description', e.target.value)}
                            className="w-full h-8 px-2 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
                          />
                          {it.availableQuantity !== undefined && it.availableQuantity <= 0 && (
                            <span className="text-[10px] text-red-600 font-semibold block mt-0.5">
                              Facturado: {it.invoicedQuantity} (Acreditado previamente al 100%)
                            </span>
                          )}
                        </div>

                        {/* Cantidad */}
                        <div className="col-span-3 sm:col-span-2">
                          <input
                            type="number"
                            min="0"
                            max={it.availableQuantity !== undefined ? it.availableQuantity : undefined}
                            step="any"
                            placeholder="Cant."
                            value={it.quantity || ''}
                            onChange={(e) => handleUpdateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className={`w-full h-8 px-2 text-xs border rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500 text-right ${
                              it.availableQuantity !== undefined && it.quantity > it.availableQuantity
                                ? 'border-red-500 bg-red-50 text-red-700 font-bold'
                                : 'bg-white border-neutral-300'
                            }`}
                          />
                          {it.availableQuantity !== undefined && (
                            <div className="text-[10px] text-neutral-500 text-right mt-0.5 leading-tight font-mono">
                              {it.quantity > it.availableQuantity ? (
                                <span className="text-red-600 font-bold">Máx: {it.availableQuantity}</span>
                              ) : (
                                <span>
                                  Disp: {it.availableQuantity}
                                  {it.alreadyCreditedQuantity ? ` (Prev: ${it.alreadyCreditedQuantity})` : ''}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Precio Unitario */}
                        <div className="col-span-4 sm:col-span-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Precio $"
                            value={it.unitPrice || ''}
                            onChange={(e) => handleUpdateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full h-8 px-2 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500 text-right"
                          />
                        </div>

                        {/* IVA */}
                        <div className="col-span-3 sm:col-span-1">
                          <select
                            value={it.taxRate}
                            onChange={(e) => handleUpdateItem(idx, 'taxRate', parseFloat(e.target.value) || 0)}
                            className="w-full h-8 px-1 text-xs bg-white border border-neutral-300 rounded-lg"
                          >
                            <option value={16}>16%</option>
                            <option value={8}>8%</option>
                            <option value={0}>0%</option>
                          </select>
                        </div>

                        {/* Devolución a stock o Subtotal */}
                        <div className="col-span-2 sm:col-span-2 flex items-center justify-between gap-1">
                          {formType === 'CREDIT' ? (
                            <label
                              className="flex items-center gap-1 text-[10px] text-neutral-600 cursor-pointer"
                              title="Reingresar al inventario"
                            >
                              <input
                                type="checkbox"
                                checked={it.returnToInventory}
                                onChange={(e) => handleUpdateItem(idx, 'returnToInventory', e.target.checked)}
                                className="rounded text-emerald-600"
                              />
                              Stock
                            </label>
                          ) : (
                            <span className="font-mono font-bold text-neutral-700">
                              ${rowSubtotal.toFixed(2)}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-neutral-400 hover:text-red-600 p-1 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Opción de auto-aplicar a factura afectada */}
              {formType === 'CREDIT' && selectedInvoiceId && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoApply"
                    checked={formAutoApply}
                    onChange={(e) => setFormAutoApply(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <label htmlFor="autoApply" className="text-xs text-emerald-900 cursor-pointer">
                    <strong>Aplicar automáticamente a la factura afectada:</strong> Compensar de
                    inmediato el saldo pendiente de la cuenta por cobrar con esta nota.
                  </label>
                </div>
              )}

              {/* Resumen de Totales e Impuestos */}
              <div className="bg-neutral-50 p-4 border border-neutral-200 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
                <div className="space-y-1">
                  <div>Base Exenta: <strong>{formatMoneyUSD(formCalculations.baseExempt)}</strong></div>
                  <div>Base Imponible: <strong>{formatMoneyUSD(formCalculations.baseTaxable)}</strong></div>
                  <div>IVA Calculado: <strong>{formatMoneyUSD(formCalculations.taxAmount)}</strong></div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-semibold text-neutral-600">Total de la Nota</div>
                  <div className="text-2xl font-bold text-neutral-900">
                    {formatMoneyUSD(formCalculations.totalUSD)}
                  </div>
                  <div className="text-xs text-neutral-500 font-mono">
                    ≈ Bs. {formCalculations.totalVES.toFixed(2)} (Tasa BCV: {exchangeRateBCV.toFixed(2)})
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Emitiendo...' : `Emitir ${formType === 'CREDIT' ? 'Nota de Crédito' : 'Nota de Débito'}`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VER DETALLE OFICIAL E IMPRESIÓN */}
      {/* ========================================================================= */}
      {isDetailModalOpen && selectedNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-neutral-700" />
                <h2 className="text-base font-bold text-neutral-900">
                  Comprobante Oficial — {selectedNote.noteNumber}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenPdf(selectedNote)}
                  className="print:hidden"
                >
                  <Printer className="w-4 h-4 mr-1.5" />
                  Visualizar / Imprimir PDF
                </Button>
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-neutral-700">
              {/* Encabezado Documento */}
              <div className="border-b border-neutral-200 pb-4 flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    {selectedNote.type === 'CREDIT' ? 'NOTA DE CRÉDITO' : 'NOTA DE DÉBITO'}
                  </h3>
                  <div className="text-sm font-mono font-bold text-neutral-800 mt-0.5">
                    Nº {selectedNote.noteNumber}
                  </div>
                  {selectedNote.controlNumber && (
                    <div className="text-neutral-500 font-mono">
                      Control SENIAT: {selectedNote.controlNumber}
                    </div>
                  )}
                  <div className="text-neutral-500 mt-1">
                    Fecha: {new Date(selectedNote.issueDate).toLocaleDateString()}
                  </div>
                </div>

                <div className="text-right">
                  <Badge variant={selectedNote.status === 'ANNULLED' ? 'danger' : 'success'}>
                    {selectedNote.status}
                  </Badge>
                  <div className="mt-2 text-neutral-500">Sucursal: {selectedNote.branchName}</div>
                  <div className="text-neutral-500">Emitido por: {selectedNote.userName}</div>
                </div>
              </div>

              {/* Datos Cliente y Factura Afectada */}
              <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-lg">
                <div>
                  <span className="font-bold text-neutral-800 block mb-1">CLIENTE:</span>
                  <div>{selectedNote.customerName}</div>
                  <div className="font-mono text-neutral-600">{selectedNote.customerDoc}</div>
                </div>
                <div>
                  <span className="font-bold text-neutral-800 block mb-1">DOCUMENTO MODIFICADO:</span>
                  {selectedNote.affectedInvoiceNumber ? (
                    <div>Factura Nº {selectedNote.affectedInvoiceNumber}</div>
                  ) : (
                    <div className="italic text-neutral-500">No aplica (Ajuste global)</div>
                  )}
                  <div className="mt-1">
                    <strong>Motivo:</strong> {selectedNote.reasonDescription}
                  </div>
                </div>
              </div>

              {/* Renglones */}
              <div>
                <h4 className="font-bold text-neutral-800 mb-2">DETALLE DE RENGLONES</h4>
                <div className="border border-neutral-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-100 text-neutral-700 font-semibold border-b border-neutral-200">
                      <tr>
                        <th className="py-2 px-3">Descripción</th>
                        <th className="py-2 px-3 text-right">Cant.</th>
                        <th className="py-2 px-3 text-right">Precio Unit.</th>
                        <th className="py-2 px-3 text-center">IVA</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {selectedNote.items && selectedNote.items.length > 0 ? (
                        selectedNote.items.map((it) => (
                          <tr key={it.id}>
                            <td className="py-2 px-3">
                              {it.description}
                              {it.returnToInventory && (
                                <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                  Reingresado a Stock
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">{it.quantity}</td>
                            <td className="py-2 px-3 text-right">{formatMoneyUSD(it.unitPrice)}</td>
                            <td className="py-2 px-3 text-center">{it.taxRate}%</td>
                            <td className="py-2 px-3 text-right font-semibold">
                              {formatMoneyUSD(it.subtotal)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-3 text-center text-neutral-400">
                            Sin renglones registrados
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totales */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1.5 border border-neutral-200 p-3 rounded-lg bg-neutral-50">
                  <div className="flex justify-between">
                    <span>Base Exenta:</span>
                    <strong>{formatMoneyUSD(selectedNote.baseExemptAmount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Base Gravable:</span>
                    <strong>{formatMoneyUSD(selectedNote.baseTaxableAmount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>IVA:</span>
                    <strong>{formatMoneyUSD(selectedNote.taxAmount)}</strong>
                  </div>
                  <div className="flex justify-between border-t border-neutral-200 pt-1.5 text-sm font-bold text-neutral-900">
                    <span>TOTAL:</span>
                    <span>{formatMoneyUSD(selectedNote.totalAmount)}</span>
                  </div>
                  <div className="text-[10px] text-neutral-500 text-right font-mono">
                    Bs. {(selectedNote.totalAmount * selectedNote.exchangeRate).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Historial de Aplicaciones a CxC */}
              {selectedNote.applications && selectedNote.applications.length > 0 && (
                <div className="border-t border-neutral-200 pt-4">
                  <h4 className="font-bold text-neutral-800 mb-2">
                    HISTORIAL DE COMPENSACIONES / APLICACIONES A CUENTAS POR COBRAR
                  </h4>
                  <div className="border border-neutral-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-100 text-neutral-700 font-semibold border-b border-neutral-200">
                        <tr>
                          <th className="py-2 px-3">Fecha</th>
                          <th className="py-2 px-3">Factura Compensada</th>
                          <th className="py-2 px-3 text-right">Monto Aplicado</th>
                          <th className="py-2 px-3">Usuario</th>
                          <th className="py-2 px-3">Notas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {selectedNote.applications.map((app) => (
                          <tr key={app.id}>
                            <td className="py-2 px-3">
                              {new Date(app.appliedDate).toLocaleDateString()}
                            </td>
                            <td className="py-2 px-3 font-mono font-semibold">
                              {app.invoiceNumber || 'CxC'}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-700">
                              {formatMoneyUSD(app.amountApplied)}
                            </td>
                            <td className="py-2 px-3">{app.userName}</td>
                            <td className="py-2 px-3 text-neutral-500">{app.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: APLICAR NOTA DE CRÉDITO A CUENTAS POR COBRAR */}
      {/* ========================================================================= */}
      {isApplyModalOpen && selectedNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Compensar Deuda con Nota de Crédito
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Aplicar saldo a favor de {selectedNote.noteNumber} a facturas pendientes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsApplyModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                ✕
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-xs text-emerald-900">
              Saldo Disponible en la Nota de Crédito:{' '}
              <strong className="text-emerald-800 text-sm">
                {formatMoneyUSD(selectedNote.amountBalance)}
              </strong>
            </div>

            <form onSubmit={handleExecuteApply} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1">
                  Cuenta por Cobrar a Abonar / Saldar *
                </label>
                {applyReceivables.length === 0 ? (
                  <div className="text-xs text-amber-600 italic p-3 bg-amber-50 rounded-lg">
                    Este cliente no posee facturas ni cuentas por cobrar pendientes.
                  </div>
                ) : (
                  <select
                    value={selectedReceivableId}
                    onChange={(e) => {
                      setSelectedReceivableId(e.target.value);
                      const rec = applyReceivables.find((r) => r.id === e.target.value);
                      if (rec) {
                        const max = Math.min(selectedNote.amountBalance, rec.amountBalance);
                        setApplyAmount(Number(max.toFixed(2)));
                      }
                    }}
                    className="w-full h-9 px-3 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    {applyReceivables.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.invoiceNumber} — Saldo Pendiente: ${r.amountBalance.toFixed(2)} (Total: $
                        {r.amountTotal.toFixed(2)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-neutral-700">Monto a Aplicar ($) *</label>
                  <button
                    type="button"
                    onClick={() => {
                      const rec = applyReceivables.find((r) => r.id === selectedReceivableId);
                      if (rec) {
                        const max = Math.min(selectedNote.amountBalance, rec.amountBalance);
                        setApplyAmount(Number(max.toFixed(2)));
                      }
                    }}
                    className="text-[11px] text-sky-600 hover:underline"
                  >
                    Aplicar Máximo
                  </button>
                </div>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={selectedNote.amountBalance}
                  value={applyAmount || ''}
                  onChange={(e) => setApplyAmount(parseFloat(e.target.value) || 0)}
                  className="w-full h-9 px-3 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500 font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1">
                  Observaciones
                </label>
                <input
                  type="text"
                  placeholder="Detalle o nota interna..."
                  value={applyNotes}
                  onChange={(e) => setApplyNotes(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white border border-neutral-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsApplyModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isApplying || applyReceivables.length === 0 || applyAmount <= 0}
                >
                  {isApplying ? 'Aplicando...' : 'Confirmar Compensación'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ANULACIÓN DE NOTA */}
      {/* ========================================================================= */}
      {isAnnulModalOpen && selectedNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-base font-bold text-neutral-900">
                Anular {selectedNote.type === 'CREDIT' ? 'Nota de Crédito' : 'Nota de Débito'}
              </h3>
            </div>

            <p className="text-xs text-neutral-600">
              ¿Está seguro de que desea anular el documento{' '}
              <strong className="text-neutral-900">{selectedNote.noteNumber}</strong> por un monto de{' '}
              <strong>{formatMoneyUSD(selectedNote.totalAmount)}</strong>?
            </p>

            {selectedNote.type === 'CREDIT' && (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                Si esta nota reingresó mercancía a inventario, la existencia será revertida
                automáticamente.
              </p>
            )}

            <form onSubmit={handleExecuteAnnul} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1">
                  Motivo de Anulación *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explique la causa de anulación..."
                  value={annulReason}
                  onChange={(e) => setAnnulReason(e.target.value)}
                  className="w-full p-2.5 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAnnulModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  disabled={isAnnulling || !annulReason.trim()}
                >
                  {isAnnulling ? 'Anulando...' : 'Confirmar Anulación'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Búsqueda de Clientes con Bloqueo */}
      <CustomerSearchModal
        isOpen={showCustomerSearch}
        onClose={() => setShowCustomerSearch(false)}
        onSelect={(cust) => {
          setFormCustomerId(cust.id);
          setFormCustomerName(cust.name);
          setFormCustomerDoc(`${cust.docType}-${cust.docNumber}`);
          setShowCustomerSearch(false);
        }}
      />

      {/* Visor Oficial e Impresión de PDF de Notas */}
      <PdfViewerModal
        isOpen={pdfModal.isOpen}
        onClose={() => setPdfModal((prev) => ({ ...prev, isOpen: false }))}
        title={pdfModal.title}
        endpoint={pdfModal.endpoint}
        filename={pdfModal.filename}
      />
    </div>
  );
};
