import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import {
  PackageCheck,
  Plus,
  Trash2,
  X,
  Building2,
  Warehouse,
  Receipt,
  FileCheck,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { formatMoneyUSD, formatMoneyVES } from '../../utils/formatters';

interface GoodsReceiptRecord {
  id: string;
  receiptNumber: string;
  supplierDeliveryNote?: string | null;
  receiptDate: string;
  currency: 'USD' | 'VES';
  exchangeRate: number;
  totalCost: number;
  status: 'RECEIVED' | 'INVOICED' | 'ANNULLED';
  purchaseInvoiceId?: string | null;
  notes?: string | null;
  supplierName: string;
  supplierRif: string;
  warehouseName: string;
  branchName: string;
  receivedByUserName: string;
  purchaseOrderNumber?: string | null;
}

interface NewReceiptItem {
  productId: string;
  productName: string;
  sku: string;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
  notes?: string;
}

const DEMO_RECEIPTS: GoodsReceiptRecord[] = [
  {
    id: 'gr-01',
    receiptNumber: 'REC-2026-0001',
    supplierDeliveryNote: 'GD-884920',
    receiptDate: '2026-09-29T11:00:00Z',
    currency: 'USD',
    exchangeRate: 36.85,
    totalCost: 1150.0,
    status: 'RECEIVED',
    purchaseInvoiceId: null,
    notes: 'Recepción completa de harina y arroz según orden OC-2026-0001',
    supplierName: 'ALIMENTOS POLAR COMERCIAL C.A.',
    supplierRif: 'J-00041312-1',
    warehouseName: 'Almacén Central Mayorista',
    branchName: 'Sucursal Principal Caracas',
    receivedByUserName: 'Ing. Edgar Boscán',
    purchaseOrderNumber: 'OC-2026-0001',
  },
  {
    id: 'gr-02',
    receiptNumber: 'REC-2026-0002',
    supplierDeliveryNote: 'NE-44910',
    receiptDate: '2026-09-28T16:30:00Z',
    currency: 'USD',
    exchangeRate: 36.85,
    totalCost: 425.0,
    status: 'INVOICED',
    purchaseInvoiceId: 'inv-881',
    notes: 'Recepción parcial de cables y conectores. Facturada y enviada a CxP',
    supplierName: 'DISTRIBUIDORA FERRETERA EL TIGRE S.A.',
    supplierRif: 'J-30987654-2',
    warehouseName: 'Depósito Piso de Venta',
    branchName: 'Sucursal Este - Las Mercedes',
    receivedByUserName: 'María Pérez',
    purchaseOrderNumber: 'OC-2026-0002',
  },
];

const AVAILABLE_PRODUCTS = [
  { id: '11111111-1111-1111-1111-111111111111', sku: 'ALM-HAR-001', name: 'Harina de Maíz Blanco 1kg', defaultCost: 1.15 },
  { id: '22222222-2222-2222-2222-222222222222', sku: 'ALM-ARR-002', name: 'Arroz Blanco Tradicional 1kg', defaultCost: 1.25 },
  { id: '33333333-3333-3333-3333-333333333333', sku: 'BEB-REF-003', name: 'Refresco Cola 2L Botella', defaultCost: 1.80 },
  { id: '44444444-4444-4444-4444-444444444444', sku: 'FER-CAB-004', name: 'Cable Eléctrico THW #12 (Metro)', defaultCost: 0.65 },
];

const AVAILABLE_SUPPLIERS = [
  { id: 'sup-01', name: 'ALIMENTOS POLAR COMERCIAL C.A.', rif: 'J-00041312-1' },
  { id: 'sup-02', name: 'DISTRIBUIDORA FERRETERA EL TIGRE S.A.', rif: 'J-30987654-2' },
  { id: 'sup-03', name: 'EMBOTELLADORA NACIONAL C.A.', rif: 'J-12345678-9' },
];

export const GoodsReceiptsView: React.FC = () => {
  const { activeBranchId, activeWarehouseId } = useAuthStore();
  const [receipts, setReceipts] = useState<GoodsReceiptRecord[]>(DEMO_RECEIPTS);
  const [loading, setLoading] = useState(false);

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [invoicingReceipt, setInvoicingReceipt] = useState<GoodsReceiptRecord | null>(null);

  // Formulario Nueva Recepción
  const [supplierId, setSupplierId] = useState(AVAILABLE_SUPPLIERS[0].id);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [exchangeRate, setExchangeRate] = useState(36.85);
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptItems, setReceiptItems] = useState<NewReceiptItem[]>([
    {
      productId: AVAILABLE_PRODUCTS[0].id,
      productName: AVAILABLE_PRODUCTS[0].name,
      sku: AVAILABLE_PRODUCTS[0].sku,
      quantityReceived: 50,
      unitCost: AVAILABLE_PRODUCTS[0].defaultCost,
      totalCost: 57.5,
    },
  ]);

  // Formulario de Conversión a Factura CxP
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [controlNumber, setControlNumber] = useState('');
  const [isCredit, setIsCredit] = useState(true);
  const [dueDate, setDueDate] = useState('');

  const totalReceiptCost = receiptItems.reduce((acc, i) => acc + i.totalCost, 0);

  const handleAddItem = () => {
    const prod = AVAILABLE_PRODUCTS[0];
    setReceiptItems([
      ...receiptItems,
      {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        quantityReceived: 10,
        unitCost: prod.defaultCost,
        totalCost: Number((10 * prod.defaultCost).toFixed(2)),
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (receiptItems.length === 1) {
      toast.error('La recepción debe contener al menos un producto');
      return;
    }
    setReceiptItems(receiptItems.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    const updated = [...receiptItems];
    const item = updated[index];

    if (field === 'productId') {
      const p = AVAILABLE_PRODUCTS.find((pr) => pr.id === val);
      if (p) {
        item.productId = p.id;
        item.productName = p.name;
        item.sku = p.sku;
        item.unitCost = p.defaultCost;
      }
    } else if (field === 'quantityReceived') {
      item.quantityReceived = Number(val);
    } else if (field === 'unitCost') {
      item.unitCost = Number(val);
    } else if (field === 'notes') {
      item.notes = val;
    }

    item.totalCost = Number((item.quantityReceived * item.unitCost).toFixed(2));
    setReceiptItems(updated);
  };

  const handleCreateReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (receiptItems.length === 0) {
      toast.error('Debe incluir al menos un producto a recibir');
      return;
    }

    const supplier = AVAILABLE_SUPPLIERS.find((s) => s.id === supplierId);
    const newSeq = String(receipts.length + 1).padStart(4, '0');
    const newReceiptNumber = `REC-2026-${newSeq}`;

    const newRecord: GoodsReceiptRecord = {
      id: `gr-${Date.now()}`,
      receiptNumber: newReceiptNumber,
      supplierDeliveryNote: deliveryNote || null,
      receiptDate: new Date().toISOString(),
      currency: 'USD',
      exchangeRate,
      totalCost: Number(totalReceiptCost.toFixed(2)),
      status: 'RECEIVED',
      purchaseInvoiceId: null,
      notes: receiptNotes || null,
      supplierName: supplier?.name || 'Proveedor General',
      supplierRif: supplier?.rif || 'J-00000000-0',
      warehouseName: activeWarehouseId === 'w2222222-2222-2222-2222-222222222222' ? 'Depósito Piso de Venta' : 'Almacén Central Mayorista',
      branchName: activeBranchId === 'b2222222-2222-2222-2222-222222222222' ? 'Sucursal Este - Las Mercedes' : 'Sucursal Principal Caracas',
      receivedByUserName: 'Ing. Edgar Boscán',
      purchaseOrderNumber: poNumber || null,
    };

    setReceipts([newRecord, ...receipts]);
    setIsCreateOpen(false);
    toast.success(
      `Recepción ${newReceiptNumber} procesada. Stock incrementado y Costo Promedio actualizado en Kardex.`
    );
  };

  const handleConvertToInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoicingReceipt) return;
    if (!invoiceNumber.trim()) {
      toast.error('El número de factura fiscal del proveedor es obligatorio');
      return;
    }

    setReceipts(
      receipts.map((r) =>
        r.id === invoicingReceipt.id
          ? { ...r, status: 'INVOICED', purchaseInvoiceId: `inv-${Date.now()}` }
          : r
      )
    );

    toast.success(
      `Factura ${invoiceNumber} registrada exitosamente en Cuentas por Pagar (CxP).`
    );
    setInvoicingReceipt(null);
    setInvoiceNumber('');
    setControlNumber('');
  };

  const columns: Column<GoodsReceiptRecord>[] = [
    {
      header: 'Nº Recepción',
      accessorKey: 'receiptNumber',
      cell: (item) => (
        <span className="font-mono text-xs font-semibold text-emerald-700">{item.receiptNumber}</span>
      ),
    },
    {
      header: 'Fecha & Guía',
      accessorKey: 'receiptDate',
      cell: (item) => (
        <div className="text-xs text-neutral-700">
          <p>{new Date(item.receiptDate).toLocaleDateString('es-VE')}</p>
          {item.supplierDeliveryNote && (
            <span className="text-[10px] text-neutral-500 font-mono">Guía: {item.supplierDeliveryNote}</span>
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
      header: 'Depósito Destino',
      accessorKey: 'warehouseName',
      cell: (item) => (
        <div className="flex items-center gap-1.5 text-xs text-neutral-600">
          <Warehouse className="w-3.5 h-3.5 text-neutral-400" />
          <span>{item.warehouseName}</span>
        </div>
      ),
    },
    {
      header: 'Orden Compra',
      accessorKey: 'purchaseOrderNumber',
      cell: (item) => (
        item.purchaseOrderNumber ? (
          <span className="font-mono text-xs text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-200">
            {item.purchaseOrderNumber}
          </span>
        ) : (
          <span className="text-[10px] text-neutral-400 italic">Recepción Directa</span>
        )
      ),
    },
    {
      header: 'Costo Total',
      accessorKey: 'totalCost',
      cell: (item) => (
        <div className="text-right">
          <p className="text-xs font-semibold text-neutral-900">
            {formatMoneyUSD(item.totalCost)}
          </p>
          <p className="text-[10px] text-neutral-500">
            {formatMoneyVES(item.totalCost * item.exchangeRate)}
          </p>
        </div>
      ),
    },
    {
      header: 'Estado',
      accessorKey: 'status',
      cell: (item) => (
        item.status === 'RECEIVED' ? (
          <Badge variant="info" className="text-[10px]">Recibida en Depósito</Badge>
        ) : (
          <Badge variant="success" className="text-[10px]">Facturada en CxP</Badge>
        )
      ),
    },
    {
      header: 'Acciones',
      accessorKey: 'id',
      cell: (item) => (
        <div className="flex items-center gap-1.5 justify-end">
          {item.status === 'RECEIVED' && (
            <Button
              variant="outline"
              onClick={() => setInvoicingReceipt(item)}
              className="text-[11px] py-1 px-2 rounded-lg border-sky-300 text-sky-700 hover:bg-sky-50 flex items-center gap-1"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Facturar a CxP</span>
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
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Recepción de Mercancías</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Ingreso físico de productos a depósito con actualización automática de costo promedio y Kardex
          </p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg py-2 px-3 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Procesar Recepción</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Total Recepciones</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900 mt-2">{receipts.length}</p>
          <p className="text-[10px] text-neutral-400 mt-0.5">Ingresos procesados en el período</p>
        </Card>

        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Pendientes por Facturar</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">
            {receipts.filter((r) => r.status === 'RECEIVED').length}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">Mercancía recibida sin factura CxP</p>
        </Card>

        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Valor Ingresado ($)</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-sky-700 mt-2">
            {formatMoneyUSD(receipts.reduce((acc, r) => acc + r.totalCost, 0))}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">Costo total incorporado al inventario</p>
        </Card>
      </div>

      {/* Tabla de Recepciones */}
      <Card className="rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-sm">
        <DataTable
          columns={columns}
          data={receipts}
          isLoading={loading}
          searchPlaceholder="Buscar recepciones por proveedor, número o guía..."
        />
      </Card>

      {/* Modal Procesar Nueva Recepción */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-neutral-200 w-full max-w-4xl p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Recepción Física de Mercancía</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Registra el conteo de entrada al depósito y recalcula el costo ponderado
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReceipt} className="mt-4 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Proveedor *
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  >
                    {AVAILABLE_SUPPLIERS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Nº Guía / Nota de Entrega
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. GD-10294"
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Orden de Compra Ref. (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. OC-2026-0001"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
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

              {/* Detalle de Productos a Recibir */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                    Productos Físicamente Recibidos ({receiptItems.length})
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
                        <th className="py-2.5 px-3 w-32">Cant. Recibida</th>
                        <th className="py-2.5 px-3 w-36">Costo Facturado ($)</th>
                        <th className="py-2.5 px-3 w-32 text-right">Total ($)</th>
                        <th className="py-2.5 px-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {receiptItems.map((item, idx) => (
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
                              value={item.quantityReceived}
                              onChange={(e) => handleItemChange(idx, 'quantityReceived', e.target.value)}
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
                          <td className="py-2 px-3 text-right font-medium text-neutral-900">
                            {formatMoneyUSD(item.totalCost)}
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

              {/* Banner Informativo de Costeo */}
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs text-sky-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Impacto Automático:</strong> Esta recepción incrementará el stock disponible en el depósito seleccionado y recalculará el <strong>Costo Promedio Ponderado</strong> de cada producto registrado, asentando el comprobante en el Kardex valorizado.
                </p>
              </div>

              {/* Botones */}
              <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
                <span className="text-sm font-bold text-neutral-900">
                  Total Recepción: {formatMoneyUSD(totalReceiptCost)}
                </span>
                <div className="flex items-center gap-3">
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
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg py-2 px-4 shadow-sm"
                  >
                    Confirmar Entrada en Depósito
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Facturar en CxP */}
      {invoicingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-neutral-200 w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Facturar Recepción a CxP</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Generación de factura de compra oficial y registro de cuenta por pagar
                </p>
              </div>
              <button
                onClick={() => setInvoicingReceipt(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConvertToInvoice} className="mt-4 space-y-4">
              <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 text-xs">
                <p className="font-semibold text-neutral-900">{invoicingReceipt.supplierName}</p>
                <p className="text-neutral-500">{invoicingReceipt.supplierRif}</p>
                <p className="text-neutral-700 mt-1">
                  Monto a Facturar: <strong>{formatMoneyUSD(invoicingReceipt.totalCost)} USD</strong> ({formatMoneyVES(invoicingReceipt.totalCost * invoicingReceipt.exchangeRate)})
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Nº Factura del Proveedor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. FACT-009182"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Nº de Control Fiscal SENIAT
                </label>
                <input
                  type="text"
                  placeholder="Ej. 00-128491"
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
                  Compra a Crédito (Registrar obligación pendiente en CxP)
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
                  onClick={() => setInvoicingReceipt(null)}
                  className="rounded-lg text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs rounded-lg py-2 px-4 shadow-sm"
                >
                  Crear Factura y Asentar en CxP
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
