import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import {
  Truck,
  Plus,
  Trash2,
  X,
  Warehouse,
  Receipt,
  FileCheck,
  DollarSign,
  AlertCircle,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { formatMoneyUSD, formatMoneyVES } from '@ero/shared';

interface DeliveryNoteRecord {
  id: string;
  deliveryNumber: string;
  deliveryDate: string;
  currency: 'USD' | 'VES';
  exchangeRate: number;
  totalAmount: number;
  driverName?: string | null;
  vehiclePlate?: string | null;
  status: 'DELIVERED' | 'INVOICED' | 'ANNULLED';
  salesInvoiceId?: string | null;
  notes?: string | null;
  customerName: string;
  customerDoc: string;
  warehouseName: string;
  branchName: string;
  dispatchedByUserName: string;
  quotationNumber?: string | null;
}

interface NewDeliveryItem {
  productId: string;
  productName: string;
  sku: string;
  quantityDelivered: number;
  unitPrice: number;
  total: number;
  notes?: string;
}

const DEMO_DELIVERIES: DeliveryNoteRecord[] = [
  {
    id: 'dn-01',
    deliveryNumber: 'NE-2026-0001',
    deliveryDate: '2026-09-29T10:00:00Z',
    currency: 'USD',
    exchangeRate: 36.85,
    totalAmount: 950.0,
    driverName: 'Carlos Zambrano',
    vehiclePlate: 'A92BK3D',
    status: 'DELIVERED',
    salesInvoiceId: null,
    notes: 'Despacho de bultos de harina y arroz en camión propio',
    customerName: 'CONSTRUCTORA METROPOLITANA C.A.',
    customerDoc: 'J-29881723-4',
    warehouseName: 'Almacén Central Mayorista',
    branchName: 'Sucursal Principal Caracas',
    dispatchedByUserName: 'Ing. Edgar Boscán',
    quotationNumber: 'COT-2026-0001',
  },
  {
    id: 'dn-02',
    deliveryNumber: 'NE-2026-0002',
    deliveryDate: '2026-09-28T14:45:00Z',
    currency: 'USD',
    exchangeRate: 36.85,
    totalAmount: 340.0,
    driverName: 'Despacho Express Motocicleta',
    vehiclePlate: 'AB4X21',
    status: 'INVOICED',
    salesInvoiceId: 'inv-1092',
    notes: 'Entrega en sede este. Facturada con Factura Fiscal FACT-001092',
    customerName: 'CLÍNICA SANTA MARÍA S.A.',
    customerDoc: 'J-31009821-0',
    warehouseName: 'Depósito Piso de Venta',
    branchName: 'Sucursal Este - Las Mercedes',
    dispatchedByUserName: 'María Pérez',
    quotationNumber: null,
  },
];

const AVAILABLE_PRODUCTS = [
  { id: '11111111-1111-1111-1111-111111111111', sku: 'ALM-HAR-001', name: 'Harina de Maíz Blanco 1kg', basePrice: 1.45, availableStock: 250 },
  { id: '22222222-2222-2222-2222-222222222222', sku: 'ALM-ARR-002', name: 'Arroz Blanco Tradicional 1kg', basePrice: 1.60, availableStock: 180 },
  { id: '33333333-3333-3333-3333-333333333333', sku: 'BEB-REF-003', name: 'Refresco Cola 2L Botella', basePrice: 2.25, availableStock: 90 },
  { id: '44444444-4444-4444-4444-444444444444', sku: 'FER-CAB-004', name: 'Cable Eléctrico THW #12 (Metro)', basePrice: 0.95, availableStock: 500 },
];

const AVAILABLE_CUSTOMERS = [
  { id: 'cus-01', name: 'CONSTRUCTORA METROPOLITANA C.A.', doc: 'J-29881723-4' },
  { id: 'cus-02', name: 'CLÍNICA SANTA MARÍA S.A.', doc: 'J-31009821-0' },
  { id: 'cus-03', name: 'HOTEL BELLO MONTE C.A.', doc: 'J-18920199-5' },
];

export const DeliveryNotesView: React.FC = () => {
  const { activeBranchId, activeWarehouseId } = useAuthStore();
  const [deliveries, setDeliveries] = useState<DeliveryNoteRecord[]>(DEMO_DELIVERIES);
  const [loading, setLoading] = useState(false);

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [invoicingDelivery, setInvoicingDelivery] = useState<DeliveryNoteRecord | null>(null);

  // Formulario Nueva Nota de Entrega
  const [customerId, setCustomerId] = useState(AVAILABLE_CUSTOMERS[0].id);
  const [driverName, setDriverName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [quotationRef, setQuotationRef] = useState('');
  const [exchangeRate, setExchangeRate] = useState(36.85);
  const [deliveryNotesText, setDeliveryNotesText] = useState('');
  const [deliveryItems, setDeliveryItems] = useState<NewDeliveryItem[]>([
    {
      productId: AVAILABLE_PRODUCTS[0].id,
      productName: AVAILABLE_PRODUCTS[0].name,
      sku: AVAILABLE_PRODUCTS[0].sku,
      quantityDelivered: 50,
      unitPrice: AVAILABLE_PRODUCTS[0].basePrice,
      total: 72.5,
    },
  ]);

  // Formulario Facturación de Nota de Entrega
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [controlNumber, setControlNumber] = useState('');
  const [isCredit, setIsCredit] = useState(true);
  const [dueDate, setDueDate] = useState('');

  const totalDeliveryAmount = deliveryItems.reduce((acc, i) => acc + i.total, 0);

  const handleAddItem = () => {
    const prod = AVAILABLE_PRODUCTS[0];
    setDeliveryItems([
      ...deliveryItems,
      {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        quantityDelivered: 10,
        unitPrice: prod.basePrice,
        total: Number((10 * prod.basePrice).toFixed(2)),
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (deliveryItems.length === 1) {
      toast.error('Debe incluir al menos un producto a despachar');
      return;
    }
    setDeliveryItems(deliveryItems.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    const updated = [...deliveryItems];
    const item = updated[index];

    if (field === 'productId') {
      const p = AVAILABLE_PRODUCTS.find((pr) => pr.id === val);
      if (p) {
        item.productId = p.id;
        item.productName = p.name;
        item.sku = p.sku;
        item.unitPrice = p.basePrice;
      }
    } else if (field === 'quantityDelivered') {
      item.quantityDelivered = Number(val);
    } else if (field === 'unitPrice') {
      item.unitPrice = Number(val);
    } else if (field === 'notes') {
      item.notes = val;
    }

    item.total = Number((item.quantityDelivered * item.unitPrice).toFixed(2));
    setDeliveryItems(updated);
  };

  const handleCreateDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (deliveryItems.length === 0) {
      toast.error('Debe incluir al menos un producto a despachar');
      return;
    }

    const customer = AVAILABLE_CUSTOMERS.find((c) => c.id === customerId);
    const newSeq = String(deliveries.length + 1).padStart(4, '0');
    const newDeliveryNumber = `NE-2026-${newSeq}`;

    const newRecord: DeliveryNoteRecord = {
      id: `dn-${Date.now()}`,
      deliveryNumber: newDeliveryNumber,
      deliveryDate: new Date().toISOString(),
      currency: 'USD',
      exchangeRate,
      totalAmount: Number(totalDeliveryAmount.toFixed(2)),
      driverName: driverName || null,
      vehiclePlate: vehiclePlate || null,
      status: 'DELIVERED',
      salesInvoiceId: null,
      notes: deliveryNotesText || null,
      customerName: customer?.name || 'Cliente Comercial',
      customerDoc: customer?.doc || 'V-00000000',
      warehouseName: activeWarehouseId === 'w2222222-2222-2222-2222-222222222222' ? 'Depósito Piso de Venta' : 'Almacén Central Mayorista',
      branchName: activeBranchId === 'b2222222-2222-2222-2222-222222222222' ? 'Sucursal Este - Las Mercedes' : 'Sucursal Principal Caracas',
      dispatchedByUserName: 'Ing. Edgar Boscán',
      quotationNumber: quotationRef || null,
    };

    setDeliveries([newRecord, ...deliveries]);
    setIsCreateOpen(false);
    toast.success(
      `Nota de Entrega ${newDeliveryNumber} procesada. Stock rebajado en depósito y Kardex actualizado.`
    );
  };

  const handleInvoiceDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoicingDelivery) return;
    if (!invoiceNumber.trim()) {
      toast.error('El número de factura fiscal es obligatorio');
      return;
    }

    setDeliveries(
      deliveries.map((d) =>
        d.id === invoicingDelivery.id
          ? { ...d, status: 'INVOICED', salesInvoiceId: `inv-${Date.now()}` }
          : d
      )
    );

    toast.success(
      `Factura ${invoiceNumber} generada para la Nota de Entrega. Registrada en Cuentas por Cobrar (CxC).`
    );
    setInvoicingDelivery(null);
    setInvoiceNumber('');
    setControlNumber('');
  };

  const columns: Column<DeliveryNoteRecord>[] = [
    {
      header: 'Nº Despacho',
      accessorKey: 'deliveryNumber',
      cell: (item) => (
        <span className="font-mono text-xs font-semibold text-emerald-700">{item.deliveryNumber}</span>
      ),
    },
    {
      header: 'Fecha Emisión',
      accessorKey: 'deliveryDate',
      cell: (item) => (
        <span className="text-xs text-neutral-700">
          {new Date(item.deliveryDate).toLocaleDateString('es-VE')}
        </span>
      ),
    },
    {
      header: 'Cliente & Documento',
      accessorKey: 'customerName',
      cell: (item) => (
        <div>
          <p className="text-xs font-medium text-neutral-900">{item.customerName}</p>
          <span className="font-mono text-[10px] text-neutral-500">{item.customerDoc}</span>
        </div>
      ),
    },
    {
      header: 'Depósito Salida',
      accessorKey: 'warehouseName',
      cell: (item) => (
        <div className="flex items-center gap-1.5 text-xs text-neutral-600">
          <Warehouse className="w-3.5 h-3.5 text-neutral-400" />
          <span>{item.warehouseName}</span>
        </div>
      ),
    },
    {
      header: 'Transporte / Conductor',
      accessorKey: 'driverName',
      cell: (item) => (
        item.driverName ? (
          <div className="text-xs text-neutral-700">
            <p className="font-medium">{item.driverName}</p>
            {item.vehiclePlate && (
              <span className="font-mono text-[10px] text-neutral-500">Placa: {item.vehiclePlate}</span>
            )}
          </div>
        ) : (
          <span className="text-[10px] text-neutral-400 italic">Entrega en Mostrador</span>
        )
      ),
    },
    {
      header: 'Monto Total',
      accessorKey: 'totalAmount',
      cell: (item) => (
        <div className="text-right font-mono">
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
      cell: (item) => (
        item.status === 'DELIVERED' ? (
          <Badge variant="info" className="text-[10px]">Despachada / Pendiente Factura</Badge>
        ) : (
          <Badge variant="success" className="text-[10px]">Facturada en CxC</Badge>
        )
      ),
    },
    {
      header: 'Acciones',
      accessorKey: 'id',
      cell: (item) => (
        <div className="flex items-center gap-1.5 justify-end">
          {item.status === 'DELIVERED' && (
            <Button
              variant="outline"
              onClick={() => setInvoicingDelivery(item)}
              className="text-[11px] py-1 px-2 rounded-lg border-sky-300 text-sky-700 hover:bg-sky-50 flex items-center gap-1"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Facturar a CxC</span>
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
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Notas de Entrega & Despachos</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Entrega física y salida de inventario con control de transportista y facturación posterior
          </p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg py-2 px-3 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Nota de Entrega</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Total Despachos</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900 mt-2">{deliveries.length}</p>
          <p className="text-[10px] text-neutral-400 mt-0.5">Notas emitidas en el ciclo</p>
        </Card>

        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Pendientes por Facturar</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">
            {deliveries.filter((d) => d.status === 'DELIVERED').length}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">Mercancía entregada sin factura fiscal</p>
        </Card>

        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Valor Despachado ($)</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-sky-700 mt-2 font-mono">
            {formatMoneyUSD(deliveries.reduce((acc, d) => acc + d.totalAmount, 0))}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">Mercancía salida del inventario</p>
        </Card>
      </div>

      {/* Tabla de Notas de Entrega */}
      <Card className="rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-sm">
        <DataTable
          columns={columns}
          data={deliveries}
          isLoading={loading}
          searchPlaceholder="Buscar por número de despacho, cliente o conductor..."
        />
      </Card>

      {/* Modal Nueva Nota de Entrega */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-neutral-200 w-full max-w-4xl p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Nueva Nota de Entrega / Despacho</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Salida física de productos desde el depósito con rebaja de stock
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDelivery} className="mt-4 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Cliente Destinatario *
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  >
                    {AVAILABLE_CUSTOMERS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Nombre del Conductor
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Juan Pérez"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Placa del Vehículo
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. A88CK2D"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Cotización Ref. (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. COT-2026-0001"
                    value={quotationRef}
                    onChange={(e) => setQuotationRef(e.target.value)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                  />
                </div>
              </div>

              {/* Detalle de Productos a Despachar */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                    Productos a Despachar ({deliveryItems.length})
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
                        <th className="py-2.5 px-3 w-32">Cant. Despachar</th>
                        <th className="py-2.5 px-3 w-32">Precio Unit. ($)</th>
                        <th className="py-2.5 px-3 w-32 text-right">Total ($)</th>
                        <th className="py-2.5 px-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {deliveryItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50/50">
                          <td className="py-2 px-3">
                            <select
                              value={item.productId}
                              onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                              className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-neutral-800"
                            >
                              {AVAILABLE_PRODUCTS.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.sku} - {p.name} (Disp: {p.availableStock})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantityDelivered}
                              onChange={(e) => handleItemChange(idx, 'quantityDelivered', e.target.value)}
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
                          <td className="py-2 px-3 text-right font-medium text-neutral-900 font-mono">
                            {formatMoneyUSD(item.total)}
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

              {/* Banner Informativo de Descuento de Stock */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Aviso de Inventario:</strong> Al emitir esta Nota de Entrega, las cantidades serán rebajadas físicamente del stock disponible en el depósito de forma inmediata, evitando doble facturación de inventario cuando se procese la factura fiscal.
                </p>
              </div>

              {/* Botones */}
              <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
                <span className="text-sm font-bold text-neutral-900 font-mono">
                  Total Despacho: {formatMoneyUSD(totalDeliveryAmount)}
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
                    Confirmar Despacho y Rebajar Stock
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Facturar Despacho en CxC */}
      {invoicingDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-neutral-200 w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Facturar Despacho a CxC</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Generación de factura fiscal vinculada a la nota de entrega
                </p>
              </div>
              <button
                onClick={() => setInvoicingDelivery(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvoiceDelivery} className="mt-4 space-y-4">
              <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 text-xs">
                <p className="font-semibold text-neutral-900">{invoicingDelivery.customerName}</p>
                <p className="text-neutral-500">{invoicingDelivery.customerDoc}</p>
                <p className="text-neutral-700 mt-1">
                  Monto a Facturar: <strong>{formatMoneyUSD(invoicingDelivery.totalAmount)}</strong> ({formatMoneyVES(invoicingDelivery.totalAmount * invoicingDelivery.exchangeRate)})
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Nº Factura de Venta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. FACT-001096"
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
                  placeholder="Ej. 00-112233"
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
                  onClick={() => setInvoicingDelivery(null)}
                  className="rounded-lg text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs rounded-lg py-2 px-4 shadow-sm"
                >
                  Emitir Factura y Asentar en CxC
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
