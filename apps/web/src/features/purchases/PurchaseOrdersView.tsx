import React, { useState, useEffect } from 'react';
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
  Truck,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { formatMoneyUSD, formatMoneyVES, formatExchangeRate } from '../../utils/formatters';

interface PurchaseOrderRecord {
  id: string;
  orderNumber: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  currency: 'USD' | 'VES';
  exchangeRate: number;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  notes?: string | null;
  supplierName: string;
  supplierRif: string;
  branchName: string;
  createdByUserName: string;
  itemsCount: number;
}

interface NewOrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantityOrdered: number;
  unitCost: number;
  taxRate: number;
  subtotal: number;
  total: number;
  notes?: string;
}

const DEMO_ORDERS: PurchaseOrderRecord[] = [
  {
    id: 'po-01',
    orderNumber: 'OC-2026-0001',
    orderDate: '2026-09-28T10:15:00Z',
    expectedDeliveryDate: '2026-10-05',
    currency: 'USD',
    exchangeRate: 36.85,
    subtotalAmount: 1450.0,
    taxAmount: 232.0,
    totalAmount: 1682.0,
    status: 'CONFIRMED',
    notes: 'Pedido mensual de harinas y pastas importadas',
    supplierName: 'ALIMENTOS POLAR COMERCIAL C.A.',
    supplierRif: 'J-00041312-1',
    branchName: 'Sucursal Principal Caracas',
    createdByUserName: 'Ing. Edgar Boscán',
    itemsCount: 3,
  },
  {
    id: 'po-02',
    orderNumber: 'OC-2026-0002',
    orderDate: '2026-09-29T08:30:00Z',
    expectedDeliveryDate: '2026-10-02',
    currency: 'USD',
    exchangeRate: 36.85,
    subtotalAmount: 850.0,
    taxAmount: 136.0,
    totalAmount: 986.0,
    status: 'PARTIALLY_RECEIVED',
    notes: 'Lote de repuestos eléctricos para mantenimiento',
    supplierName: 'DISTRIBUIDORA FERRETERA EL TIGRE S.A.',
    supplierRif: 'J-30987654-2',
    branchName: 'Sucursal Este - Las Mercedes',
    createdByUserName: 'Ing. Edgar Boscán',
    itemsCount: 2,
  },
  {
    id: 'po-03',
    orderNumber: 'OC-2026-0003',
    orderDate: '2026-09-29T14:00:00Z',
    expectedDeliveryDate: '2026-10-08',
    currency: 'USD',
    exchangeRate: 36.85,
    subtotalAmount: 520.0,
    taxAmount: 83.2,
    totalAmount: 603.2,
    status: 'DRAFT',
    notes: 'Borrador de reposición semanal de bebidas y jugos',
    supplierName: 'EMBOTELLADORA NACIONAL C.A.',
    supplierRif: 'J-12345678-9',
    branchName: 'Sucursal Principal Caracas',
    createdByUserName: 'María Pérez',
    itemsCount: 2,
  },
];

const AVAILABLE_PRODUCTS = [
  { id: '11111111-1111-1111-1111-111111111111', sku: 'ALM-HAR-001', name: 'Harina de Maíz Blanco 1kg', defaultCost: 1.15, taxRate: 0.0 },
  { id: '22222222-2222-2222-2222-222222222222', sku: 'ALM-ARR-002', name: 'Arroz Blanco Tradicional 1kg', defaultCost: 1.25, taxRate: 0.0 },
  { id: '33333333-3333-3333-3333-333333333333', sku: 'BEB-REF-003', name: 'Refresco Cola 2L Botella', defaultCost: 1.80, taxRate: 16.0 },
  { id: '44444444-4444-4444-4444-444444444444', sku: 'FER-CAB-004', name: 'Cable Eléctrico THW #12 (Metro)', defaultCost: 0.65, taxRate: 16.0 },
];

const AVAILABLE_SUPPLIERS = [
  { id: 'sup-01', name: 'ALIMENTOS POLAR COMERCIAL C.A.', rif: 'J-00041312-1' },
  { id: 'sup-02', name: 'DISTRIBUIDORA FERRETERA EL TIGRE S.A.', rif: 'J-30987654-2' },
  { id: 'sup-03', name: 'EMBOTELLADORA NACIONAL C.A.', rif: 'J-12345678-9' },
];

export const PurchaseOrdersView: React.FC = () => {
  const { activeBranchId } = useAuthStore();
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>(DEMO_ORDERS);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrderRecord | null>(null);

  // Formulario Nueva Orden
  const [selectedSupplierId, setSelectedSupplierId] = useState(AVAILABLE_SUPPLIERS[0].id);
  const [expectedDate, setExpectedDate] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [exchangeRate, setExchangeRate] = useState(36.85);
  const [orderNotes, setOrderNotes] = useState('');
  const [orderItems, setOrderItems] = useState<NewOrderItem[]>([
    {
      productId: AVAILABLE_PRODUCTS[0].id,
      productName: AVAILABLE_PRODUCTS[0].name,
      sku: AVAILABLE_PRODUCTS[0].sku,
      quantityOrdered: 100,
      unitCost: AVAILABLE_PRODUCTS[0].defaultCost,
      taxRate: AVAILABLE_PRODUCTS[0].taxRate,
      subtotal: 115.0,
      total: 115.0,
    },
  ]);

  // Totales de la nueva orden
  const orderSubtotal = orderItems.reduce((acc, i) => acc + i.subtotal, 0);
  const orderTax = orderItems.reduce((acc, i) => acc + (i.total - i.subtotal), 0);
  const orderTotalUSD = orderSubtotal + orderTax;
  const orderTotalVES = orderTotalUSD * exchangeRate;

  const handleAddItem = () => {
    const prod = AVAILABLE_PRODUCTS[0];
    const sub = Number((10 * prod.defaultCost).toFixed(2));
    const tax = Number((sub * (prod.taxRate / 100)).toFixed(2));
    setOrderItems([
      ...orderItems,
      {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        quantityOrdered: 10,
        unitCost: prod.defaultCost,
        taxRate: prod.taxRate,
        subtotal: sub,
        total: Number((sub + tax).toFixed(2)),
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (orderItems.length === 1) {
      toast.error('La orden debe contener al menos un producto');
      return;
    }
    setOrderItems(orderItems.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    const updated = [...orderItems];
    const current = updated[index];

    if (field === 'productId') {
      const p = AVAILABLE_PRODUCTS.find((item) => item.id === val);
      if (p) {
        current.productId = p.id;
        current.productName = p.name;
        current.sku = p.sku;
        current.unitCost = p.defaultCost;
        current.taxRate = p.taxRate;
      }
    } else if (field === 'quantityOrdered') {
      current.quantityOrdered = Number(val);
    } else if (field === 'unitCost') {
      current.unitCost = Number(val);
    } else if (field === 'taxRate') {
      current.taxRate = Number(val);
    } else if (field === 'notes') {
      current.notes = val;
    }

    const sub = Number((current.quantityOrdered * current.unitCost).toFixed(2));
    const tax = Number((sub * (current.taxRate / 100)).toFixed(2));
    current.subtotal = sub;
    current.total = Number((sub + tax).toFixed(2));

    setOrderItems(updated);
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      toast.error('Debe incluir al menos un producto');
      return;
    }

    const supplier = AVAILABLE_SUPPLIERS.find((s) => s.id === selectedSupplierId);
    const newSeq = String(orders.length + 1).padStart(4, '0');
    const newOrderNumber = `OC-2026-${newSeq}`;

    const newRecord: PurchaseOrderRecord = {
      id: `po-${Date.now()}`,
      orderNumber: newOrderNumber,
      orderDate: new Date().toISOString(),
      expectedDeliveryDate: expectedDate || null,
      currency,
      exchangeRate,
      subtotalAmount: Number(orderSubtotal.toFixed(2)),
      taxAmount: Number(orderTax.toFixed(2)),
      totalAmount: Number(orderTotalUSD.toFixed(2)),
      status: 'DRAFT',
      notes: orderNotes || null,
      supplierName: supplier?.name || 'Proveedor General',
      supplierRif: supplier?.rif || 'J-00000000-0',
      branchName: activeBranchId === 'b2222222-2222-2222-2222-222222222222' ? 'Sucursal Este - Las Mercedes' : 'Sucursal Principal Caracas',
      createdByUserName: 'Ing. Edgar Boscán',
      itemsCount: orderItems.length,
    };

    setOrders([newRecord, ...orders]);
    setIsCreateOpen(false);
    toast.success(`Orden ${newOrderNumber} creada exitosamente en estado Borrador`);
  };

  const handleConfirmOrder = (orderId: string) => {
    setOrders(
      orders.map((o) => (o.id === orderId ? { ...o, status: 'CONFIRMED' } : o))
    );
    toast.success('Orden de compra confirmada y emitida al proveedor');
  };

  const handleCancelOrder = (orderId: string) => {
    setOrders(
      orders.map((o) => (o.id === orderId ? { ...o, status: 'CANCELLED' } : o))
    );
    toast.info('Orden de compra cancelada');
  };

  // Filtrado de órdenes
  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
    return true;
  });

  // KPIs
  const totalActiveOrders = orders.filter((o) => o.status !== 'CANCELLED').length;
  const totalAmountUSD = orders.filter((o) => o.status !== 'CANCELLED').reduce((acc, o) => acc + o.totalAmount, 0);
  const pendingReceiptCount = orders.filter((o) => o.status === 'CONFIRMED' || o.status === 'PARTIALLY_RECEIVED').length;

  const renderStatusBadge = (status: PurchaseOrderRecord['status']) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="neutral" className="text-[10px]">Borrador</Badge>;
      case 'CONFIRMED':
        return <Badge variant="info" className="text-[10px]">Confirmada</Badge>;
      case 'PARTIALLY_RECEIVED':
        return <Badge variant="warning" className="text-[10px]">Recepción Parcial</Badge>;
      case 'RECEIVED':
        return <Badge variant="success" className="text-[10px]">Recibida Total</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger" className="text-[10px]">Cancelada</Badge>;
      default:
        return null;
    }
  };

  const columns: Column<PurchaseOrderRecord>[] = [
    {
      header: 'Nº Orden',
      accessorKey: 'orderNumber',
      cell: (item) => (
        <span className="font-mono text-xs font-semibold text-sky-700">{item.orderNumber}</span>
      ),
    },
    {
      header: 'Fecha Emisión',
      accessorKey: 'orderDate',
      cell: (item) => (
        <div className="text-xs text-neutral-700">
          <p>{new Date(item.orderDate).toLocaleDateString('es-VE')}</p>
          {item.expectedDeliveryDate && (
            <p className="text-[10px] text-neutral-500">Entrega: {item.expectedDeliveryDate}</p>
          )}
        </div>
      ),
    },
    {
      header: 'Proveedor & RIF',
      accessorKey: 'supplierName',
      cell: (item) => (
        <div>
          <p className="text-xs font-medium text-neutral-900">{item.supplierName}</p>
          <span className="font-mono text-[10px] text-neutral-500">{item.supplierRif}</span>
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
      header: 'Ítems',
      accessorKey: 'itemsCount',
      cell: (item) => (
        <span className="text-xs font-medium text-neutral-700">{item.itemsCount} productos</span>
      ),
    },
    {
      header: 'Monto Total',
      accessorKey: 'totalAmount',
      cell: (item) => (
        <div className="text-right">
          <p className="text-xs font-semibold text-neutral-900">
            {formatMoneyUSD(item.totalAmount)}
          </p>
          <p className="text-[10px] text-neutral-500">
            {formatMoneyVES(item.totalAmount * item.exchangeRate)}
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
            onClick={() => setViewingOrder(item)}
            className="p-1 text-neutral-500 hover:text-sky-600 rounded-lg hover:bg-neutral-100"
            title="Ver Detalle"
          >
            <Eye className="w-4 h-4" />
          </button>
          {item.status === 'DRAFT' && (
            <button
              onClick={() => handleConfirmOrder(item.id)}
              className="p-1 text-emerald-600 hover:text-emerald-700 rounded-lg hover:bg-emerald-50"
              title="Confirmar Orden"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {item.status !== 'RECEIVED' && item.status !== 'CANCELLED' && (
            <button
              onClick={() => handleCancelOrder(item.id)}
              className="p-1 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50"
              title="Cancelar Orden"
            >
              <Ban className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Encabezado y Acción Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Órdenes de Compra</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Gestión y seguimiento del ciclo de abastecimiento de inventario con proveedores
          </p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs rounded-lg py-2 px-3 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Orden de Compra</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Órdenes Activas</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900 mt-2">{totalActiveOrders}</p>
          <p className="text-[10px] text-neutral-400 mt-0.5">En curso o completadas</p>
        </Card>

        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Monto Comprometido</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">
            {formatMoneyUSD(totalAmountUSD)}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">Total adquisiciones valorizadas</p>
        </Card>

        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Pendientes por Recibir</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">{pendingReceiptCount}</p>
          <p className="text-[10px] text-neutral-400 mt-0.5">Esperando recepción en depósito</p>
        </Card>
      </div>

      {/* Filtros de Estado */}
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-2 overflow-x-auto">
        {['ALL', 'DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'].map((st) => (
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
            {st === 'DRAFT' && 'Borradores'}
            {st === 'CONFIRMED' && 'Confirmadas'}
            {st === 'PARTIALLY_RECEIVED' && 'Parciales'}
            {st === 'RECEIVED' && 'Recibidas'}
            {st === 'CANCELLED' && 'Canceladas'}
          </button>
        ))}
      </div>

      {/* Tabla de Órdenes */}
      <Card className="rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-sm">
        <DataTable
          columns={columns}
          data={filteredOrders}
          isLoading={loading}
          searchPlaceholder="Buscar órdenes por proveedor, correlativo..."
        />
      </Card>

      {/* Modal Nueva Orden de Compra */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-neutral-200 w-full max-w-4xl p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Nueva Orden de Compra</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Emisión formal de pedido de mercancía hacia proveedor
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="mt-4 space-y-5">
              {/* Cabecera Proveedor y Fechas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Proveedor Destinatario *
                  </label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    {AVAILABLE_SUPPLIERS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.rif})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Fecha Estimada de Entrega
                  </label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Tasa Oficial BCV (USD / VES)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(Number(e.target.value))}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Detalle de Productos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                    Líneas de la Orden ({orderItems.length})
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddItem}
                    className="text-xs rounded-lg py-1 px-2.5 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Producto</span>
                  </Button>
                </div>

                <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-medium">
                      <tr>
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-3 w-28">Cantidad</th>
                        <th className="py-2.5 px-3 w-32">Costo Unit. ($)</th>
                        <th className="py-2.5 px-3 w-24">IVA (%)</th>
                        <th className="py-2.5 px-3 w-32 text-right">Subtotal ($)</th>
                        <th className="py-2.5 px-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {orderItems.map((item, idx) => (
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
                              value={item.quantityOrdered}
                              onChange={(e) => handleItemChange(idx, 'quantityOrdered', e.target.value)}
                              className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-neutral-800"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitCost}
                              onChange={(e) => handleItemChange(idx, 'unitCost', e.target.value)}
                              className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-neutral-800"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={item.taxRate}
                              onChange={(e) => handleItemChange(idx, 'taxRate', e.target.value)}
                              className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2 py-1.5 text-neutral-800"
                            >
                              <option value="0">0% Exento</option>
                              <option value="8">8% Reducido</option>
                              <option value="16">16% General</option>
                            </select>
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-neutral-900">
                            {formatMoneyUSD(item.subtotal)}
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

              {/* Notas y Resumen de Totales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start pt-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Instrucciones / Observaciones
                  </label>
                  <textarea
                    rows={3}
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Instrucciones especiales de despacho, contacto o términos comerciales..."
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg p-2.5 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200 space-y-2">
                  <div className="flex justify-between text-xs text-neutral-600">
                    <span>Subtotal Base Imponible:</span>
                    <span className="font-semibold">{formatMoneyUSD(orderSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-neutral-600">
                    <span>IVA Estimado:</span>
                    <span className="font-semibold">{formatMoneyUSD(orderTax)}</span>
                  </div>
                  <div className="pt-2 border-t border-neutral-200 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-neutral-900">Total Orden (USD):</span>
                    <span className="text-base font-bold text-sky-700">{formatMoneyUSD(orderTotalUSD)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-neutral-500">
                    <span>Equivalente en Bolívares (BCV):</span>
                    <span className="font-medium">{formatMoneyVES(orderTotalVES)}</span>
                  </div>
                </div>
              </div>

              {/* Botones de Acción */}
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
                  Emitir Orden de Compra
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver Detalle de Orden */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-neutral-200 w-full max-w-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-neutral-900">Orden {viewingOrder.orderNumber}</h3>
                  {renderStatusBadge(viewingOrder.status)}
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Emitida el {new Date(viewingOrder.orderDate).toLocaleDateString('es-VE')} por {viewingOrder.createdByUserName}
                </p>
              </div>
              <button
                onClick={() => setViewingOrder(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                <div>
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">Proveedor</span>
                  <p className="font-semibold text-neutral-900">{viewingOrder.supplierName}</p>
                  <p className="font-mono text-neutral-500">{viewingOrder.supplierRif}</p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">Destino</span>
                  <p className="font-semibold text-neutral-900">{viewingOrder.branchName}</p>
                  {viewingOrder.expectedDeliveryDate && (
                    <p className="text-neutral-500">Fecha entrega estimada: {viewingOrder.expectedDeliveryDate}</p>
                  )}
                </div>
              </div>

              {viewingOrder.notes && (
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">Observaciones</span>
                  <p className="text-neutral-700 mt-0.5">{viewingOrder.notes}</p>
                </div>
              )}

              <div className="border-t border-neutral-200 pt-3 flex justify-between items-center">
                <span className="text-xs text-neutral-500">Tasa de cambio: {formatExchangeRate(viewingOrder.exchangeRate)}/USD</span>
                <div className="text-right">
                  <p className="text-lg font-bold text-neutral-900">
                    Total: {formatMoneyUSD(viewingOrder.totalAmount)}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {formatMoneyVES(viewingOrder.totalAmount * viewingOrder.exchangeRate)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setViewingOrder(null)}
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
