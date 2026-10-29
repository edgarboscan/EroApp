import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import {
  Truck,
  ArrowRightLeft,
  Plus,
  Trash2, 
  X,
  Check,
  Building2,
  Warehouse,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  FileText,
  Download,
  Upload,
  Mail,
  ShieldCheck,
  RefreshCw,
  Eye,
  FileCheck,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  MapPin,
  Calendar,
  Lock,
  Info,
} from 'lucide-react';
import { ProductSearchModal } from '../../components/search';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { formatMoneyUSD } from '../../utils/formatters';
import { showConfirmQuestion } from '../../lib/sweetalert';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';

export interface TransferRecord {
  id: string;
  transfer_number: string;
  status: 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
  transfer_type?: 'INTERNAL_WAREHOUSE' | 'BRANCH_TRANSFER';
  total_items: number;
  total_cost: number;
  shipped_at: string;
  received_at?: string | null;
  notes?: string | null;
  origin_branch_id: string;
  origin_branch_name: string;
  origin_warehouse_id: string;
  origin_warehouse_name: string;
  destination_branch_id: string;
  destination_branch_name: string;
  destination_warehouse_id: string;
  destination_warehouse_name: string;
  shipped_by_name: string;
  received_by_name?: string | null;
  carrier_name?: string | null;
  carrier_rif?: string | null;
  driver_name?: string | null;
  driver_id_document?: string | null;
  vehicle_plate?: string | null;
  vehicle_model?: string | null;
  security_seal_number?: string | null;
  shipping_guide_number?: string | null;
  estimated_arrival_at?: string | null;
  freight_cost?: number;
  transfer_file_checksum?: string | null;
  transfer_file_exported_at?: string | null;
  email_sent_to?: string | null;
  email_sent_at?: string | null;
}

export interface TransferDetailItem {
  id: string;
  productId: string;
  productSku: string;
  productBarcode?: string | null;
  productName: string;
  unitOfMeasure: string;
  quantitySent: number;
  quantityReceived?: number;
  discrepancyQuantity?: number;
  conditionStatus?: 'OPTIMAL' | 'DAMAGED' | 'SHORTAGE' | 'SURPLUS';
  unitCost: number;
  notes?: string;
}

interface NewTransferItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  notes?: string;
}

interface BranchItem {
  id: string;
  name: string;
  code?: string;
  warehouses: { id: string; name: string }[];
}

export interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  barcode?: string;
  availableStock: number;
  costPrice?: number;
}

export const InventoryTransfersView: React.FC = () => {
  const { activeBranchId, token, user } = useAuthStore();
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Tabs de dirección de flujo
  const [directionTab, setDirectionTab] = useState<'ALL' | 'OUTGOING' | 'INCOMING'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_TRANSIT' | 'RECEIVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);

  // Selected Transfer & Detail
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRecord | null>(null);
  const [selectedTransferDetail, setSelectedTransferDetail] = useState<{
    transfer: TransferRecord;
    items: TransferDetailItem[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal de visualización PDF
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

  // Catálogos
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);

  // Form State: Creación de Transferencia
  const [createStepTab, setCreateStepTab] = useState<'ROUTE' | 'TRANSIT' | 'ITEMS'>('ROUTE');
  const [originBranchId, setOriginBranchId] = useState<string>(activeBranchId || '');
  const [originWarehouseId, setOriginWarehouseId] = useState<string>('');
  const [destinationBranchId, setDestinationBranchId] = useState<string>('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<string>('');
  const [transferType, setTransferType] = useState<'BRANCH_TRANSFER' | 'INTERNAL_WAREHOUSE'>('BRANCH_TRANSFER');

  // Determina si el movimiento es dentro de la misma sucursal (traslado interno entre depósitos)
  const isSameBranch = Boolean(originBranchId && destinationBranchId && originBranchId === destinationBranchId);

  // Transit fields
  const [carrierName, setCarrierName] = useState('');
  const [carrierRif, setCarrierRif] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverIdDocument, setDriverIdDocument] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [securitySealNumber, setSecuritySealNumber] = useState('');
  const [shippingGuideNumber, setShippingGuideNumber] = useState('');
  const [estimatedArrivalAt, setEstimatedArrivalAt] = useState('');
  const [freightCost, setFreightCost] = useState<number>(0);
  const [transferNotes, setTransferNotes] = useState('');
  const [items, setItems] = useState<NewTransferItem[]>([]);

  // Item selector in form
  const [newProductId, setNewProductId] = useState('');
  const [newQuantity, setNewQuantity] = useState<number>(1);
  const [newNotes, setNewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reception state
  const [receiveSecuritySealVerified, setReceiveSecuritySealVerified] = useState<boolean>(true);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receptionItems, setReceptionItems] = useState<{
    productId: string;
    sku: string;
    name: string;
    quantitySent: number;
    quantityReceived: number;
    conditionStatus: 'OPTIMAL' | 'DAMAGED' | 'SHORTAGE' | 'SURPLUS';
    notes?: string;
  }[]>([]);

  // Import State
  const [importFileContent, setImportFileContent] = useState<any | null>(null);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importTargetWarehouseId, setImportTargetWarehouseId] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email State
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailNotes, setEmailNotes] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Load catalogs
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const [prodRes, branchRes] = await Promise.all([
          fetch('/api/inventory/products', { headers }),
          fetch('/api/auth/branches', { headers }),
        ]);

        if (prodRes.ok) {
          const pJson = await prodRes.json();
          if (pJson.success && Array.isArray(pJson.data)) {
            const mapped: CatalogProduct[] = pJson.data.map((p: any) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              barcode: p.barcode,
              availableStock: Number(p.availableStock ?? p.currentStock ?? p.stock ?? 0),
              costPrice: Number(p.costPrice ?? 0),
            }));
            setCatalog(mapped);
            if (mapped.length > 0) setNewProductId(mapped[0].id);
          }
        }

        if (branchRes.ok) {
          const bJson = await branchRes.json();
          if (bJson.success && Array.isArray(bJson.data)) {
            setBranches(bJson.data);

            const currentBranch = bJson.data.find((b: BranchItem) => b.id === activeBranchId) || bJson.data[0];
            if (currentBranch) {
              setOriginBranchId(currentBranch.id);
              if (currentBranch.warehouses?.length > 0) {
                setOriginWarehouseId(currentBranch.warehouses[0].id);
              }
              // Set another branch as destination default
              const otherBranch = bJson.data.find((b: BranchItem) => b.id !== currentBranch.id) || currentBranch;
              setDestinationBranchId(otherBranch.id);
              if (otherBranch.warehouses?.length > 0) {
                setDestinationWarehouseId(
                  otherBranch.id === currentBranch.id && otherBranch.warehouses.length > 1
                    ? otherBranch.warehouses[1].id
                    : otherBranch.warehouses[0].id
                );
              }
            }
          }
        }
      } catch {
        toast.error('Error al inicializar catálogos');
      }
    };

    fetchMetadata();
  }, [token, activeBranchId]);

  // Recargar catálogo con existencias del depósito origen seleccionado para validar disponibilidad
  useEffect(() => {
    if (!originWarehouseId) return;

    const fetchCatalogForOrigin = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch(`/api/inventory/products?warehouseId=${encodeURIComponent(originWarehouseId)}`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const mapped: CatalogProduct[] = json.data.map((p: any) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              barcode: p.barcode,
              availableStock: Number(p.availableStock ?? p.currentStock ?? p.stock ?? 0),
              costPrice: Number(p.costPrice ?? 0),
            }));
            setCatalog(mapped);
            if (mapped.length > 0 && !mapped.some((m) => m.id === newProductId)) {
              setNewProductId(mapped[0].id);
            }
          }
        }
      } catch {
        // En caso de fallo silencioso
      }
    };

    fetchCatalogForOrigin();
  }, [originWarehouseId, token]);

  // Warehouses available for selected branches in form
  const originWarehouses = useMemo(() => {
    const b = branches.find((br) => br.id === originBranchId);
    return b ? b.warehouses : [];
  }, [branches, originBranchId]);

  const destinationWarehouses = useMemo(() => {
    const b = branches.find((br) => br.id === destinationBranchId);
    return b ? b.warehouses : [];
  }, [branches, destinationBranchId]);

  // Fetch transfers list
  useEffect(() => {
    fetchTransfers();
  }, [activeBranchId, statusFilter, directionTab]);

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeBranchId) params.append('branchId', activeBranchId);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (directionTab !== 'ALL') params.append('direction', directionTab);

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/inventory/transfers?${params.toString()}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTransfers(json.data);
        } else {
          setTransfers([]);
        }
      } else {
        setTransfers([]);
      }
    } catch {
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch single transfer details
  const fetchTransferDetail = async (transferId: string) => {
    setLoadingDetail(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/inventory/transfers/${transferId}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSelectedTransferDetail({
            transfer: json.data,
            items: json.data.items || [],
          });
          return json.data;
        }
      }
    } catch {
      toast.error('Error al consultar el detalle de la transferencia');
    } finally {
      setLoadingDetail(false);
    }
    return null;
  };

  // KPI Statistics
  const statistics = useMemo(() => {
    const total = transfers.length;
    const inTransit = transfers.filter((t) => t.status === 'IN_TRANSIT').length;
    const received = transfers.filter((t) => t.status === 'RECEIVED').length;
    const inTransitCost = transfers
      .filter((t) => t.status === 'IN_TRANSIT')
      .reduce((sum, t) => sum + Number(t.total_cost || 0), 0);

    return {
      total,
      inTransit,
      received,
      inTransitCost,
    };
  }, [transfers]);

  // Filter transfers by search query
  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        t.transfer_number.toLowerCase().includes(q) ||
        t.origin_branch_name.toLowerCase().includes(q) ||
        t.destination_branch_name.toLowerCase().includes(q) ||
        t.driver_name?.toLowerCase().includes(q) ||
        t.vehicle_plate?.toLowerCase().includes(q) ||
        t.security_seal_number?.toLowerCase().includes(q) ||
        t.carrier_name?.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q)
      );
    });
  }, [transfers, searchQuery]);

  // Add Item to Transfer
  const handleAddItem = () => {
    const prod = catalog.find((p) => p.id === newProductId);
    if (!prod) return;
    if (newQuantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    const available = Number(prod.availableStock ?? 0);
    const originWhName = originWarehouses.find((w) => w.id === originWarehouseId)?.name || 'depósito origen';

    // Validar existencia en el depósito origen
    const alreadyInList = items
      .filter((it) => it.productId === newProductId)
      .reduce((sum, it) => sum + it.quantity, 0);

    if (alreadyInList + newQuantity > available) {
      toast.error(
        `Stock insuficiente en ${originWhName} para ${prod.sku}. Disponible: ${available}, ya en lista: ${alreadyInList}, adicional: ${newQuantity}`
      );
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        quantity: newQuantity,
        notes: newNotes || undefined,
      },
    ]);

    setNewQuantity(1);
    setNewNotes('');
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Create Transfer Dispatch
  const handleCreateTransfer = async () => {
    if (originWarehouseId === destinationWarehouseId) {
      toast.error('El depósito de origen y destino no pueden ser el mismo');
      return;
    }
    if (items.length === 0) {
      toast.error('Debe incluir al menos un producto a trasladar');
      return;
    }

    // Validar si existe la cantidad a transferir en el depósito origen
    for (const it of items) {
      const prod = catalog.find((p) => p.id === it.productId);
      const available = Number(prod?.availableStock ?? 0);
      if (it.quantity > available) {
        toast.error(
          `Stock insuficiente para "${it.sku} - ${it.productName}". Disponible en origen: ${available}, Requerido: ${it.quantity}`
        );
        return;
      }
    }

    const confirmed = await showConfirmQuestion({
      title: isSameBranch ? '¿Procesar traslado entre depósitos?' : '¿Despachar transferencia entre sucursales?',
      text: isSameBranch
        ? `Se trasladarán ${items.length} producto(s) internamente entre los depósitos de la misma sucursal.`
        : `Se despacharán ${items.length} producto(s) en tránsito hacia la sucursal de destino.`,
      confirmButtonText: isSameBranch ? 'Sí, trasladar' : 'Sí, despachar',
      cancelButtonText: 'Cancelar',
    });
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/inventory/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          originBranchId,
          originWarehouseId,
          destinationBranchId,
          destinationWarehouseId,
          transferType: isSameBranch ? 'INTERNAL_WAREHOUSE' : transferType,
          carrierName: carrierName || undefined,
          carrierRif: carrierRif || undefined,
          driverName: driverName || undefined,
          driverIdDocument: driverIdDocument || undefined,
          vehiclePlate: vehiclePlate || undefined,
          vehicleModel: vehicleModel || undefined,
          securitySealNumber: securitySealNumber || undefined,
          shippingGuideNumber: shippingGuideNumber || undefined,
          estimatedArrivalAt: estimatedArrivalAt || undefined,
          freightCost: freightCost || 0,
          notes: transferNotes || undefined,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            notes: i.notes || undefined,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al crear la transferencia');
      }

      toast.success(
        isSameBranch
          ? `Traslado ${json.data.transferNumber} registrado exitosamente`
          : `Transferencia ${json.data.transferNumber} despachada en tránsito`
      );
      setShowCreateModal(false);
      setItems([]);
      setTransferNotes('');
      fetchTransfers();

      // Open PDF viewer immediately
      if (json.data?.id) {
        setPdfModal({
          isOpen: true,
          endpoint: `/api/inventory/transfers/${json.data.id}/pdf`,
          title: `Guía Oficial de Traslado N° ${json.data.transferNumber || ''}`,
          filename: `traslado_${json.data.transferNumber || 'doc'}.pdf`,
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al despachar transferencia');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Reception Modal
  const handleOpenReceive = async (transfer: TransferRecord) => {
    setSelectedTransfer(transfer);
    const detail = await fetchTransferDetail(transfer.id);
    if (detail && detail.items) {
      setReceptionItems(
        detail.items.map((it: TransferDetailItem) => ({
          productId: it.productId,
          sku: it.productSku,
          name: it.productName,
          quantitySent: it.quantitySent,
          quantityReceived: it.quantitySent, // default to sent for quick verification
          conditionStatus: 'OPTIMAL',
          notes: '',
        }))
      );
      setReceiveNotes('');
      setReceiveSecuritySealVerified(true);
      setShowReceiveModal(true);
    }
  };

  // Update reception item
  const handleReceptionItemChange = (
    productId: string,
    field: 'quantityReceived' | 'conditionStatus' | 'notes',
    value: any
  ) => {
    setReceptionItems((prev) =>
      prev.map((it) => (it.productId === productId ? { ...it, [field]: value } : it))
    );
  };

  // Mark all reception items matching
  const handleMarkAllMatching = () => {
    setReceptionItems((prev) =>
      prev.map((it) => ({
        ...it,
        quantityReceived: it.quantitySent,
        conditionStatus: 'OPTIMAL',
      }))
    );
    toast.info('Cantidades recibidas igualadas al despacho');
  };

  // Confirm Reception and Stock Entry
  const handleConfirmReceive = async () => {
    if (!selectedTransfer) return;

    const confirmed = await showConfirmQuestion({
      title: '¿Aprobar y Registrar en Inventario?',
      text: `Se acreditará la mercancía físicamente en el depósito destino y se registrarán los movimientos oficiales en el Kardex.`,
      confirmButtonText: 'Sí, aprobar y registrar',
      cancelButtonText: 'Cancelar',
    });
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/inventory/transfers/receive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          transferId: selectedTransfer.id,
          securitySealVerified: receiveSecuritySealVerified,
          notes: receiveNotes || undefined,
          items: receptionItems.map((i) => ({
            productId: i.productId,
            quantityReceived: Number(i.quantityReceived) || 0,
            conditionStatus: i.conditionStatus,
            notes: i.notes || undefined,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al recepcionar la transferencia');
      }

      toast.success(`Transferencia ${selectedTransfer.transfer_number} recibida y asentada en inventario`);
      setShowReceiveModal(false);
      setSelectedTransfer(null);
      fetchTransfers();
    } catch (err: any) {
      toast.error(err.message || 'Error al recepcionar transferencia');
    } finally {
      setSubmitting(false);
    }
  };

  // Export Transfer Package (.ero / .json file download)
  const handleExportPackage = async (transferId: string, transferNumber: string) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/inventory/transfers/${transferId}/export-package`, { headers });
      if (!res.ok) throw new Error('Error al generar paquete de transferencia');

      const pkg = await res.json();
      const jsonStr = JSON.stringify(pkg, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transferencia_${transferNumber}.ero`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Archivo de transferencia ${transferNumber}.ero descargado`);
      fetchTransfers();
    } catch (err: any) {
      toast.error(err.message || 'Error al exportar archivo de transferencia');
    }
  };

  // Handle File Input for Import
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = JSON.parse(event.target?.result as string);
        setImportFileContent(content);
        if (content.destinationWarehouse?.id) {
          setImportTargetWarehouseId(content.destinationWarehouse.id);
        }
      } catch {
        toast.error('El archivo seleccionado no tiene un formato JSON / ERO válido');
        setImportFileContent(null);
      }
    };
    reader.readAsText(file);
  };

  // Execute Import
  const handleExecuteImport = async () => {
    if (!importFileContent) {
      toast.error('Seleccione primero un archivo de transferencia válido');
      return;
    }

    setImporting(true);
    try {
      const res = await fetch('/api/inventory/transfers/import-package', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          transferPackage: importFileContent,
          targetDestinationWarehouseId: importTargetWarehouseId || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al importar transferencia');
      }

      toast.success(`Transferencia ${json.data.transferNumber} cargada con éxito`);
      setShowImportModal(false);
      setImportFileContent(null);
      setImportFileName('');
      fetchTransfers();

      // Automatically open reception modal for physical verification
      handleOpenReceive(json.data);
    } catch (err: any) {
      toast.error(err.message || 'Error al importar archivo');
    } finally {
      setImporting(false);
    }
  };

  // Open Email Modal
  const handleOpenEmail = (transfer: TransferRecord) => {
    setSelectedTransfer(transfer);
    setEmailRecipient(transfer.email_sent_to || '');
    setEmailNotes(`Adjunto archivo de transferencia ${transfer.transfer_number} con precinto ${transfer.security_seal_number || 'N/A'}.`);
    setShowEmailModal(true);
  };

  // Execute Email Send
  const handleSendEmail = async () => {
    if (!selectedTransfer || !emailRecipient) {
      toast.error('Ingrese un correo electrónico destinatario válido');
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch(`/api/inventory/transfers/${selectedTransfer.id}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          recipientEmail: emailRecipient,
          notes: emailNotes || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al enviar correo');
      }

      toast.success(`Transferencia enviada por correo a ${emailRecipient}`);
      setShowEmailModal(false);
      fetchTransfers();
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar correo');
    } finally {
      setSendingEmail(false);
    }
  };

  // Columns definition
  const columns: Column<TransferRecord>[] = [
    {
      header: 'N° Transferencia',
      accessorKey: 'transfer_number',
      cell: (t) => (
        <div className="flex flex-col text-xs font-mono">
          <span className="font-bold text-neutral-900 dark:text-neutral-100">{t.transfer_number}</span>
          <span className="text-[10px] text-neutral-500">
            {new Date(t.shipped_at).toLocaleDateString()} {new Date(t.shipped_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ),
    },
    {
      header: 'Ruta (Origen → Destino)',
      accessorKey: 'origin_branch_name',
      cell: (t) => (
        <div className="flex flex-col text-xs">
          <div className="flex items-center gap-1 font-semibold text-neutral-800 dark:text-neutral-200">
            <span className="truncate max-w-[120px]">{t.origin_branch_name}</span>
            <span className="text-neutral-400">→</span>
            <span className="text-indigo-600 dark:text-indigo-400 truncate max-w-[120px]">
              {t.destination_branch_name}
            </span>
          </div>
          <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
            <span>{t.origin_warehouse_name}</span>
            <span>•</span>
            <span>{t.destination_warehouse_name}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Transporte & Chofer',
      accessorKey: 'driver_name',
      cell: (t) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            {t.driver_name || 'Transporte Propio'}
          </span>
          <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 font-mono">
            {t.vehicle_plate && <span>Placa: {t.vehicle_plate}</span>}
            {t.security_seal_number && <span>• Precinto: {t.security_seal_number}</span>}
          </div>
        </div>
      ),
    },
    {
      header: 'Ítems & Costo',
      accessorKey: 'total_items',
      cell: (t) => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
            {t.total_items} producto(s)
          </span>
          <span className="font-mono text-neutral-500 font-medium">
            {formatMoneyUSD(Number(t.total_cost || 0))}
          </span>
        </div>
      ),
    },
    {
      header: 'Estado',
      accessorKey: 'status',
      cell: (t) => {
        if (t.status === 'IN_TRANSIT') {
          return (
            <Badge variant="warning" className="flex items-center gap-1">
              <Truck className="w-3 h-3" />
              <span>En Tránsito</span>
            </Badge>
          );
        }
        if (t.status === 'RECEIVED') {
          return (
            <Badge variant="success" className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Recibido</span>
            </Badge>
          );
        }
        return <Badge variant="neutral">{t.status}</Badge>;
      },
    },
    {
      header: 'Acciones',
      accessorKey: 'id',
      cell: (t) => (
        <div className="flex items-center gap-1 justify-end">
          {/* Action to receive if in transit and matches destination */}
          {t.status === 'IN_TRANSIT' && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleOpenReceive(t)}
              className="text-xs py-1 px-2.5 rounded-lg flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              title="Recepcionar y verificar mercancía física"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Recibir</span>
            </Button>
          )}

          {/* Export File (.ero) */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExportPackage(t.id, t.transfer_number)}
            className="text-xs py-1 px-2 rounded-lg flex items-center gap-1"
            title="Descargar archivo (.ero) para enviar a sucursal"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">.ero</span>
          </Button>

          {/* Send Email */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenEmail(t)}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            title="Enviar por correo electrónico"
          >
            <Mail className="w-4 h-4" />
          </Button>

          {/* Print PDF Guide */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setPdfModal({
                isOpen: true,
                endpoint: `/api/inventory/transfers/${t.id}/pdf`,
                title: `Guía Oficial de Traslado N° ${t.transfer_number}`,
                filename: `traslado_${t.transfer_number}.pdf`,
              })
            }
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            title="Ver Guía Oficial de Traslado"
          >
            <FileText className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded-lg">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Transferencias entre Sucursales
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Despacho en tránsito, intercambio de archivos de transferencia (.ero) y recepción física
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportModal(true)}
            className="rounded-lg flex items-center gap-1.5"
            title="Cargar archivo .ero recibido de otra sucursal"
          >
            <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Importar Archivo (.ero)</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setCreateStepTab('ROUTE');
              setShowCreateModal(true);
            }}
            className="rounded-lg flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Transferencia</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg">
          <span className="text-xs font-medium text-neutral-500">Total Transferencias</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {statistics.total}
            </span>
            <ArrowRightLeft className="w-4 h-4 text-neutral-400" />
          </div>
        </Card>

        <Card className="p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg">
          <span className="text-xs font-medium text-neutral-500">En Tránsito</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {statistics.inTransit}
            </span>
            <Truck className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-[11px] text-neutral-400 mt-1">Vehículos en ruta</span>
        </Card>

        <Card className="p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg">
          <span className="text-xs font-medium text-neutral-500">Recibidas Conformes</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {statistics.received}
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-[11px] text-neutral-400 mt-1">Stock asentado en destino</span>
        </Card>

        <Card className="p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg">
          <span className="text-xs font-medium text-neutral-500">Valor en Tránsito</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">
              {formatMoneyUSD(statistics.inTransitCost)}
            </span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <span className="text-[11px] text-neutral-400 mt-1">Al costo de despacho</span>
        </Card>
      </div>

      {/* Tabs and Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-3">
        {/* Direction Tabs */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
          <button
            onClick={() => setDirectionTab('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              directionTab === 'ALL'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setDirectionTab('OUTGOING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              directionTab === 'OUTGOING'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-indigo-500" />
            <span>Despachos Emitidos</span>
          </button>
          <button
            onClick={() => setDirectionTab('INCOMING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              directionTab === 'INCOMING'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
            <span>Transferencias Entrantes</span>
          </button>
        </div>

        {/* Search & Status Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por N°, chofer, placa..."
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs focus:outline-none"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="IN_TRANSIT">En Tránsito</option>
            <option value="RECEIVED">Recibidos</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchTransfers}
            disabled={loading}
            className="rounded-lg p-2"
            title="Refrescar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <Card className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredTransfers}
          isLoading={loading}
          emptyMessage="No se encontraron transferencias con los filtros seleccionados"
        />
      </Card>

      {/* Modal: Crear Nueva Transferencia */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={isSameBranch ? "Registrar Traslado Interno entre Depósitos" : "Despachar Nueva Transferencia entre Sucursales"}
        maxWidth="max-w-3xl"
      >
        <div className="flex flex-col gap-4">
          {/* Step Tabs */}
          <div className="flex items-center border-b border-neutral-200 dark:border-neutral-800 pb-2 gap-2 text-xs font-medium">
            <button
              type="button"
              onClick={() => setCreateStepTab('ROUTE')}
              className={`flex items-center gap-1.5 py-1 px-3 rounded-lg transition-colors ${
                createStepTab === 'ROUTE'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <span>1. Ruta & Almacenes</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateStepTab('TRANSIT')}
              className={`flex items-center gap-1.5 py-1 px-3 rounded-lg transition-colors ${
                createStepTab === 'TRANSIT'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <span>2. Transporte & Tránsito{isSameBranch ? ' (Opcional)' : ''}</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateStepTab('ITEMS')}
              className={`flex items-center gap-1.5 py-1 px-3 rounded-lg transition-colors ${
                createStepTab === 'ITEMS'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <span>3. Mercancía ({items.length})</span>
            </button>
          </div>

          {/* TAB 1: ROUTE */}
          {createStepTab === 'ROUTE' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                <div>
                  <h4 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-500" />
                    <span>Origen de la Mercancía</span>
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] text-neutral-500 mb-0.5">Sucursal Origen</label>
                      <select
                        value={originBranchId}
                        onChange={(e) => {
                          const bId = e.target.value;
                          setOriginBranchId(bId);
                          const b = branches.find((br) => br.id === bId);
                          if (b && b.warehouses.length > 0) {
                            setOriginWarehouseId(b.warehouses[0].id);
                            if (destinationBranchId === bId && b.warehouses.length > 1) {
                              setDestinationWarehouseId(b.warehouses[1].id);
                            }
                          }
                        }}
                        className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                      >
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-neutral-500 mb-0.5">Depósito Origen</label>
                      <select
                        value={originWarehouseId}
                        onChange={(e) => setOriginWarehouseId(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                      >
                        {originWarehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-500" />
                    <span>Destino de la Mercancía</span>
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] text-neutral-500 mb-0.5">Sucursal Destino</label>
                      <select
                        value={destinationBranchId}
                        onChange={(e) => {
                          const bId = e.target.value;
                          setDestinationBranchId(bId);
                          const b = branches.find((br) => br.id === bId);
                          if (b && b.warehouses.length > 0) {
                            if (bId === originBranchId) {
                              const otherWh = b.warehouses.find((w) => w.id !== originWarehouseId);
                              setDestinationWarehouseId(otherWh ? otherWh.id : b.warehouses[0].id);
                            } else {
                              setDestinationWarehouseId(b.warehouses[0].id);
                            }
                          }
                        }}
                        className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                      >
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-neutral-500 mb-0.5">Depósito Destino</label>
                      <select
                        value={destinationWarehouseId}
                        onChange={(e) => setDestinationWarehouseId(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                      >
                        {destinationWarehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {isSameBranch && (
                <div className="p-2.5 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>Movimiento interno dentro de la misma sucursal (transporte y tránsito opcionales).</span>
                  </div>
                  <Badge variant="info" className="text-[10px]">
                    Misma Sucursal
                  </Badge>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Observaciones Generales de la Transferencia
                </label>
                <textarea
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="Motivo del traslado, condiciones climáticas, instrucciones de recepción..."
                  rows={2}
                  className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {isSameBranch ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateStepTab('TRANSIT')}
                      className="rounded-lg text-xs"
                    >
                      Configurar Transporte (Opcional) &rarr;
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setCreateStepTab('ITEMS')}
                      className="rounded-lg text-xs"
                    >
                      Continuar a Mercancía (Sin Transporte) &rarr;
                    </Button>
                  </>
                ) : (
                  <div className="flex justify-end w-full">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setCreateStepTab('TRANSIT')}
                      className="rounded-lg text-xs"
                    >
                      Continuar a Transporte &rarr;
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TRANSIT */}
          {createStepTab === 'TRANSIT' && (
            <div className="flex flex-col gap-3">
              {isSameBranch && (
                <div className="p-3 bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs text-neutral-600 dark:text-neutral-300 flex items-start gap-2">
                  <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">Traslado interno en la misma sucursal:</span>{' '}
                    Los datos del transportista, chofer y vehículo son opcionales. Puedes dejarlos en blanco y pasar directamente a la mercancía.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Empresa Transportista / Fletero
                  </label>
                  <input
                    type="text"
                    value={carrierName}
                    onChange={(e) => setCarrierName(e.target.value)}
                    placeholder="Ej. Transporte Los Andes C.A."
                    className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    RIF Empresa Transportista
                  </label>
                  <input
                    type="text"
                    value={carrierRif}
                    onChange={(e) => setCarrierRif(e.target.value)}
                    placeholder="Ej. J-12345678-9"
                    className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Nombre del Chofer
                  </label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Cédula / Licencia Chofer
                  </label>
                  <input
                    type="text"
                    value={driverIdDocument}
                    onChange={(e) => setDriverIdDocument(e.target.value)}
                    placeholder="Ej. V-18.456.789"
                    className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Placa del Vehículo
                  </label>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="Ej. A12BC3D"
                    className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Modelo / Tipo de Vehículo
                  </label>
                  <input
                    type="text"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="Ej. Camión NPR Blanco Cava"
                    className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Precinto de Seguridad (Candado/Sello)
                  </label>
                  <input
                    type="text"
                    value={securitySealNumber}
                    onChange={(e) => setSecuritySealNumber(e.target.value)}
                    placeholder="Ej. SEC-88992"
                    className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    N° Guía de Despacho / Carta de Porte
                  </label>
                  <input
                    type="text"
                    value={shippingGuideNumber}
                    onChange={(e) => setShippingGuideNumber(e.target.value)}
                    placeholder="Ej. GD-00445"
                    className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Fecha y Hora Estimada de Llegada
                  </label>
                  <input
                    type="datetime-local"
                    value={estimatedArrivalAt}
                    onChange={(e) => setEstimatedArrivalAt(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Costo de Flete ($ USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={freightCost}
                    onChange={(e) => setFreightCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateStepTab('ROUTE')}
                  className="rounded-lg"
                >
                  &larr; Volver a Ruta
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setCreateStepTab('ITEMS')}
                  className="rounded-lg"
                >
                  {isSameBranch && !carrierName && !driverName && !vehiclePlate
                    ? 'Omitir y Continuar a Mercancía →'
                    : 'Continuar a Mercancía →'}
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: ITEMS */}
          {createStepTab === 'ITEMS' && (
            <div className="flex flex-col gap-3">
              {/* Product Picker */}
              <div className="p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg flex flex-col gap-2">
                <div className="flex flex-col md:flex-row gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                      Seleccionar Producto del Catálogo
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={newProductId}
                        onChange={(e) => setNewProductId(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                      >
                        {catalog.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} - {p.name} ({p.availableStock} disp.)
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowProductSearch(true)}
                        className="rounded-lg text-xs"
                      >
                        Buscar
                      </Button>
                    </div>
                  </div>

                  <div className="w-24">
                    <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                      Cantidad
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(parseFloat(e.target.value) || 1)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-center font-bold"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleAddItem}
                    className="rounded-lg text-xs py-1.5"
                  >
                    Agregar Ítem
                  </Button>
                </div>

                {/* Indicador de existencia en el depósito origen seleccionado */}
                {(() => {
                  const sel = catalog.find((p) => p.id === newProductId);
                  const originWhName = originWarehouses.find((w) => w.id === originWarehouseId)?.name || 'Depósito Origen';
                  const stock = sel?.availableStock ?? 0;
                  return (
                    <div className="flex items-center gap-2 pt-1 border-t border-neutral-200/60 dark:border-neutral-800/60 text-[11px] text-neutral-500 dark:text-neutral-400">
                      <span>Existencia en <strong className="text-neutral-700 dark:text-neutral-300">{originWhName}</strong>:</span>
                      <span
                        className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          stock > 10
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : stock > 0
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {stock} {stock === 1 ? 'unidad disponible' : 'unidades disponibles'}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Items Table */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-semibold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">SKU</th>
                      <th className="py-2 px-3">Producto</th>
                      <th className="py-2 px-3 text-center">Disp. Origen</th>
                      <th className="py-2 px-3 text-center">Cant. a Trasladar</th>
                      <th className="py-2 px-3 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-neutral-400">
                          No se han agregado productos a la transferencia
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => {
                        const originStock = catalog.find((p) => p.id === it.productId)?.availableStock ?? 0;
                        const isOverStock = it.quantity > originStock;
                        return (
                          <tr key={idx} className={isOverStock ? 'bg-rose-50/50 dark:bg-rose-950/30' : ''}>
                            <td className="py-2 px-3 font-mono font-semibold">{it.sku}</td>
                            <td className="py-2 px-3">{it.productName}</td>
                            <td className="py-2 px-3 text-center font-mono">
                              <span
                                className={`text-[11px] font-semibold ${
                                  originStock > 0 ? 'text-neutral-700 dark:text-neutral-300' : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {originStock}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center font-bold font-mono">
                              <span className={isOverStock ? 'text-rose-600 dark:text-rose-400' : 'text-sky-600 dark:text-sky-400'}>
                                {it.quantity}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-neutral-400 hover:text-rose-600 cursor-pointer"
                                title="Eliminar ítem"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateStepTab('TRANSIT')}
                  className="rounded-lg"
                >
                  &larr; Volver a Transporte
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleCreateTransfer}
                  disabled={submitting || items.length === 0}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {submitting ? 'Despachando...' : 'Confirmar y Despachar'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Recepción y Verificación Física de Transferencia */}
      <Modal
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        title={`Recepción de Transferencia: ${selectedTransfer?.transfer_number || ''}`}
        maxWidth="max-w-3xl"
      >
        <div className="flex flex-col gap-4">
          {/* Summary Box */}
          <div className="p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <span className="text-neutral-400 block">Origen:</span>
              <strong className="text-neutral-900 dark:text-neutral-100">{selectedTransfer?.origin_branch_name}</strong>
            </div>
            <div>
              <span className="text-neutral-400 block">Chofer:</span>
              <strong className="text-neutral-900 dark:text-neutral-100">{selectedTransfer?.driver_name || 'N/A'}</strong>
            </div>
            <div>
              <span className="text-neutral-400 block">Placa Vehículo:</span>
              <strong className="font-mono text-neutral-900 dark:text-neutral-100">{selectedTransfer?.vehicle_plate || 'N/A'}</strong>
            </div>
            <div>
              <span className="text-neutral-400 block">Precinto Registrado:</span>
              <strong className="font-mono text-indigo-600 dark:text-indigo-400">{selectedTransfer?.security_seal_number || 'N/A'}</strong>
            </div>
          </div>

          {/* Security Seal Verification Checkbox */}
          <div className="flex items-center justify-between p-3 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Verificación de Precinto de Seguridad:</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-neutral-900 dark:text-neutral-100">
              <input
                type="checkbox"
                checked={receiveSecuritySealVerified}
                onChange={(e) => setReceiveSecuritySealVerified(e.target.checked)}
                className="w-4 h-4 rounded text-neutral-900"
              />
              <span>Precinto coincide e intacto</span>
            </label>
          </div>

          {/* Reception items table */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Verificación Física de Ítems Recibidos
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleMarkAllMatching}
                className="text-xs py-0.5 px-2 rounded-lg"
              >
                Marcar Todo Conforme
              </Button>
            </div>

            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-semibold sticky top-0">
                  <tr>
                    <th className="py-2 px-3">SKU</th>
                    <th className="py-2 px-3">Producto</th>
                    <th className="py-2 px-3 text-center">Despachado</th>
                    <th className="py-2 px-3 text-center w-24">Recibido</th>
                    <th className="py-2 px-3 text-center">Condición</th>
                    <th className="py-2 px-3 text-center">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {receptionItems.map((it) => {
                    const diff = Number(it.quantityReceived) - it.quantitySent;
                    return (
                      <tr key={it.productId}>
                        <td className="py-2 px-3 font-mono font-semibold">{it.sku}</td>
                        <td className="py-2 px-3">{it.name}</td>
                        <td className="py-2 px-3 text-center font-mono font-medium">{it.quantitySent}</td>
                        <td className="py-1 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={it.quantityReceived}
                            onChange={(e) =>
                              handleReceptionItemChange(it.productId, 'quantityReceived', parseFloat(e.target.value) || 0)
                            }
                            className="w-16 py-1 px-1.5 text-center font-mono font-bold bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg"
                          />
                        </td>
                        <td className="py-1 px-3 text-center">
                          <select
                            value={it.conditionStatus}
                            onChange={(e) =>
                              handleReceptionItemChange(it.productId, 'conditionStatus', e.target.value as any)
                            }
                            className="py-1 px-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                          >
                            <option value="OPTIMAL">Óptimo</option>
                            <option value="DAMAGED">Dañado</option>
                            <option value="SHORTAGE">Faltante</option>
                            <option value="SURPLUS">Sobrante</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`font-mono font-bold ${
                              diff === 0
                                ? 'text-emerald-600'
                                : diff < 0
                                ? 'text-rose-600'
                                : 'text-indigo-600'
                            }`}
                          >
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Notas de Recepción
            </label>
            <textarea
              value={receiveNotes}
              onChange={(e) => setReceiveNotes(e.target.value)}
              placeholder="Observaciones de empaque, daños reportados, justificación de discrepancias..."
              rows={2}
              className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowReceiveModal(false)}
              className="rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmReceive}
              disabled={submitting}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? 'Aprobando...' : 'Aprobar y Registrar en Inventario'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Importar Archivo de Transferencia (.ero / .json) */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportFileContent(null);
          setImportFileName('');
        }}
        title="Importar Archivo de Transferencia entre Sucursales (.ero)"
        maxWidth="max-w-lg"
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-neutral-500">
            Cargue el archivo de transferencia exportado desde la sucursal de origen para importar y verificar los
            datos del chofer, precinto e ítems sin necesidad de carga manual.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".ero,.json"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 rounded-lg p-6 text-center cursor-pointer bg-neutral-50 dark:bg-neutral-900/50 transition-colors"
          >
            <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              {importFileName ? importFileName : 'Haga clic para seleccionar archivo (.ero o .json)'}
            </p>
            <span className="text-[11px] text-neutral-400">Archivos firmados digitalmente por ERO ERP</span>
          </div>

          {importFileContent && (
            <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-500">N° Transferencia:</span>
                <strong className="font-mono text-neutral-900 dark:text-neutral-100">
                  {importFileContent.transferNumber}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Sucursal Origen:</span>
                <strong className="text-neutral-900 dark:text-neutral-100">
                  {importFileContent.originBranch?.name}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Ítems a Transferir:</span>
                <strong className="text-neutral-900 dark:text-neutral-100">
                  {importFileContent.items?.length || 0} producto(s)
                </strong>
              </div>
              {importFileContent.transitInfo?.driverName && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Chofer:</span>
                  <span>{importFileContent.transitInfo.driverName}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowImportModal(false);
                setImportFileContent(null);
                setImportFileName('');
              }}
              className="rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleExecuteImport}
              disabled={importing || !importFileContent}
              className="rounded-lg flex items-center gap-1.5"
            >
              {importing ? 'Importando...' : 'Cargar y Verificar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Enviar por Correo */}
      <Modal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        title="Enviar Transferencia por Correo Electrónico"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-neutral-500">
            Se enviará el archivo de intercambio digital y la notificación de despacho a la sucursal receptora.
          </p>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Correo Electrónico Destinatario
            </label>
            <input
              type="email"
              value={emailRecipient}
              onChange={(e) => setEmailRecipient(e.target.value)}
              placeholder="encargado@sucursal.com"
              className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Mensaje o Notas
            </label>
            <textarea
              value={emailNotes}
              onChange={(e) => setEmailNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowEmailModal(false)}
              className="rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSendEmail}
              disabled={sendingEmail || !emailRecipient}
              className="rounded-lg flex items-center gap-1.5"
            >
              {sendingEmail ? 'Enviando...' : 'Enviar Correo'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Buscador de Productos */}
      <ProductSearchModal
        isOpen={showProductSearch}
        onClose={() => setShowProductSearch(false)}
        mode="transfer"
        warehouseId={originWarehouseId}
        warehouseName={originWarehouses.find((w) => w.id === originWarehouseId)?.name || 'Depósito Origen'}
        onSelect={(prod) => {
          setNewProductId(prod.id);
          setShowProductSearch(false);
        }}
      />

      {/* Modal: Visor PDF Guía de Traslado */}
      <PdfViewerModal
        isOpen={pdfModal.isOpen}
        onClose={() => setPdfModal({ isOpen: false, endpoint: null, title: '' })}
        endpoint={pdfModal.endpoint}
        title={pdfModal.title}
        filename={pdfModal.filename}
      />
    </div>
  );
};

export default InventoryTransfersView;
