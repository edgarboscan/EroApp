import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import {
  FileText,
  Plus,
  Trash2,
  X,
  Check,
  Building2,
  Calendar,
  DollarSign,
  User,
  Eye,
  Receipt,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';

interface QuotationRecord {
  id: string;
  quotationNumber: string;
  quotationDate: string;
  validUntilDate: string;
  currency: 'USD' | 'VES';
  exchangeRate: number;
  subtotalAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  status: 'DRAFT' | 'EMITTED' | 'ACCEPTED' | 'EXPIRED' | 'REJECTED' | 'CONVERTED';
  notes?: string | null;
  customerName: string;
  customerDoc: string;
  branchName: string;
  createdByUserName: string;
  itemsCount: number;
}

interface NewQuotationItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountPercent: number;
  subtotal: number;
  total: number;
  notes?: string;
}

const DEMO_QUOTATIONS: QuotationRecord[] = [
  {
    id: 'cot-01',
    quotationNumber: 'COT-2026-0001',
    quotationDate: '2026-09-28T09:00:00Z',
    validUntilDate: '2026-10-12',
    currency: 'USD',
    exchangeRate: 36.85,
    subtotalAmount: 1850.0,
    taxAmount: 296.0,
    discountAmount: 0.0,
    totalAmount: 2146.0,
    status: 'EMITTED',
    notes: 'Presupuesto para dotación de alimentos de comedor industrial',
    customerName: 'CONSTRUCTORA METROPOLITANA C.A.',
    customerDoc: 'J-29881723-4',
    branchName: 'Sucursal Principal Caracas',
    createdByUserName: 'Ing. Edgar Boscán',
    itemsCount: 3,
  },
  {
    id: 'cot-02',
    quotationNumber: 'COT-2026-0002',
    quotationDate: '2026-09-29T11:30:00Z',
    validUntilDate: '2026-10-06',
    currency: 'USD',
    exchangeRate: 36.85,
    subtotalAmount: 640.0,
    taxAmount: 102.4,
    discountAmount: 32.0,
    totalAmount: 710.4,
    status: 'ACCEPTED',
    notes: 'Aprobado por el cliente vía correo electrónico. Descuento del 5% aplicado',
    customerName: 'CLÍNICA SANTA MARÍA S.A.',
    customerDoc: 'J-31009821-0',
    branchName: 'Sucursal Este - Las Mercedes',
    createdByUserName: 'María Pérez',
    itemsCount: 2,
  },
  {
    id: 'cot-03',
    quotationNumber: 'COT-2026-0003',
    quotationDate: '2026-09-27T15:20:00Z',
    validUntilDate: '2026-10-04',
    currency: 'USD',
    exchangeRate: 36.85,
    subtotalAmount: 450.0,
    taxAmount: 72.0,
    discountAmount: 0.0,
    totalAmount: 522.0,
    status: 'CONVERTED',
    notes: 'Convertida en Factura Fiscal FACT-001094',
    customerName: 'HOTEL BELLO MONTE C.A.',
    customerDoc: 'J-18920199-5',
    branchName: 'Sucursal Principal Caracas',
    createdByUserName: 'Ing. Edgar Boscán',
    itemsCount: 1,
  },
];

const AVAILABLE_PRODUCTS = [
  { id: '11111111-1111-1111-1111-111111111111', sku: 'ALM-HAR-001', name: 'Harina de Maíz Blanco 1kg', basePrice: 1.45, taxRate: 0.0 },
  { id: '22222222-2222-2222-2222-222222222222', sku: 'ALM-ARR-002', name: 'Arroz Blanco Tradicional 1kg', basePrice: 1.60, taxRate: 0.0 },
  { id: '33333333-3333-3333-3333-333333333333', sku: 'BEB-REF-003', name: 'Refresco Cola 2L Botella', basePrice: 2.25, taxRate: 16.0 },
  { id: '44444444-4444-4444-4444-444444444444', sku: 'FER-CAB-004', name: 'Cable Eléctrico THW #12 (Metro)', basePrice: 0.95, taxRate: 16.0 },
];

const AVAILABLE_CUSTOMERS = [
  { id: 'cus-01', name: 'CONSTRUCTORA METROPOLITANA C.A.', doc: 'J-29881723-4', creditEnabled: true, creditLimit: 5000.0 },
  { id: 'cus-02', name: 'CLÍNICA SANTA MARÍA S.A.', doc: 'J-31009821-0', creditEnabled: true, creditLimit: 3000.0 },
  { id: 'cus-03', name: 'HOTEL BELLO MONTE C.A.', doc: 'J-18920199-5', creditEnabled: false, creditLimit: 0.0 },
];

export const QuotationsView: React.FC = () => {
  const { activeBranchId } = useAuthStore();
  const [quotations, setQuotations] = useState<QuotationRecord[]>(DEMO_QUOTATIONS);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingQuotation, setViewingQuotation] = useState<QuotationRecord | null>(null);
  const [invoicingQuotation, setInvoicingQuotation] = useState<QuotationRecord | null>(null);

  // Formulario Nueva Cotización
  const [selectedCustomerId, setSelectedCustomerId] = useState(AVAILABLE_CUSTOMERS[0].id);
  const [validUntilDate, setValidUntilDate] = useState(
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [exchangeRate, setExchangeRate] = useState(36.85);
  const [notes, setNotes] = useState('');
  const [quotationItems, setQuotationItems] = useState<NewQuotationItem[]>([
    {
      productId: AVAILABLE_PRODUCTS[0].id,
      productName: AVAILABLE_PRODUCTS[0].name,
      sku: AVAILABLE_PRODUCTS[0].sku,
      quantity: 50,
      unitPrice: AVAILABLE_PRODUCTS[0].basePrice,
      taxRate: AVAILABLE_PRODUCTS[0].taxRate,
      discountPercent: 0,
      subtotal: 72.5,
      total: 72.5,
    },
  ]);

  // Formulario de Facturación de Cotización
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [controlNumber, setControlNumber] = useState('');
  const [isCredit, setIsCredit] = useState(false);
  const [dueDate, setDueDate] = useState('');

  // Totales
  const subtotalSum = quotationItems.reduce((acc, i) => acc + i.subtotal, 0);
  const taxSum = quotationItems.reduce((acc, i) => acc + (i.total - i.subtotal), 0);
  const totalUSD = subtotalSum + taxSum;
  const totalVES = totalUSD * exchangeRate;

  const handleAddItem = () => {
    const prod = AVAILABLE_PRODUCTS[0];
    const sub = Number((10 * prod.basePrice).toFixed(2));
    const tax = Number((sub * (prod.taxRate / 100)).toFixed(2));
    setQuotationItems([
      ...quotationItems,
      {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        quantity: 10,
        unitPrice: prod.basePrice,
        taxRate: prod.taxRate,
        discountPercent: 0,
        subtotal: sub,
        total: Number((sub + tax).toFixed(2)),
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (quotationItems.length === 1) {
      toast.error('La cotización debe contener al menos un producto');
      return;
    }
    setQuotationItems(quotationItems.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    const updated = [...quotationItems];
    const item = updated[index];

    if (field === 'productId') {
      const p = AVAILABLE_PRODUCTS.find((pr) => pr.id === val);
      if (p) {
        item.productId = p.id;
        item.productName = p.name;
        item.sku = p.sku;
        item.unitPrice = p.basePrice;
        item.taxRate = p.taxRate;
      }
    } else if (field === 'quantity') {
      item.quantity = Number(val);
    } else if (field === 'unitPrice') {
      item.unitPrice = Number(val);
    } else if (field === 'taxRate') {
      item.taxRate = Number(val);
    } else if (field === 'discountPercent') {
      item.discountPercent = Number(val);
    }

    const rawSubtotal = item.quantity * item.unitPrice;
    const disc = rawSubtotal * (item.discountPercent / 100);
    const sub = Number((rawSubtotal - disc).toFixed(2));
    const tax = Number((sub * (item.taxRate / 100)).toFixed(2));

    item.subtotal = sub;
    item.total = Number((sub + tax).toFixed(2));
    setQuotationItems(updated);
  };

  const handleCreateQuotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (quotationItems.length === 0) {
      toast.error('Debe incluir al menos un producto');
      return;
    }

    const customer = AVAILABLE_CUSTOMERS.find((c) => c.id === selectedCustomerId);
    const newSeq = String(quotations.length + 1).padStart(4, '0');
    const newQuotationNumber = `COT-2026-${newSeq}`;

    const newRecord: QuotationRecord = {
      id: `cot-${Date.now()}`,
      quotationNumber: newQuotationNumber,
      quotationDate: new Date().toISOString(),
      validUntilDate,
      currency,
      exchangeRate,
      subtotalAmount: Number(subtotalSum.toFixed(2)),
      taxAmount: Number(taxSum.toFixed(2)),
      discountAmount: 0.0,
      totalAmount: Number(totalUSD.toFixed(2)),
      status: 'EMITTED',
      notes: notes || null,
      customerName: customer?.name || 'Cliente Comercial',
      customerDoc: customer?.doc || 'V-00000000',
      branchName: activeBranchId === 'b2222222-2222-2222-2222-222222222222' ? 'Sucursal Este - Las Mercedes' : 'Sucursal Principal Caracas',
      createdByUserName: 'Ing. Edgar Boscán',
      itemsCount: quotationItems.length,
    };

    setQuotations([newRecord, ...quotations]);
    setIsCreateOpen(false);
    toast.success(`Cotización ${newQuotationNumber} emitida con éxito`);
  };

  const handleAcceptQuotation = (id: string) => {
    setQuotations(
      quotations.map((q) => (q.id === id ? { ...q, status: 'ACCEPTED' } : q))
    );
    toast.success('Cotización aceptada por el cliente. Lista para facturar o generar nota de entrega.');
  };

  const handleInvoiceQuotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoicingQuotation) return;
    if (!invoiceNumber.trim()) {
      toast.error('El número de factura fiscal es obligatorio');
      return;
    }

    setQuotations(
      quotations.map((q) =>
        q.id === invoicingQuotation.id ? { ...q, status: 'CONVERTED' } : q
      )
    );

    toast.success(
      `Factura ${invoiceNumber} emitida con éxito. Stock rebajado y cuenta por cobrar registrada.`
    );
    setInvoicingQuotation(null);
    setInvoiceNumber('');
    setControlNumber('');
  };

  const filteredQuotations = quotations.filter((q) => {
    if (statusFilter !== 'ALL' && q.status !== statusFilter) return false;
    return true;
  });

  const renderStatusBadge = (status: QuotationRecord['status']) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="neutral" className="text-[10px]">Borrador</Badge>;
      case 'EMITTED':
        return <Badge variant="info" className="text-[10px]">Emitida</Badge>;
      case 'ACCEPTED':
        return <Badge variant="warning" className="text-[10px]">Aceptada Cliente</Badge>;
      case 'CONVERTED':
        return <Badge variant="success" className="text-[10px]">Facturada / Despachada</Badge>;
      case 'EXPIRED':
        return <Badge variant="danger" className="text-[10px]">Vencida</Badge>;
      case 'REJECTED':
        return <Badge variant="danger" className="text-[10px]">Rechazada</Badge>;
      default:
        return null;
    }
  };

  const columns: Column<QuotationRecord>[] = [
    {
      header: 'Nº Cotización',
      accessorKey: 'quotationNumber',
      cell: (item) => (
        <span className="font-mono text-xs font-semibold text-sky-700">{item.quotationNumber}</span>
      ),
    },
    {
      header: 'Fecha & Validez',
      accessorKey: 'quotationDate',
      cell: (item) => (
        <div className="text-xs text-neutral-700">
          <p>{new Date(item.quotationDate).toLocaleDateString('es-VE')}</p>
          <span className="text-[10px] text-neutral-500">Válida hasta: {item.validUntilDate}</span>
        </div>
      ),
    },
    {
      header: 'Cliente & Doc',
      accessorKey: 'customerName',
      cell: (item) => (
        <div>
          <p className="text-xs font-medium text-neutral-900">{item.customerName}</p>
          <span className="font-mono text-[10px] text-neutral-500">{item.customerDoc}</span>
        </div>
      ),
    },
    {
      header: 'Sucursal',
      accessorKey: 'branchName',
      cell: (item) => (
        <div className="flex items-center gap-1.5 text-xs text-neutral-600">
          <Building2 className="w-3.5 h-3.5 text-neutral-400" />
          <span>{item.branchName}</span>
        </div>
      ),
    },
    {
      header: 'Total Cotizado',
      accessorKey: 'totalAmount',
      cell: (item) => (
        <div className="text-right">
          <p className="text-xs font-semibold text-neutral-900">
            ${item.totalAmount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-neutral-500">
            Bs. {(item.totalAmount * item.exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </p>
        </div>
      ),
    },
    {
      header: 'Estado',
      accessorKey: 'status',
      cell: (item) => renderStatusBadge(item.status),
    },
    {
      header: 'Acciones',
      accessorKey: 'id',
      cell: (item) => (
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={() => setViewingQuotation(item)}
            className="p-1 text-neutral-500 hover:text-sky-600 rounded-lg hover:bg-neutral-100"
            title="Ver Detalle"
          >
            <Eye className="w-4 h-4" />
          </button>
          {item.status === 'EMITTED' && (
            <button
              onClick={() => handleAcceptQuotation(item.id)}
              className="p-1 text-emerald-600 hover:text-emerald-700 rounded-lg hover:bg-emerald-50"
              title="Aceptar Cotización"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {item.status === 'ACCEPTED' && (
            <Button
              variant="outline"
              onClick={() => setInvoicingQuotation(item)}
              className="text-[11px] py-1 px-2 rounded-lg border-sky-300 text-sky-700 hover:bg-sky-50 flex items-center gap-1"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Facturar</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Cotizaciones & Presupuestos</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Propuestas comerciales y presupuestos para clientes con conversión a facturas y notas de entrega
          </p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs rounded-lg py-2 px-3 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Cotización</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Cotizaciones Activas</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900 mt-2">
            {quotations.filter((q) => q.status !== 'EXPIRED' && q.status !== 'REJECTED').length}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">En proceso comercial</p>
        </Card>

        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Monto Total Cotizado</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">
            ${quotations.reduce((acc, q) => acc + q.totalAmount, 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">Volumen de ventas presupuestado</p>
        </Card>

        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Aprobadas para Facturar</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">
            {quotations.filter((q) => q.status === 'ACCEPTED').length}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">Aceptadas listas para emisión</p>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-2 overflow-x-auto">
        {['ALL', 'EMITTED', 'ACCEPTED', 'CONVERTED', 'EXPIRED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === st
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {st === 'ALL' && 'Todas'}
            {st === 'EMITTED' && 'Emitidas'}
            {st === 'ACCEPTED' && 'Aceptadas'}
            {st === 'CONVERTED' && 'Facturadas'}
            {st === 'EXPIRED' && 'Vencidas'}
          </button>
        ))}
      </div>

      {/* Tabla de Cotizaciones */}
      <Card className="rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-sm">
        <DataTable
          columns={columns}
          data={filteredQuotations}
          isLoading={loading}
          searchPlaceholder="Buscar cotización por número, cliente o documento..."
        />
      </Card>

      {/* Modal Nueva Cotización */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-neutral-200 w-full max-w-4xl p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Nueva Cotización / Presupuesto</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Propuesta comercial con precios de lista y cálculo tributario
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuotation} className="mt-4 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Cliente Solicitante *
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  >
                    {AVAILABLE_CUSTOMERS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.doc})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Válida Hasta *
                  </label>
                  <input
                    type="date"
                    required
                    value={validUntilDate}
                    onChange={(e) => setValidUntilDate(e.target.value)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Tasa Oficial BCV
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(Number(e.target.value))}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                </div>
              </div>

              {/* Detalle de Productos Cotizados */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                    Productos Cotizados ({quotationItems.length})
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddItem}
                    className="text-xs rounded-lg py-1 px-2.5 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Ítem</span>
                  </Button>
                </div>

                <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-medium">
                      <tr>
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-3 w-24">Cantidad</th>
                        <th className="py-2.5 px-3 w-28">Precio ($)</th>
                        <th className="py-2.5 px-3 w-24">IVA (%)</th>
                        <th className="py-2.5 px-3 w-24">Desc. (%)</th>
                        <th className="py-2.5 px-3 w-28 text-right">Subtotal ($)</th>
                        <th className="py-2.5 px-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {quotationItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50/50">
                          <td className="py-2 px-3">
                            <select
                              value={item.productId}
                              onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                              className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-neutral-800"
                            >
                              {AVAILABLE_PRODUCTS.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.sku} - {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-neutral-800"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                              className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-neutral-800"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={item.taxRate}
                              onChange={(e) => handleItemChange(idx, 'taxRate', e.target.value)}
                              className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2 py-1.5 text-neutral-800"
                            >
                              <option value="0">0%</option>
                              <option value="8">8%</option>
                              <option value="16">16%</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discountPercent}
                              onChange={(e) => handleItemChange(idx, 'discountPercent', e.target.value)}
                              className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2 py-1.5 text-neutral-800"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-neutral-900">
                            ${item.subtotal.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-neutral-400 hover:text-red-500 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totales y Observaciones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start pt-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Condiciones Comerciales y Observaciones
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Validez de la oferta, tiempos de entrega, forma de pago acordada..."
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg p-2.5 text-neutral-800"
                  />
                </div>

                <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200 space-y-2">
                  <div className="flex justify-between text-xs text-neutral-600">
                    <span>Subtotal Base Imponible:</span>
                    <span className="font-semibold">${subtotalSum.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-neutral-600">
                    <span>IVA Estimado:</span>
                    <span className="font-semibold">${taxSum.toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t border-neutral-200 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-neutral-900">Total Presupuesto (USD):</span>
                    <span className="text-base font-bold text-sky-700">${totalUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-neutral-500">
                    <span>Equivalente en Bolívares (BCV):</span>
                    <span className="font-medium">Bs. {totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs rounded-lg py-2 px-4 shadow-sm"
                >
                  Emitir Cotización
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Facturar Cotización */}
      {invoicingQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-neutral-200 w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Facturar Cotización Directa</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Genera la factura oficial de venta con rebaja inmediata de stock
                </p>
              </div>
              <button
                onClick={() => setInvoicingQuotation(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvoiceQuotation} className="mt-4 space-y-4">
              <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 text-xs">
                <p className="font-semibold text-neutral-900">{invoicingQuotation.customerName}</p>
                <p className="text-neutral-500">{invoicingQuotation.customerDoc}</p>
                <p className="text-neutral-700 mt-1">
                  Monto Total: <strong>${invoicingQuotation.totalAmount.toFixed(2)} USD</strong> (Bs. {(invoicingQuotation.totalAmount * invoicingQuotation.exchangeRate).toFixed(2)})
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Nº Factura de Venta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. FACT-001095"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Nº Control SENIAT
                </label>
                <input
                  type="text"
                  placeholder="Ej. 00-994821"
                  value={controlNumber}
                  onChange={(e) => setControlNumber(e.target.value)}
                  className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="creditToggle"
                  checked={isCredit}
                  onChange={(e) => setIsCredit(e.target.checked)}
                  className="rounded-lg text-sky-600 focus:ring-sky-500"
                />
                <label htmlFor="creditToggle" className="text-xs text-neutral-700 font-medium">
                  Venta a Crédito (Registrar obligación pendiente en CxC)
                </label>
              </div>

              {isCredit && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Fecha de Vencimiento de Factura
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInvoicingQuotation(null)}
                  className="rounded-lg text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs rounded-lg py-2 px-4 shadow-sm"
                >
                  Emitir Factura y Rebajar Stock
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver Detalle */}
      {viewingQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-neutral-200 w-full max-w-xl p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-neutral-900">{viewingQuotation.quotationNumber}</h3>
                {renderStatusBadge(viewingQuotation.status)}
              </div>
              <button
                onClick={() => setViewingQuotation(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                <div>
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">Cliente</span>
                  <p className="font-semibold text-neutral-900">{viewingQuotation.customerName}</p>
                  <p className="font-mono text-neutral-500">{viewingQuotation.customerDoc}</p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">Emisión / Validez</span>
                  <p className="text-neutral-800">{new Date(viewingQuotation.quotationDate).toLocaleDateString('es-VE')}</p>
                  <p className="text-neutral-500">Hasta: {viewingQuotation.validUntilDate}</p>
                </div>
              </div>

              {viewingQuotation.notes && (
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">Observaciones</span>
                  <p className="text-neutral-700 mt-0.5">{viewingQuotation.notes}</p>
                </div>
              )}

              <div className="pt-3 border-t border-neutral-200 flex justify-between items-baseline">
                <span className="text-xs text-neutral-500">Tasa: Bs. {viewingQuotation.exchangeRate.toFixed(2)}/USD</span>
                <div className="text-right">
                  <p className="text-lg font-bold text-neutral-900">
                    Total: ${viewingQuotation.totalAmount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-neutral-500">
                    Bs. {(viewingQuotation.totalAmount * viewingQuotation.exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setViewingQuotation(null)}
                className="rounded-lg text-xs"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
