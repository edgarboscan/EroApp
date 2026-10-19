import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { useEscapeKey } from '../../components/ui/Modal';
import { useExchangeRateStore } from "../../stores/exchangeRateStore";
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
  Search,
  FileText,
} from 'lucide-react';
import { SupplierSearchModal, ProductSearchModal } from '../../components/search';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { formatMoneyUSD, formatMoneyVES, formatExchangeRate
 } from '../../utils/formatters';
import { showConfirmQuestion } from '../../lib/sweetalert';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';


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

export const GoodsReceiptsView: React.FC = () => {
  const { activeBranchId, activeWarehouseId, token } = useAuthStore();
  const [receipts, setReceipts] = useState<GoodsReceiptRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Catálogos desde BD
  const [availableProducts, setAvailableProducts] = useState<{ id: string; sku: string; name: string; defaultCost: number }[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<{ id: string; name: string; rif: string }[]>([]);

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [invoicingReceipt, setInvoicingReceipt] = useState<GoodsReceiptRecord | null>(null);
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);
  const [productSearchRowIdx, setProductSearchRowIdx] = useState<number | null>(null);
  const [isAddingFromSearch, setIsAddingFromSearch] = useState(false);
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    endpoint: string | null;
    title: string;
    filename?: string;
  }>({
    isOpen: false,
    endpoint: null,
    title: '',
  });

  useEscapeKey(() => {
    if (showSupplierSearch) setShowSupplierSearch(false);
    else if (productSearchRowIdx !== null) setProductSearchRowIdx(null);
    else if (isAddingFromSearch) setIsAddingFromSearch(false);
    else if (invoicingReceipt) setInvoicingReceipt(null);
    else if (isCreateOpen) setIsCreateOpen(false);
  }, Boolean(showSupplierSearch || productSearchRowIdx !== null || isAddingFromSearch || invoicingReceipt || isCreateOpen));

  // Formulario Nueva Recepción
    const rate = useExchangeRateStore((s) => s.rate);
  const [supplierId, setSupplierId] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [exchangeRate, setExchangeRate] = useState(rate);
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptItems, setReceiptItems] = useState<NewReceiptItem[]>([]);

  // Formulario de Conversión a Factura CxP
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [controlNumber, setControlNumber] = useState('');
  const [isCredit, setIsCredit] = useState(true);
  const [dueDate, setDueDate] = useState('');

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeBranchId) params.append('branchId', activeBranchId);
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/purchases/receipts?${params.toString()}`, { headers });
      if (res.ok) {
        const json = await res.json();
        setReceipts(Array.isArray(json.data) ? json.data : []);
      } else {
        setReceipts([]);
      }
    } catch {
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const [prodRes, supRes] = await Promise.all([
          fetch('/api/inventory/products', { headers }),
          fetch('/api/suppliers', { headers }),
        ]);

        if (prodRes.ok) {
          const pJson = await prodRes.json();
          if (pJson.success && Array.isArray(pJson.data)) {
            const mappedProds = pJson.data.map((p: any) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              defaultCost: Number(p.costPrice || p.cost_price || 0),
            }));
            setAvailableProducts(mappedProds);
          }
        }

        if (supRes.ok) {
          const sJson = await supRes.json();
          if (sJson.success && Array.isArray(sJson.data)) {
            const mappedSups = sJson.data.map((s: any) => ({
              id: s.id,
              name: s.name,
              rif: s.rif,
            }));
            setAvailableSuppliers(mappedSups);
            if (mappedSups.length > 0) setSupplierId(mappedSups[0].id);
          }
        }
      } catch {
        // Ignorar
      }
    };

    fetchCatalogs();
  }, [token]);

  useEffect(() => {
    fetchReceipts();
  }, [activeBranchId, token]);

  const totalReceiptCost = receiptItems.reduce((acc, i) => acc + i.totalCost, 0);

  const handleAddItem = () => {
    if (availableProducts.length === 0) {
      toast.error('No hay productos disponibles en el catálogo de inventario');
      return;
    }
    const prod = availableProducts[0];
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

  const handleAddItemWithProduct = (prod: any) => {
    const cost = Number(prod.defaultCost ?? prod.costPrice ?? 0);
    setReceiptItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        quantityReceived: 10,
        unitCost: cost,
        totalCost: Number((10 * cost).toFixed(2)),
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setReceiptItems(receiptItems.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    const updated = [...receiptItems];
    const item = updated[index];

    if (field === 'productId') {
      const p = availableProducts.find((pr) => pr.id === val);
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

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast.error('Debe seleccionar un proveedor');
      return;
    }
    if (receiptItems.length === 0) {
      toast.error('Debe incluir al menos un producto a recibir');
      return;
    }

    const supplier = availableSuppliers.find((s) => s.id === supplierId);

    const confirmed = await showConfirmQuestion({
      title: '¿Confirmar recepción de mercancía?',
      text: `Se registrará la entrada de ${receiptItems.length} producto(s) por un total de $${totalReceiptCost.toFixed(2)} a favor de ${supplier?.name || 'proveedor seleccionado'}. Se afectará el inventario físico y costo promedio.`,
      confirmButtonText: 'Sí, confirmar recepción',
      cancelButtonText: 'Cancelar',
      icon: 'question',
    });
    if (!confirmed) return;

    try {
      const res = await fetch('/api/purchases/receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          branchId: activeBranchId || undefined,
          warehouseId: activeWarehouseId || undefined,
          supplierId,
          supplierDeliveryNote: deliveryNote || undefined,
          purchaseOrderNumber: poNumber || undefined,
          currency: 'USD',
          exchangeRate,
          notes: receiptNotes || undefined,
          items: receiptItems.map((i) => ({
            productId: i.productId,
            quantityReceived: i.quantityReceived,
            unitCost: i.unitCost,
            notes: i.notes || undefined,
          })),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Recepción ${json.data.receiptNumber} procesada exitosamente en inventario`);
        setIsCreateOpen(false);
        setReceiptItems([]);
        fetchReceipts();

        // Abrir inmediatamente la visualización y descarga en PDF
        if (json.data?.id) {
          setPdfModal({
            isOpen: true,
            endpoint: `/api/purchases/receipts/${json.data.id}/pdf`,
            title: `Acta de Recepción de Mercancía N° ${json.data.receiptNumber || ''}`,
            filename: `acta_recepcion_${json.data.receiptNumber || 'doc'}.pdf`,
          });
        }
      } else {
        throw new Error(json.error?.message || 'Error al procesar recepción');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al registrar recepción de mercancía');
    }
  };

  const handleConvertToInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoicingReceipt) return;
    if (!invoiceNumber.trim()) {
      toast.error('El número de factura fiscal del proveedor es obligatorio');
      return;
    }

    const confirmed = await showConfirmQuestion({
      title: '¿Generar factura y cuenta por pagar?',
      text: `Se creará la cuenta por pagar vinculada a la factura ${invoiceNumber} por $${invoicingReceipt.totalCost.toFixed(2)}.`,
      confirmButtonText: 'Sí, generar factura',
      cancelButtonText: 'Cancelar',
      icon: 'question',
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/purchases/receipts/${invoicingReceipt.id}/invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          invoiceNumber: invoiceNumber.trim(),
          controlNumber: controlNumber.trim() || undefined,
          isCredit,
          dueDate: dueDate || undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Factura ${invoiceNumber} registrada exitosamente en Cuentas por Pagar`);
        setInvoicingReceipt(null);
        setInvoiceNumber('');
        setControlNumber('');
        fetchReceipts();
      } else {
        throw new Error(json.error?.message || 'Error al convertir a factura');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al registrar factura fiscal');
    }
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
          <button
            onClick={() =>
              setPdfModal({
                isOpen: true,
                endpoint: `/api/purchases/receipts/${item.id}/pdf`,
                title: `Acta de Recepción ${item.receiptNumber}`,
                filename: `acta_recepcion_${item.receiptNumber}.pdf`,
              })
            }
            className="p-1 text-neutral-500 hover:text-sky-600 rounded-lg hover:bg-neutral-100"
            title="Ver / Reimprimir Acta de Recepción en PDF"
          >
            <FileText className="w-4 h-4 text-sky-600" />
          </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-neutral-200 w-full max-w-4xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden my-auto">
            {/* Header (Pinned) */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Recepción Física de Mercancía</h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Registra el conteo de entrada al depósito y recalcula el costo ponderado
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 cursor-pointer"
                title="Cerrar modal (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="createReceiptForm" onSubmit={handleCreateReceipt} className="flex-1 flex flex-col overflow-hidden">
              {/* Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Proveedor *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                    >
                      {availableSuppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSupplierSearch(true)}
                      title="Buscar proveedor"
                      className="px-2.5 py-2 shrink-0 flex items-center gap-1 text-xs"
                    >
                      <Search className="w-3.5 h-3.5 text-neutral-500" />
                      {/* <span>Buscar</span> */}
                    </Button>
                  </div>
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
                    value={formatExchangeRate(exchangeRate, 2)}
                    onChange={(e) => setExchangeRate(Number(e.target.value))}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 text-right"
                  />
                </div>
              </div>

              {/* Detalle de Productos a Recibir */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                    Productos Físicamente Recibidos ({receiptItems.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddingFromSearch(true)}
                      className="text-xs rounded-lg py-1 px-2.5 flex items-center gap-1.5"
                    >
                      <Search className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Buscar en Catálogo</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddItem}
                      className="text-xs rounded-lg py-1 px-2.5 flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Fila</span>
                    </Button>
                  </div>
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
                            <div className="flex items-center gap-1.5">
                              <select
                                value={item.productId}
                                onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                                className="flex-1 text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-neutral-800"
                              >
                                {availableProducts.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.sku} - {p.name}
                                  </option>
                                ))}
                              </select>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setProductSearchRowIdx(idx)}
                                title="Buscar producto"
                                className="p-1.5 shrink-0"
                              >
                                <Search className="w-3.5 h-3.5 text-neutral-500" />
                              </Button>
                            </div>
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
            </div>

            {/* Footer (Pinned) */}
              <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between gap-2 shrink-0">
                <span className="text-sm font-bold text-neutral-900 font-mono">
                  Total Recepción: {formatMoneyUSD(totalReceiptCost)}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-neutral-200 w-full max-w-lg max-h-[92vh] shadow-2xl flex flex-col overflow-hidden my-auto">
            {/* Header (Pinned) */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Facturar Recepción a CxP</h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Generación de factura de compra oficial y registro de cuenta por pagar
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInvoicingReceipt(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 cursor-pointer"
                title="Cerrar modal (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="invoiceReceiptForm" onSubmit={handleConvertToInvoice} className="flex-1 flex flex-col overflow-hidden">
              {/* Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
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

              </div>

              {/* Footer (Pinned) */}
              <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInvoicingReceipt(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs rounded-lg py-2 px-4 shadow-sm"
                >
                  Crear Factura y Asentar en CxP
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Buscador de Proveedores */}
      <SupplierSearchModal
        isOpen={showSupplierSearch}
        onClose={() => setShowSupplierSearch(false)}
        onSelect={(s) => setSupplierId(s.id)}
        suppliers={availableSuppliers}
      />

      {/* Modal Buscador de Productos */}
      <ProductSearchModal
        isOpen={productSearchRowIdx !== null || isAddingFromSearch}
        onClose={() => {
          setProductSearchRowIdx(null);
          setIsAddingFromSearch(false);
        }}
        onSelect={(prod) => {
          if (isAddingFromSearch) {
            handleAddItemWithProduct(prod);
          } else if (productSearchRowIdx !== null) {
            handleItemChange(productSearchRowIdx, 'productId', prod.id);
          }
        }}
        products={availableProducts}
        mode="purchase"
      />

      {/* Modal Visor / Descarga PDF de Recepción de Mercancía */}
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

