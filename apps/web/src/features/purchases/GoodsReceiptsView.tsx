import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { useExchangeRateStore } from '../../stores/exchangeRateStore';
import {
  PackageCheck,
  Plus,
  Trash2,
  X,
  Warehouse,
  Receipt,
  DollarSign,
  CheckCircle2,
  Search,
  FileText,
  ShoppingCart,
  Download,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import {
  SupplierSearchModal,
  ProductSearchModal,
  PurchaseOrderSearchModal,
  PurchaseOrderSearchItem,
} from '../../components/search';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import {
  formatMoneyUSD,
  formatMoneyVES,
  formatExchangeRate,
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
  purchaseInvoiceNumber?: string | null;
  purchaseControlNumber?: string | null;
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
  purchaseOrderItemId?: string | null;
  quantityOrdered?: number;
  quantityPreviouslyReceived?: number;
  quantityPending?: number;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
  notes?: string;
}

export const GoodsReceiptsView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeBranchId, activeWarehouseId, token, user } = useAuthStore();
  const [receipts, setReceipts] = useState<GoodsReceiptRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Catálogos desde BD
  const [availableProducts, setAvailableProducts] = useState<
    { id: string; sku: string; name: string; defaultCost: number }[]
  >([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<
    { id: string; name: string; rif: string }[]
  >([]);
  const [availableOrders, setAvailableOrders] = useState<PurchaseOrderSearchItem[]>([]);

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [invoicingReceipt, setInvoicingReceipt] = useState<GoodsReceiptRecord | null>(null);
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);
  const [showOrderSearch, setShowOrderSearch] = useState(false);
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

  // Formulario Nueva Recepción
  const rate = useExchangeRateStore((s) => s.rate);
  const [supplierId, setSupplierId] = useState('');
  const [purchaseOrderId, setPurchaseOrderId] = useState<string | null>(null);
  const [poNumber, setPoNumber] = useState('');
  const [receiptType, setReceiptType] = useState<'DELIVERY_NOTE' | 'PURCHASE_INVOICE'>(
    'DELIVERY_NOTE'
  );
  const [deliveryNote, setDeliveryNote] = useState('');

  // Factura de compra directa
  const [directInvoiceNumber, setDirectInvoiceNumber] = useState('');
  const [directControlNumber, setDirectControlNumber] = useState('');
  const [directIsCredit, setDirectIsCredit] = useState(true);
  const [directDueDate, setDirectDueDate] = useState('');
  const [autoInvoiceInCxP, setAutoInvoiceInCxP] = useState(true);

  const [exchangeRate, setExchangeRate] = useState(rate);
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptItems, setReceiptItems] = useState<NewReceiptItem[]>([]);

  // Formulario de Conversión a Factura CxP (Modal posterior)
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

  const fetchOrdersForReceipt = async () => {
    try {
      const params = new URLSearchParams();
      if (activeBranchId) params.append('branchId', activeBranchId);
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/purchases/orders?${params.toString()}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setAvailableOrders(json.data);
        }
      }
    } catch {
      // Ignorar
    }
  };

  const loadOrderIntoReceipt = async (orderIdToLoad: string) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/purchases/orders/${orderIdToLoad}`, { headers });
      if (!res.ok) {
        toast.error('No se pudo cargar la orden de compra solicitada');
        return;
      }
      const json = await res.json();
      if (!json.success || !json.data) {
        toast.error('Orden de compra no encontrada');
        return;
      }
      const order = json.data;
      setSupplierId(order.supplierId);
      setPoNumber(order.orderNumber);
      setPurchaseOrderId(order.id);
      if (order.exchangeRate) setExchangeRate(order.exchangeRate);

      const mappedItems: NewReceiptItem[] = (order.items || []).map((it: any) => {
        const ordered = Number(it.quantityOrdered || 0);
        const prev = Number(it.quantityReceived || 0);
        const pending = Math.max(0, ordered - prev);
        const cost = Number(it.unitCost || 0);
        return {
          productId: it.productId,
          purchaseOrderItemId: it.id,
          productName: it.productName,
          sku: it.productSku || it.sku || '',
          quantityOrdered: ordered,
          quantityPreviouslyReceived: prev,
          quantityPending: pending,
          quantityReceived: pending, // Por defecto recibir lo que queda pendiente
          unitCost: cost,
          totalCost: Number((pending * cost).toFixed(2)),
          notes: it.notes || '',
        };
      });

      setReceiptItems(mappedItems);
      setIsCreateOpen(true);
      toast.success(
        `Orden ${order.orderNumber} cargada con ${mappedItems.length} ítem(s) para verificación física`
      );
    } catch (err: any) {
      toast.error('Error al cargar orden de compra: ' + (err.message || 'Error de conexión'));
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

  // Si se pasa orderId en la URL, cargar inmediatamente la orden para recepción
  useEffect(() => {
    const orderIdParam = searchParams.get('orderId');
    if (orderIdParam) {
      loadOrderIntoReceipt(orderIdParam);
      searchParams.delete('orderId');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, token]);

  const totalReceiptCost = receiptItems.reduce((acc, i) => acc + i.totalCost, 0);

  // Estadísticas comparativas de lo ordenado vs lo recibido
  const totalOrderedQty = useMemo(() => {
    return receiptItems.reduce(
      (acc, i) => acc + (i.quantityOrdered ?? i.quantityReceived),
      0
    );
  }, [receiptItems]);

  const totalReceivedQty = useMemo(() => {
    return receiptItems.reduce((acc, i) => acc + Number(i.quantityReceived || 0), 0);
  }, [receiptItems]);

  const totalPendingQty = useMemo(() => {
    return receiptItems.reduce(
      (acc, i) => acc + (i.quantityPending ?? i.quantityReceived),
      0
    );
  }, [receiptItems]);

  const netDifferenceQty = totalReceivedQty - totalPendingQty;
  const hasOrderAttached = Boolean(purchaseOrderId) || receiptItems.some((i) => i.quantityOrdered !== undefined);

  const resetCreateForm = () => {
    setSupplierId(availableSuppliers.length > 0 ? availableSuppliers[0].id : '');
    setPurchaseOrderId(null);
    setPoNumber('');
    setReceiptType('DELIVERY_NOTE');
    setDeliveryNote('');
    setDirectInvoiceNumber('');
    setDirectControlNumber('');
    setDirectIsCredit(true);
    setDirectDueDate('');
    setAutoInvoiceInCxP(true);
    setExchangeRate(rate);
    setReceiptNotes('');
    setReceiptItems([]);
    setProductSearchRowIdx(null);
    setIsAddingFromSearch(false);
  };

  const handleCloseCreateModal = () => {
    setIsCreateOpen(false);
    resetCreateForm();
  };

  const handleAdjustAllToPending = () => {
    const updated = receiptItems.map((it) => {
      const target = it.quantityPending !== undefined ? it.quantityPending : it.quantityReceived;
      return {
        ...it,
        quantityReceived: target,
        totalCost: Number((target * it.unitCost).toFixed(2)),
      };
    });
    setReceiptItems(updated);
    toast.info('Cantidades recibidas ajustadas a los saldos pendientes de la orden');
  };

  const handleExportComparisonCSV = () => {
    if (receiptItems.length === 0) {
      toast.error('No hay productos en la recepción para exportar');
      return;
    }

    const headers = [
      'Producto',
      'SKU',
      'Cant. Pedida',
      'Cant. Previa Recibida',
      'Saldo Pendiente',
      'Cant. Recibida Hoy',
      'Diferencia',
      'Costo Unitario ($)',
      'Total ($)',
      'Estado Verificacion',
    ];

    const rows = receiptItems.map((item) => {
      const ordered = item.quantityOrdered ?? item.quantityReceived;
      const prev = item.quantityPreviouslyReceived ?? 0;
      const pending = item.quantityPending ?? item.quantityReceived;
      const diff = item.quantityReceived - pending;
      let status = 'Conforme';
      if (diff < 0) status = `Faltante (${diff})`;
      else if (diff > 0) status = `Excedente (+${diff})`;

      return [
        `"${(item.productName || '').replace(/"/g, '""')}"`,
        `"${item.sku || ''}"`,
        ordered,
        prev,
        pending,
        item.quantityReceived,
        diff,
        item.unitCost,
        item.totalCost,
        `"${status}"`,
      ].join(',');
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `verificacion_recepcion_${poNumber || 'directa'}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Comparativa exportada a CSV exitosamente');
  };

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
    const cost = Number(prod.defaultCost ?? prod.costPrice ?? prod.cost ?? 0);
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
      } else {
        item.productId = val;
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

    if (receiptType === 'PURCHASE_INVOICE' && !directInvoiceNumber.trim()) {
      toast.error('El número de factura fiscal del proveedor es obligatorio cuando se recibe por factura');
      return;
    }

    const invalidItem = receiptItems.find(
      (i) => !i.productId || Number(i.quantityReceived) <= 0 || Number(i.unitCost) < 0
    );
    if (invalidItem) {
      toast.error('Todos los productos a recibir deben tener cantidad mayor a 0 y costo válido');
      return;
    }

    const supplier = availableSuppliers.find((s) => s.id === supplierId);

    const docTypeLabel =
      receiptType === 'PURCHASE_INVOICE'
        ? `Factura Fiscal N° ${directInvoiceNumber.trim()}`
        : `Guía / Nota de Entrega N° ${deliveryNote || 'S/N'}`;

    const confirmed = await showConfirmQuestion({
      title: '¿Confirmar recepción de mercancía?',
      text: `Se registrará la entrada física de ${receiptItems.length} producto(s) (${totalReceivedQty} unidades) por un total de $${totalReceiptCost.toFixed(2)} (${docTypeLabel}) a favor de ${supplier?.name || 'proveedor'}. Se afectará el inventario físico y costo promedio ponderado.`,
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
          branchId: activeBranchId || user?.branchId || undefined,
          warehouseId: activeWarehouseId || undefined,
          supplierId,
          purchaseOrderId: purchaseOrderId || undefined,
          supplierDeliveryNote:
            receiptType === 'DELIVERY_NOTE' ? deliveryNote || undefined : undefined,
          purchaseOrderNumber: poNumber || undefined,
          currency: 'USD',
          exchangeRate: Number(exchangeRate) || 1,
          notes: receiptNotes || undefined,
          // Datos si se recibe con Factura de Compra
          invoiceNumber:
            receiptType === 'PURCHASE_INVOICE' ? directInvoiceNumber.trim() : undefined,
          controlNumber:
            receiptType === 'PURCHASE_INVOICE'
              ? directControlNumber.trim() || undefined
              : undefined,
          autoInvoice: receiptType === 'PURCHASE_INVOICE' ? autoInvoiceInCxP : false,
          isCredit: receiptType === 'PURCHASE_INVOICE' ? directIsCredit : false,
          dueDate:
            receiptType === 'PURCHASE_INVOICE' && directIsCredit && directDueDate
              ? directDueDate
              : undefined,
          items: receiptItems.map((i) => ({
            productId: i.productId,
            purchaseOrderItemId: i.purchaseOrderItemId || undefined,
            quantityReceived: Number(i.quantityReceived),
            unitCost: Number(i.unitCost),
            notes: i.notes || undefined,
          })),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const invoicedMsg =
          json.data?.status === 'INVOICED'
            ? ' y factura fiscal asentada en CxP'
            : '';
        toast.success(
          `Recepción ${json.data.receiptNumber} procesada exitosamente en inventario${invoicedMsg}`
        );
        handleCloseCreateModal();
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
        const errorMsg =
          json.error?.message ||
          (Array.isArray(json.error?.issues)
            ? json.error.issues.map((it: any) => `${it.path.join('.')}: ${it.message}`).join(', ')
            : undefined) ||
          json.message ||
          'Error al procesar recepción';
        throw new Error(errorMsg);
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
        <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          {item.receiptNumber}
        </span>
      ),
    },
    {
      header: 'Fecha & Guía',
      accessorKey: 'receiptDate',
      cell: (item) => (
        <div className="text-xs text-neutral-600 dark:text-neutral-300">
          <p>{new Date(item.receiptDate).toLocaleDateString('es-VE')}</p>
          {item.supplierDeliveryNote && (
            <span className="text-[10px] text-neutral-500 font-mono">
              Guía: {item.supplierDeliveryNote}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Proveedor & RIF',
      accessorKey: 'supplierName',
      cell: (item) => (
        <div>
          <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
            {item.supplierName}
          </p>
          <span className="font-mono text-[10px] text-neutral-500">{item.supplierRif}</span>
        </div>
      ),
    },
    {
      header: 'Depósito Destino',
      accessorKey: 'warehouseName',
      cell: (item) => (
        <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
          <Warehouse className="w-3.5 h-3.5 text-neutral-400" />
          <span>{item.warehouseName}</span>
        </div>
      ),
    },
    {
      header: 'Doc. Referencia',
      accessorKey: 'purchaseOrderNumber',
      cell: (item) => (
        <div className="space-y-0.5">
          {item.purchaseOrderNumber ? (
            <span className="font-mono text-xs text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-lg border border-sky-200 dark:border-sky-800 inline-block">
              {item.purchaseOrderNumber}
            </span>
          ) : (
            <span className="text-[10px] text-neutral-400 italic block">Sin OC</span>
          )}
          {item.purchaseInvoiceNumber && (
            <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 block">
              Fact: {item.purchaseInvoiceNumber}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Costo Total',
      accessorKey: 'totalCost',
      cell: (item) => (
        <div className="text-right">
          <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
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
      cell: (item) =>
        item.status === 'RECEIVED' ? (
          <Badge variant="info" className="text-[10px]">
            Recibida en Depósito
          </Badge>
        ) : (
          <Badge variant="success" className="text-[10px]">
            Facturada en CxP
          </Badge>
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
            className="p-1 text-neutral-500 hover:text-sky-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
          <h1 className="text-xl font-bold text-neutral-800 dark:text-neutral-100 tracking-tight">
            Recepción de Mercancías
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Ingreso físico de productos con verificación de orden de compra, recepción con factura de proveedor y costeo ponderado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              fetchOrdersForReceipt();
              setShowOrderSearch(true);
            }}
            className="flex items-center gap-1.5 border-sky-300 text-sky-700 dark:text-sky-300 hover:bg-sky-50 text-xs rounded-lg py-2 px-3"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Importar Orden de Compra</span>
          </Button>
          <Button
            onClick={() => {
              resetCreateForm();
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg py-2 px-3 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Procesar Recepción</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-neutral-500 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Total Recepciones</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mt-2">
            {receipts.length}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">Ingresos procesados en el período</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-amber-200 dark:border-amber-400">
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

        <Card className="p-4 border-l-4 border-l-sky-500 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Valor Ingresado ($)</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-sky-700 dark:text-sky-400 mt-2">
            {formatMoneyUSD(receipts.reduce((acc, r) => acc + r.totalCost, 0))}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">Costo total incorporado al inventario</p>
        </Card>
      </div>

      {/* Tabla de Recepciones */}
      <Card className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
        <DataTable
          columns={columns}
          data={receipts}
          isLoading={loading}
          searchPlaceholder="Buscar recepciones por proveedor, número o guía..."
        />
      </Card>

      {/* Modal Procesar Nueva Recepción */}
      <Modal
        isOpen={isCreateOpen}
        onClose={handleCloseCreateModal}
        title="Recepción Física de Mercancía"
        subtitle="Registra el conteo de entrada al depósito, verifica con la orden de compra y actualiza Kardex"
        size="4xl"
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            <div className="text-left w-full sm:w-auto">
              <span className="text-sm font-bold text-neutral-800 dark:text-neutral-100 font-mono block">
                Total Recepción: {formatMoneyUSD(totalReceiptCost)}
              </span>
              <span className="text-[11px] text-neutral-500 font-mono">
                {formatMoneyVES(totalReceiptCost * exchangeRate)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCloseCreateModal}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                form="createReceiptForm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4"
              >
                Confirmar Entrada en Depósito
              </Button>
            </div>
          </div>
        }
      >
        <form id="createReceiptForm" onSubmit={handleCreateReceipt} className="space-y-4 text-xs">
          {/* Selector de Modalidad / Documento del Proveedor y Enlace a Orden de Compra */}
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg border border-neutral-200 dark:border-neutral-700 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-semibold block mb-1">
                  Tipo de Comprobante del Proveedor
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReceiptType('DELIVERY_NOTE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      receiptType === 'DELIVERY_NOTE'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    Guía de Despacho / Nota de Entrega
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptType('PURCHASE_INVOICE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      receiptType === 'PURCHASE_INVOICE'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    Factura Fiscal de Compra
                  </button>
                </div>
              </div>

              {/* Importar / Vincular Orden de Compra */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    fetchOrdersForReceipt();
                    setShowOrderSearch(true);
                  }}
                  className="text-xs flex items-center gap-1.5 border-sky-300 text-sky-700 dark:text-sky-300 hover:bg-sky-50"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>{purchaseOrderId ? 'Cambiar Orden' : 'Importar Orden de Compra'}</span>
                </Button>
                {purchaseOrderId && (
                  <button
                    type="button"
                    onClick={() => {
                      setPurchaseOrderId(null);
                      setPoNumber('');
                      setReceiptItems((prev) =>
                        prev.map((it) => ({
                          ...it,
                          purchaseOrderItemId: undefined,
                          quantityOrdered: undefined,
                          quantityPreviouslyReceived: undefined,
                          quantityPending: undefined,
                        }))
                      );
                      toast.info('Se desvinculó la orden de compra');
                    }}
                    className="p-1.5 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-neutral-100"
                    title="Desvincular orden"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {purchaseOrderId && (
              <div className="flex items-center justify-between text-xs bg-sky-50/80 dark:bg-sky-950/30 p-2 rounded-lg border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                  Orden vinculada: <strong>{poNumber}</strong>
                </span>
                <span className="text-[11px] text-sky-700 dark:text-sky-400">
                  Verificación activa contra cantidades autorizadas
                </span>
              </div>
            )}
          </div>

          {/* Datos Generales de la Recepción */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Proveedor *
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                </Button>
              </div>
            </div>

            {receiptType === 'DELIVERY_NOTE' ? (
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Nº Guía / Nota de Entrega
                </label>
                <input
                  type="text"
                  placeholder="Ej. GD-10294"
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Nº Factura del Proveedor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. FACT-009182"
                  value={directInvoiceNumber}
                  onChange={(e) => setDirectInvoiceNumber(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Orden de Compra Ref.
              </label>
              <input
                type="text"
                placeholder="Ej. OC-2026-0001"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Tasa Oficial BCV
              </label>
              <input
                type="number"
                step="0.01"
                value={formatExchangeRate(exchangeRate, 2)}
                onChange={(e) => setExchangeRate(Number(e.target.value))}
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-right"
              />
            </div>
          </div>

          {/* Opciones cuando se recibe con Factura de Compra del Proveedor */}
          {receiptType === 'PURCHASE_INVOICE' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Nº de Control SENIAT
                </label>
                <input
                  type="text"
                  placeholder="Ej. 00-128491"
                  value={directControlNumber}
                  onChange={(e) => setDirectControlNumber(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Condición de Pago
                </label>
                <div className="flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="directPaymentMode"
                      checked={!directIsCredit}
                      onChange={() => setDirectIsCredit(false)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs">Contado</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="directPaymentMode"
                      checked={directIsCredit}
                      onChange={() => setDirectIsCredit(true)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs">Crédito</span>
                  </label>
                </div>
              </div>

              {directIsCredit && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Vencimiento Factura
                  </label>
                  <input
                    type="date"
                    value={directDueDate}
                    onChange={(e) => setDirectDueDate(e.target.value)}
                    className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              )}

              <div className="sm:col-span-3 flex items-center gap-2 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
                <input
                  type="checkbox"
                  id="autoInvoiceToggle"
                  checked={autoInvoiceInCxP}
                  onChange={(e) => setAutoInvoiceInCxP(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label
                  htmlFor="autoInvoiceToggle"
                  className="text-xs font-medium text-emerald-900 dark:text-emerald-300 cursor-pointer"
                >
                  Asentar automáticamente en Cuentas por Pagar (Generar obligación y cuenta por pagar fiscal)
                </label>
              </div>
            </div>
          )}

          {/* Panel de Comparativa / Verificación Pedido vs Recibido */}
          {hasOrderAttached && (
            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-semibold text-neutral-800 dark:text-neutral-100 text-xs">
                    Verificación de Cumplimiento de Orden
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAdjustAllToPending}
                    className="text-[11px] py-1 px-2.5 rounded-lg flex items-center gap-1 border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-100/60"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Ajustar Todo a Pendiente</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportComparisonCSV}
                    className="text-[11px] py-1 px-2.5 rounded-lg flex items-center gap-1 border-neutral-300 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100"
                  >
                    <Download className="w-3 h-3" />
                    <span>Exportar Auditoría CSV</span>
                  </Button>
                </div>
              </div>

              {/* Métricas de Verificación */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                <div className="bg-white/80 dark:bg-neutral-800/80 p-2 rounded-lg border border-amber-200 dark:border-amber-900">
                  <span className="text-[10px] text-neutral-500 uppercase block">Total Pedido</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-100 text-sm">
                    {totalOrderedQty} uds
                  </span>
                </div>
                <div className="bg-white/80 dark:bg-neutral-800/80 p-2 rounded-lg border border-amber-200 dark:border-amber-900">
                  <span className="text-[10px] text-neutral-500 uppercase block">Recibido Hoy</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                    {totalReceivedQty} uds
                  </span>
                </div>
                <div className="bg-white/80 dark:bg-neutral-800/80 p-2 rounded-lg border border-amber-200 dark:border-amber-900">
                  <span className="text-[10px] text-neutral-500 uppercase block">Diferencia Neta</span>
                  <span
                    className={`font-bold text-sm ${
                      netDifferenceQty === 0
                        ? 'text-emerald-600'
                        : netDifferenceQty > 0
                        ? 'text-sky-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {netDifferenceQty === 0
                      ? '0 (Conforme)'
                      : netDifferenceQty > 0
                      ? `+${netDifferenceQty} (Excedente)`
                      : `${netDifferenceQty} (Faltante)`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Detalle de Productos a Recibir */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
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

            <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10 font-medium">
                  <tr>
                    <th className="py-2.5 px-3">Producto</th>
                    {hasOrderAttached && (
                      <>
                        <th className="py-2.5 px-3 w-24 text-center">Pedido</th>
                        <th className="py-2.5 px-3 w-24 text-center">Pendiente</th>
                      </>
                    )}
                    <th className="py-2.5 px-3 w-28">Cant. Recibida</th>
                    <th className="py-2.5 px-3 w-28">Costo ($)</th>
                    <th className="py-2.5 px-3 w-28 text-right">Total ($)</th>
                    {hasOrderAttached && (
                      <th className="py-2.5 px-3 w-32 text-center">Verificación</th>
                    )}
                    <th className="py-2.5 px-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {receiptItems.map((item, idx) => {
                    const pending = item.quantityPending ?? item.quantityReceived;
                    const diff = item.quantityReceived - pending;

                    return (
                      <tr
                        key={idx}
                        className="hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors"
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <select
                              value={item.productId}
                              onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            >
                              <option value="" disabled>
                                -- Seleccione producto --
                              </option>
                              {item.productId &&
                                !availableProducts.some((p) => p.id === item.productId) && (
                                  <option value={item.productId}>
                                    {item.sku ? `${item.sku} - ` : ''}
                                    {item.productName || 'Producto Seleccionado'}
                                  </option>
                                )}
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

                        {hasOrderAttached && (
                          <>
                            <td className="py-2 px-3 text-center font-mono">
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                                {item.quantityOrdered ?? '-'}
                              </span>
                              {Boolean(item.quantityPreviouslyReceived) && (
                                <span className="block text-[10px] text-neutral-400">
                                  prev: {item.quantityPreviouslyReceived}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center font-mono text-neutral-600 dark:text-neutral-300">
                              {item.quantityPending ?? '-'}
                            </td>
                          </>
                        )}

                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantityReceived}
                            onChange={(e) =>
                              handleItemChange(idx, 'quantityReceived', e.target.value)
                            }
                            className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-center font-mono font-semibold"
                          />
                        </td>

                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitCost}
                            onChange={(e) => handleItemChange(idx, 'unitCost', e.target.value)}
                            className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-right font-mono"
                          />
                        </td>

                        <td className="py-2 px-3 text-right font-mono font-medium text-neutral-800 dark:text-neutral-200">
                          {formatMoneyUSD(item.totalCost)}
                        </td>

                        {hasOrderAttached && (
                          <td className="py-2 px-3 text-center">
                            {diff === 0 ? (
                              <Badge variant="success" className="text-[10px]">
                                ✓ Conforme
                              </Badge>
                            ) : diff < 0 ? (
                              <Badge variant="warning" className="text-[10px]">
                                ⚠ Faltante ({diff})
                              </Badge>
                            ) : (
                              <Badge variant="info" className="text-[10px]">
                                + Excedente (+{diff})
                              </Badge>
                            )}
                          </td>
                        )}

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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Banner Informativo de Costeo */}
          <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg p-3 text-xs text-sky-800 dark:text-sky-300 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <p>
              <strong>Impacto Automático:</strong> Esta recepción incrementará el stock físico disponible en el depósito de destino y recalculará el <strong>Costo Promedio Ponderado</strong> de cada producto registrado, asentando el comprobante en el Kardex valorizado.
            </p>
          </div>
        </form>
      </Modal>

      {/* Modal Facturar en CxP (Desde tabla) */}
      <Modal
        isOpen={Boolean(invoicingReceipt)}
        onClose={() => setInvoicingReceipt(null)}
        title="Facturar Recepción a CxP"
        subtitle="Generación de factura de compra oficial y registro de cuenta por pagar"
        size="lg"
        footer={
          invoicingReceipt && (
            <div className="flex items-center justify-end gap-2 w-full">
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
                form="invoiceReceiptForm"
                className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs"
              >
                Crear Factura y Asentar en CxP
              </Button>
            </div>
          )
        }
      >
        {invoicingReceipt && (
          <form
            id="invoiceReceiptForm"
            onSubmit={handleConvertToInvoice}
            className="space-y-4 text-xs"
          >
            <div className="bg-neutral-50 dark:bg-neutral-800 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs">
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                {invoicingReceipt.supplierName}
              </p>
              <p className="text-neutral-500">{invoicingReceipt.supplierRif}</p>
              <p className="text-neutral-700 dark:text-neutral-300 mt-1">
                Monto a Facturar: <strong>{formatMoneyUSD(invoicingReceipt.totalCost)} USD</strong>{' '}
                ({formatMoneyVES(invoicingReceipt.totalCost * invoicingReceipt.exchangeRate)})
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Nº Factura del Proveedor *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. FACT-009182"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Nº de Control Fiscal SENIAT
              </label>
              <input
                type="text"
                placeholder="Ej. 00-128491"
                value={controlNumber}
                onChange={(e) => setControlNumber(e.target.value)}
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="creditToggle"
                checked={isCredit}
                onChange={(e) => setIsCredit(e.target.checked)}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <label
                htmlFor="creditToggle"
                className="text-xs text-neutral-700 dark:text-neutral-300 font-medium"
              >
                Compra a Crédito (Registrar obligación pendiente en CxP)
              </label>
            </div>

            {isCredit && (
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Fecha de Vencimiento de Factura
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            )}
          </form>
        )}
      </Modal>

      {/* Modal Importar Orden de Compra */}
      <PurchaseOrderSearchModal
        isOpen={showOrderSearch}
        onClose={() => setShowOrderSearch(false)}
        onSelect={(selectedOrder) => {
          loadOrderIntoReceipt(selectedOrder.id);
        }}
        orders={availableOrders}
        supplierId={supplierId || undefined}
      />

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
            const cost = Number(prod.defaultCost ?? prod.cost ?? prod.costPrice ?? 0);
            const updated = [...receiptItems];
            if (updated[productSearchRowIdx]) {
              const current = updated[productSearchRowIdx];
              const unitCost = cost > 0 ? cost : current.unitCost;
              updated[productSearchRowIdx] = {
                ...current,
                productId: prod.id,
                productName: prod.name,
                sku: prod.sku,
                unitCost,
                totalCost: Number((current.quantityReceived * unitCost).toFixed(2)),
              };
              setReceiptItems(updated);
            }
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
