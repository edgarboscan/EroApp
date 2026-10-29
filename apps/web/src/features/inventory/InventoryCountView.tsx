import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import {
  Search,
  Barcode,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Check,
  Building2,
  Warehouse as WarehouseIcon,
  Layers,
  History,
  FileCheck,
  ClipboardCheck,
  Volume2,
  VolumeX,
  X,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { useExchangeRateStore } from '../../stores/exchangeRateStore';
import { formatMoneyUSD, formatMoneyVES } from '@ero/shared';
import { showConfirmQuestion } from '../../lib/sweetalert';
import type {
  WarehouseProductStockItem,
  InventoryCount,
  InventoryCountItem,
} from '@ero/shared';

interface BranchOption {
  id: string;
  name: string;
  warehouses: { id: string; name: string }[];
}

interface DepartmentOption {
  id: string;
  name: string;
}

export const InventoryCountView: React.FC = () => {
  const { activeBranchId, activeWarehouseId, token } = useAuthStore();
  const { rate: exchangeRate, currencySecondary } = useExchangeRateStore();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'workspace' | 'history'>('workspace');

  // Branch & Warehouse selection
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranchId || '');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(activeWarehouseId || '');
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  // Active Session & Stock Data
  const [activeSession, setActiveSession] = useState<InventoryCount | null>(null);
  const [productsStock, setProductsStock] = useState<WarehouseProductStockItem[]>([]);
  const [localCounts, setLocalCounts] = useState<Record<string, { counted: number; notes: string; countedAt?: string }>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [stockStatusFilter, setStockStatusFilter] = useState<
    'ALL' | 'WITH_STOCK' | 'ZERO_STOCK' | 'NEGATIVE_STOCK' | 'DISCREPANCIES' | 'PENDING_COUNT'
  >('ALL');
  const [isBlindCount, setIsBlindCount] = useState<boolean>(false);

  // Scanner Gun Input State
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [audioFeedback, setAudioFeedback] = useState<boolean>(true);
  const [lastScannedFeedback, setLastScannedFeedback] = useState<{
    name: string;
    sku: string;
    count: number;
    difference: number;
  } | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Loading & Submission states
  const [loadingStock, setLoadingStock] = useState<boolean>(false);
  const [savingBatch, setSavingBatch] = useState<boolean>(false);
  const [reconciling, setReconciling] = useState<boolean>(false);

  // History Tab states
  const [historySessions, setHistorySessions] = useState<InventoryCount[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Modal: New Session
  const [showNewSessionModal, setShowNewSessionModal] = useState<boolean>(false);
  const [newSessionTitle, setNewSessionTitle] = useState<string>('');
  const [newSessionNotes, setNewSessionNotes] = useState<string>('');
  const [newSessionBlind, setNewSessionBlind] = useState<boolean>(false);
  const [newSessionDepartmentId, setNewSessionDepartmentId] = useState<string>('');
  const [creatingSession, setCreatingSession] = useState<boolean>(false);

  // Modal: Reconcile confirmation
  const [showReconcileModal, setShowReconcileModal] = useState<boolean>(false);
  const [reconcileNotes, setReconcileNotes] = useState<string>('');

  // Audio beep player using Web Audio API
  const playBeep = useCallback((success: boolean = true) => {
    if (!audioFeedback) return;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(success ? 880 : 330, audioCtx.currentTime); // A5 for success, E4 for error
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // AudioContext not supported or allowed
    }
  }, [audioFeedback]);

  // Load branches & departments on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const [branchRes, deptRes] = await Promise.all([
          fetch('/api/auth/branches', { headers }),
          fetch('/api/inventory/departments', { headers }),
        ]);

        if (branchRes.ok) {
          const bData = await branchRes.json();
          if (bData.success && Array.isArray(bData.data)) {
            setBranches(bData.data);
            if (!selectedBranchId && bData.data.length > 0) {
              const firstBranch = bData.data[0];
              setSelectedBranchId(firstBranch.id);
              if (firstBranch.warehouses && firstBranch.warehouses.length > 0) {
                setSelectedWarehouseId(firstBranch.warehouses[0].id);
              }
            } else if (selectedBranchId && !selectedWarehouseId) {
              const curBranch = bData.data.find((b: BranchOption) => b.id === selectedBranchId);
              if (curBranch && curBranch.warehouses?.length > 0) {
                setSelectedWarehouseId(curBranch.warehouses[0].id);
              }
            }
          }
        }

        if (deptRes.ok) {
          const dData = await deptRes.json();
          if (dData.success && Array.isArray(dData.data)) {
            setDepartments(dData.data);
          }
        }
      } catch {
        toast.error('Error al cargar sucursales y departamentos');
      }
    };

    fetchMetadata();
  }, [token]);

  // Available warehouses based on selected branch
  const availableWarehouses = useMemo(() => {
    const b = branches.find((branch) => branch.id === selectedBranchId);
    return b ? b.warehouses : [];
  }, [branches, selectedBranchId]);

  // Fetch live stock for selected warehouse
  const fetchStock = useCallback(async () => {
    if (!selectedBranchId || !selectedWarehouseId) return;

    setLoadingStock(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const params = new URLSearchParams({
        branchId: selectedBranchId,
        warehouseId: selectedWarehouseId,
      });

      const res = await fetch(`/api/inventory/counts/products-stock?${params.toString()}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setProductsStock(json.data);

          // If no active session, initialize local counts with empty state
          if (!activeSession) {
            const initialMap: Record<string, { counted: number; notes: string }> = {};
            json.data.forEach((p: WarehouseProductStockItem) => {
              initialMap[p.id] = {
                counted: p.currentStock, // default proposal
                notes: '',
              };
            });
            setLocalCounts(initialMap);
            setHasUnsavedChanges(false);
          }
        }
      } else {
        toast.error('No se pudo obtener el stock del depósito');
      }
    } catch {
      toast.error('Error de red al consultar el stock');
    } finally {
      setLoadingStock(false);
    }
  }, [selectedBranchId, selectedWarehouseId, token, activeSession]);

  useEffect(() => {
    if (selectedWarehouseId) {
      fetchStock();
    }
  }, [selectedWarehouseId, fetchStock]);

  // Fetch count history
  const fetchHistory = useCallback(async () => {
    if (!selectedBranchId) return;
    setLoadingHistory(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const params = new URLSearchParams({
        branchId: selectedBranchId,
        ...(selectedWarehouseId ? { warehouseId: selectedWarehouseId } : {}),
      });

      const res = await fetch(`/api/inventory/counts?${params.toString()}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setHistorySessions(json.data);
        }
      }
    } catch {
      toast.error('Error al consultar el historial de conteos');
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedBranchId, selectedWarehouseId, token]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  // Handle barcode / SKU scan
  const handleBarcodeScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCode = barcodeInput.trim();
    if (!rawCode) return;

    // Search product in current list
    const foundProduct = productsStock.find(
      (p) =>
        p.barcode?.toLowerCase() === rawCode.toLowerCase() ||
        p.sku.toLowerCase() === rawCode.toLowerCase()
    );

    if (foundProduct) {
      const currentCount = localCounts[foundProduct.id]?.counted ?? 0;
      const newCount = currentCount + 1;
      const difference = newCount - foundProduct.currentStock;

      setLocalCounts((prev) => ({
        ...prev,
        [foundProduct.id]: {
          counted: newCount,
          notes: prev[foundProduct.id]?.notes || '',
          countedAt: new Date().toISOString(),
        },
      }));
      setHasUnsavedChanges(true);
      playBeep(true);

      setLastScannedFeedback({
        name: foundProduct.name,
        sku: foundProduct.sku,
        count: newCount,
        difference,
      });

      toast.success(`+1: ${foundProduct.name} (Total: ${newCount})`);
    } else {
      playBeep(false);
      toast.error(`Producto no encontrado para el código: ${rawCode}`);
    }

    setBarcodeInput('');
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  // Adjust local counted quantity
  const handleCountChange = (productId: string, newQuantity: number) => {
    const sanitized = Math.max(0, Number(newQuantity) || 0);
    setLocalCounts((prev) => ({
      ...prev,
      [productId]: {
        counted: sanitized,
        notes: prev[productId]?.notes || '',
        countedAt: new Date().toISOString(),
      },
    }));
    setHasUnsavedChanges(true);
  };

  // Adjust note for item
  const handleNoteChange = (productId: string, notes: string) => {
    setLocalCounts((prev) => ({
      ...prev,
      [productId]: {
        counted: prev[productId]?.counted ?? 0,
        notes,
      },
    }));
    setHasUnsavedChanges(true);
  };

  // Mark item as matching theoretical stock
  const handleMarkMatching = (p: WarehouseProductStockItem) => {
    handleCountChange(p.id, p.currentStock);
    toast.info(`Stock conforme establecido para: ${p.sku}`);
  };

  // Reset item count to zero
  const handleSetZero = (p: WarehouseProductStockItem) => {
    handleCountChange(p.id, 0);
  };

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return productsStock.filter((p) => {
      // Text search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesSku = p.sku.toLowerCase().includes(query);
        const matchesBarcode = p.barcode?.toLowerCase().includes(query);
        if (!matchesName && !matchesSku && !matchesBarcode) {
          return false;
        }
      }

      // Department filter
      if (selectedDepartmentId && p.departmentId !== selectedDepartmentId) {
        return false;
      }

      // Stock status filter
      const counted = localCounts[p.id]?.counted;
      const isCounted = counted !== undefined;
      const difference = (counted ?? 0) - p.currentStock;

      if (stockStatusFilter === 'WITH_STOCK' && p.currentStock <= 0) return false;
      if (stockStatusFilter === 'ZERO_STOCK' && p.currentStock !== 0) return false;
      if (stockStatusFilter === 'NEGATIVE_STOCK' && p.currentStock >= 0) return false;
      if (stockStatusFilter === 'DISCREPANCIES' && difference === 0) return false;
      if (stockStatusFilter === 'PENDING_COUNT' && isCounted) return false;

      return true;
    });
  }, [productsStock, searchTerm, selectedDepartmentId, stockStatusFilter, localCounts]);

  // Overall Statistics & Net Discrepancies
  const statistics = useMemo(() => {
    let totalItems = productsStock.length;
    let totalSystemUnits = 0;
    let totalCountedUnits = 0;
    let itemsCounted = 0;
    let itemsMatching = 0;
    let itemsSurplus = 0;
    let itemsMissing = 0;
    let totalCostSurplusUSD = 0;
    let totalCostMissingUSD = 0;

    productsStock.forEach((p) => {
      totalSystemUnits += p.currentStock;
      const local = localCounts[p.id];
      const counted = local?.counted ?? 0;
      totalCountedUnits += counted;

      if (local !== undefined) {
        itemsCounted += 1;
        const diff = counted - p.currentStock;
        if (diff === 0) {
          itemsMatching += 1;
        } else if (diff > 0) {
          itemsSurplus += 1;
          totalCostSurplusUSD += diff * p.costPrice;
        } else {
          itemsMissing += 1;
          totalCostMissingUSD += Math.abs(diff) * p.costPrice;
        }
      }
    });

    const netImpactUSD = totalCostSurplusUSD - totalCostMissingUSD;
    const netImpactVES = netImpactUSD * (exchangeRate || 1);
    const progressPercent = totalItems > 0 ? Math.round((itemsCounted / totalItems) * 100) : 0;

    return {
      totalItems,
      totalSystemUnits,
      totalCountedUnits,
      itemsCounted,
      itemsMatching,
      itemsSurplus,
      itemsMissing,
      totalCostSurplusUSD,
      totalCostMissingUSD,
      netImpactUSD,
      netImpactVES,
      progressPercent,
    };
  }, [productsStock, localCounts, exchangeRate]);

  // Create new formal counting session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId || !selectedWarehouseId) {
      toast.error('Debe seleccionar una sucursal y depósito válidos');
      return;
    }

    setCreatingSession(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const payload = {
        branchId: selectedBranchId,
        warehouseId: selectedWarehouseId,
        departmentId: newSessionDepartmentId || undefined,
        title: newSessionTitle.trim() || undefined,
        notes: newSessionNotes.trim() || undefined,
        blindCount: newSessionBlind,
      };

      const res = await fetch('/api/inventory/counts', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setActiveSession(json.data);
          setIsBlindCount(json.data.blindCount);
          setShowNewSessionModal(false);
          toast.success(`Sesión iniciada: ${json.data.countNumber}`);

          // Map session items into localCounts
          const newMap: Record<string, { counted: number; notes: string }> = {};
          (json.data.items || []).forEach((it: InventoryCountItem) => {
            newMap[it.productId] = {
              counted: it.countedStock ?? it.systemStock,
              notes: it.notes || '',
            };
          });
          setLocalCounts(newMap);
          setHasUnsavedChanges(false);
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        toast.error(errJson.error?.message || 'Error al crear la sesión de conteo');
      }
    } catch {
      toast.error('Error de red al crear sesión de conteo');
    } finally {
      setCreatingSession(false);
    }
  };

  // Save batch count progress to backend
  const handleSaveProgress = async () => {
    if (!activeSession) {
      toast.info('Para registrar auditorías persistentes en el sistema, inicie una Sesión de Conteo');
      return;
    }

    setSavingBatch(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const itemsPayload = Object.entries(localCounts).map(([productId, val]) => ({
        productId,
        countedStock: val.counted,
        notes: val.notes || undefined,
      }));

      const res = await fetch(`/api/inventory/counts/${activeSession.id}/items`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ items: itemsPayload }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setActiveSession(json.data);
          setHasUnsavedChanges(false);
          toast.success('Progreso de conteo guardado en el servidor');
        }
      } else {
        toast.error('Error al guardar el progreso del conteo');
      }
    } catch {
      toast.error('Error de red al guardar progreso');
    } finally {
      setSavingBatch(false);
    }
  };

  // Resume an existing session from history
  const handleResumeSession = async (session: InventoryCount) => {
    setSelectedBranchId(session.branchId);
    setSelectedWarehouseId(session.warehouseId);
    setActiveSession(session);
    setIsBlindCount(session.blindCount);

    // Map items
    const newMap: Record<string, { counted: number; notes: string }> = {};
    (session.items || []).forEach((it: InventoryCountItem) => {
      newMap[it.productId] = {
        counted: it.countedStock ?? it.systemStock,
        notes: it.notes || '',
      };
    });
    setLocalCounts(newMap);
    setHasUnsavedChanges(false);
    setActiveTab('workspace');
    toast.info(`Sesión cargada: ${session.countNumber}`);
  };

  // Execute reconciliation and auto-adjust
  const handleConfirmReconcile = async () => {
    if (!activeSession) {
      toast.error('No hay una sesión activa de conteo para conciliar');
      return;
    }

    const confirmed = await showConfirmQuestion({
      title: '¿Conciliar y Aplicar Ajuste Contable?',
      text: `Se generará un Ajuste de Inventario automático por Conteo Físico con un impacto neto de ${formatMoneyUSD(
        statistics.netImpactUSD
      )}. Esta acción impactará el Kardex oficial.`,
      confirmButtonText: 'Sí, conciliar inventario',
      cancelButtonText: 'Cancelar',
    });

    if (!confirmed) return;

    setReconciling(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      // First ensure latest counts are saved
      const itemsPayload = Object.entries(localCounts).map(([productId, val]) => ({
        productId,
        countedStock: val.counted,
        notes: val.notes || undefined,
      }));

      await fetch(`/api/inventory/counts/${activeSession.id}/items`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ items: itemsPayload }),
      });

      // Now reconcile
      const res = await fetch(`/api/inventory/counts/${activeSession.id}/reconcile`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          adjustmentNotes: reconcileNotes.trim() || undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          toast.success(
            `Ajuste de inventario aplicado con éxito. N° Ajuste: ${json.adjustment?.adjustmentNumber || 'N/A'}`
          );
          setActiveSession(json.data);
          setShowReconcileModal(false);
          setHasUnsavedChanges(false);
          fetchStock(); // Refresh stock
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        toast.error(errJson.error?.message || 'Error al conciliar la sesión de conteo');
      }
    } catch {
      toast.error('Error de red al aplicar la conciliación');
    } finally {
      setReconciling(false);
    }
  };

  // Print physical count sheet
  const handlePrintSheet = () => {
    if (!activeSession) {
      toast.info('Inicie o seleccione una sesión de conteo para imprimir la planilla con folio oficial');
      return;
    }
    const url = `/api/inventory/counts/${activeSession.id}/sheet-html`;
    window.open(url, '_blank');
  };

  // Export current count table to CSV
  const handleExportCSV = () => {
    if (productsStock.length === 0) {
      toast.info('No hay productos para exportar');
      return;
    }

    const headers = [
      'SKU',
      'Codigo de Barras',
      'Producto',
      'Departamento',
      'Unidad',
      'Ubicacion Pasillo',
      'Ubicacion Estante',
      'Stock Teórico',
      'Stock Físico Contado',
      'Diferencia',
      'Costo Unitario USD',
      'Impacto Total USD',
      'Observaciones',
    ];

    const rows = filteredProducts.map((p) => {
      const counted = localCounts[p.id]?.counted ?? 0;
      const diff = counted - p.currentStock;
      const impactUSD = diff * p.costPrice;
      const notes = localCounts[p.id]?.notes || '';

      return [
        `"${p.sku}"`,
        `"${p.barcode || ''}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.departmentName || 'General'}"`,
        `"${p.unitOfMeasure}"`,
        `"${p.aisle || ''}"`,
        `"${p.shelf || ''}"`,
        p.currentStock,
        counted,
        diff,
        p.costPrice.toFixed(4),
        impactUSD.toFixed(4),
        `"${notes.replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `conteo_inventario_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Archivo CSV descargado');
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full">
      {/* Header and Branch/Warehouse Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded-lg">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                Conteo y Auditoría de Depósitos
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Auditoría física de existencias, escaneo de códigos de barra y conciliación contable
              </p>
            </div>
          </div>
        </div>

        {/* Branch and Warehouse Pickers */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <Building2 className="w-4 h-4 text-neutral-500 ml-1" />
            <select
              value={selectedBranchId}
              onChange={(e) => {
                const bId = e.target.value;
                setSelectedBranchId(bId);
                const b = branches.find((item) => item.id === bId);
                if (b && b.warehouses.length > 0) {
                  setSelectedWarehouseId(b.warehouses[0].id);
                } else {
                  setSelectedWarehouseId('');
                }
              }}
              className="bg-transparent text-xs md:text-sm font-medium text-neutral-800 dark:text-neutral-200 focus:outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="dark:bg-neutral-900">
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <WarehouseIcon className="w-4 h-4 text-neutral-500 ml-1" />
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="bg-transparent text-xs md:text-sm font-medium text-neutral-800 dark:text-neutral-200 focus:outline-none"
            >
              {availableWarehouses.map((w) => (
                <option key={w.id} value={w.id} className="dark:bg-neutral-900">
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchStock}
            disabled={loadingStock}
            className="flex items-center gap-1.5 rounded-lg"
            title="Recargar inventario en vivo"
          >
            <RefreshCw className={`w-4 h-4 ${loadingStock ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('workspace')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors rounded-t-lg ${
              activeTab === 'workspace'
                ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Auditoría en Vivo</span>
            {activeSession && (
              <Badge variant="info" className="ml-1 text-xs">
                {activeSession.countNumber}
              </Badge>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors rounded-t-lg ${
              activeTab === 'history'
                ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial de Sesiones</span>
          </button>
        </div>

        {/* Active Session Status & Save Indicator */}
        {activeTab === 'workspace' && (
          <div className="flex items-center gap-2 pb-2">
            {hasUnsavedChanges && (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Cambios pendientes
              </span>
            )}
            {activeSession ? (
              <Badge
                variant={
                  activeSession.status === 'APPLIED'
                    ? 'success'
                    : activeSession.status === 'IN_PROGRESS'
                    ? 'warning'
                    : 'neutral'
                }
              >
                {activeSession.status === 'APPLIED' ? 'Conciliado' : 'En Progreso'}
              </Badge>
            ) : (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Modo Conteo Libre</span>
            )}
          </div>
        )}
      </div>

      {activeTab === 'workspace' ? (
        <>
          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <Card className="p-3.5 flex flex-col justify-between border border-neutral-200 dark:border-neutral-800 rounded-lg">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Total Productos</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  {statistics.totalItems}
                </span>
                <span className="text-xs text-neutral-500">{statistics.totalSystemUnits} uds</span>
              </div>
              <div className="mt-2 w-full bg-neutral-200 dark:bg-neutral-700 h-1 rounded-full overflow-hidden">
                <div
                  className="bg-neutral-900 dark:bg-neutral-100 h-full transition-all duration-300"
                  style={{ width: `${statistics.progressPercent}%` }}
                />
              </div>
            </Card>

            <Card className="p-3.5 flex flex-col justify-between border border-neutral-200 dark:border-neutral-800 rounded-lg">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Ítems Auditados</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {statistics.itemsCounted}
                </span>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {statistics.progressPercent}%
                </span>
              </div>
              <span className="text-[11px] text-neutral-500 mt-1">
                {statistics.totalCountedUnits} uds contadas
              </span>
            </Card>

            <Card className="p-3.5 flex flex-col justify-between border border-neutral-200 dark:border-neutral-800 rounded-lg">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Conformes (Exactos)</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {statistics.itemsMatching}
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <span className="text-[11px] text-neutral-500 mt-1">Sin diferencias</span>
            </Card>

            <Card className="p-3.5 flex flex-col justify-between border border-neutral-200 dark:border-neutral-800 rounded-lg">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Sobrantes (+)</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                  {statistics.itemsSurplus}
                </span>
                <TrendingUp className="w-4 h-4 text-indigo-500" />
              </div>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                +{formatMoneyUSD(statistics.totalCostSurplusUSD)}
              </span>
            </Card>

            <Card className="p-3.5 flex flex-col justify-between border border-neutral-200 dark:border-neutral-800 rounded-lg">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Faltantes (-)</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-rose-600 dark:text-rose-400">
                  {statistics.itemsMissing}
                </span>
                <TrendingDown className="w-4 h-4 text-rose-500" />
              </div>
              <span className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-medium">
                -{formatMoneyUSD(statistics.totalCostMissingUSD)}
              </span>
            </Card>

            <Card className="p-3.5 flex flex-col justify-between border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900/40">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Descuadre Neto</span>
              <div className="mt-1">
                <span
                  className={`text-lg font-bold ${
                    statistics.netImpactUSD > 0
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : statistics.netImpactUSD < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  {statistics.netImpactUSD > 0 ? '+' : ''}
                  {formatMoneyUSD(statistics.netImpactUSD)}
                </span>
              </div>
              <span className="text-[11px] text-neutral-500 mt-1">
                {formatMoneyVES(statistics.netImpactVES)} ({currencySecondary})
              </span>
            </Card>
          </div>

          {/* Blind Count Notice */}
          {isBlindCount && (
            <div className="flex items-center gap-2 p-3 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded-lg text-xs md:text-sm">
              <EyeOff className="w-4 h-4 shrink-0" />
              <span>
                <strong>Modo Conteo a Ciegas Activo:</strong> Las existencias teóricas del sistema y las diferencias
                permanecen ocultas durante el conteo físico para garantizar una auditoría objetiva.
              </span>
            </div>
          )}

          {/* Barcode Scanner Gun Bar */}
          <Card className="p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50/50 dark:bg-neutral-900/30">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <form onSubmit={handleBarcodeScan} className="flex-1 flex items-center gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Escanear código de barras o ingresar SKU del producto..."
                    className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-100"
                    autoFocus
                  />
                </div>
                <Button type="submit" variant="primary" size="md" className="rounded-lg shrink-0">
                  <Plus className="w-4 h-4 mr-1" />
                  Contar (+1)
                </Button>
              </form>

              {/* Sound toggle & Gun Status */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setAudioFeedback(!audioFeedback)}
                  className={`p-2 rounded-lg border transition-colors ${
                    audioFeedback
                      ? 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200'
                      : 'border-transparent text-neutral-400 hover:text-neutral-600'
                  }`}
                  title={audioFeedback ? 'Sonido activado' : 'Sonido silenciado'}
                >
                  {audioFeedback ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBlindCount(!isBlindCount)}
                  className="rounded-lg flex items-center gap-1.5"
                  title="Alternar modo a ciegas"
                >
                  {isBlindCount ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  <span className="text-xs">{isBlindCount ? 'Mostrar Stock Teórico' : 'Conteo a Ciegas'}</span>
                </Button>
              </div>
            </div>

            {/* Last Scanned Feedback Banner */}
            {lastScannedFeedback && (
              <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">Último escaneado:</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {lastScannedFeedback.sku} - {lastScannedFeedback.name}
                  </span>
                  <Badge variant="info">Conteo: {lastScannedFeedback.count}</Badge>
                </div>
                {!isBlindCount && (
                  <div>
                    <span className="text-neutral-500 mr-1">Diferencia:</span>
                    <span
                      className={`font-semibold ${
                        lastScannedFeedback.difference > 0
                          ? 'text-indigo-600'
                          : lastScannedFeedback.difference < 0
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {lastScannedFeedback.difference > 0 ? '+' : ''}
                      {lastScannedFeedback.difference}
                    </span>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Search, Department Filter and Status Filter */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {/* Text Search */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por código, SKU o nombre..."
                  className="w-full pl-9 pr-8 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs md:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-100"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Department Dropdown */}
              <div className="w-44">
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs md:text-sm text-neutral-800 dark:text-neutral-200 focus:outline-none"
                >
                  <option value="">Todos los Deptos</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stock Filter */}
              <div className="w-44">
                <select
                  value={stockStatusFilter}
                  onChange={(e) => setStockStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs md:text-sm text-neutral-800 dark:text-neutral-200 focus:outline-none"
                >
                  <option value="ALL">Todos los Estados</option>
                  <option value="WITH_STOCK">Con Stock (&gt; 0)</option>
                  <option value="ZERO_STOCK">Sin Stock (= 0)</option>
                  <option value="NEGATIVE_STOCK">Negativos (&lt; 0)</option>
                  <option value="DISCREPANCIES">Con Diferencias</option>
                  <option value="PENDING_COUNT">Pendientes por Contar</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {!activeSession ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowNewSessionModal(true)}
                  className="rounded-lg flex items-center gap-1.5"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Iniciar Sesión Formal</span>
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveProgress}
                    disabled={savingBatch || !hasUnsavedChanges}
                    className="rounded-lg flex items-center gap-1.5"
                  >
                    <Save className={`w-4 h-4 ${savingBatch ? 'animate-spin' : ''}`} />
                    <span>Guardar Progreso</span>
                  </Button>

                  {activeSession.status !== 'APPLIED' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowReconcileModal(true)}
                      className="rounded-lg flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Conciliar y Ajustar</span>
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrintSheet}
                    className="rounded-lg flex items-center gap-1.5"
                    title="Imprimir planilla para conteo físico en almacén"
                  >
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">Planilla</span>
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="rounded-lg flex items-center gap-1.5"
                title="Exportar a CSV"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            </div>
          </div>

          {/* Count Table */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-neutral-100/70 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400 font-semibold text-xs border-b border-neutral-200 dark:border-neutral-700">
                  <tr>
                    <th className="py-3 px-3 w-12 text-center">#</th>
                    <th className="py-3 px-3">Código / SKU</th>
                    <th className="py-3 px-3">Código de Barras</th>
                    <th className="py-3 px-3 min-w-[200px]">Producto & Depto.</th>
                    <th className="py-3 px-3 text-center">Ubicación</th>
                    {!isBlindCount && <th className="py-3 px-3 text-right">Stock Teórico</th>}
                    <th className="py-3 px-3 text-center min-w-[170px]">Stock Físico (Contado)</th>
                    {!isBlindCount && (
                      <>
                        <th className="py-3 px-3 text-center">Diferencia</th>
                        <th className="py-3 px-3 text-right">Impacto ($)</th>
                      </>
                    )}
                    <th className="py-3 px-3 min-w-[150px]">Observación</th>
                    <th className="py-3 px-3 text-center w-20">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {loadingStock ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-4 px-3 text-center">
                          <Skeleton className="h-4 w-4 mx-auto" />
                        </td>
                        <td className="py-4 px-3">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="py-4 px-3">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="py-4 px-3">
                          <Skeleton className="h-4 w-40" />
                        </td>
                        <td className="py-4 px-3">
                          <Skeleton className="h-4 w-16 mx-auto" />
                        </td>
                        {!isBlindCount && (
                          <td className="py-4 px-3">
                            <Skeleton className="h-4 w-12 ml-auto" />
                          </td>
                        )}
                        <td className="py-4 px-3">
                          <Skeleton className="h-8 w-28 mx-auto" />
                        </td>
                        {!isBlindCount && (
                          <>
                            <td className="py-4 px-3">
                              <Skeleton className="h-4 w-12 mx-auto" />
                            </td>
                            <td className="py-4 px-3">
                              <Skeleton className="h-4 w-16 ml-auto" />
                            </td>
                          </>
                        )}
                        <td className="py-4 px-3">
                          <Skeleton className="h-8 w-full" />
                        </td>
                        <td className="py-4 px-3">
                          <Skeleton className="h-6 w-12 mx-auto" />
                        </td>
                      </tr>
                    ))
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={isBlindCount ? 8 : 11} className="py-12 text-center text-neutral-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <ClipboardCheck className="w-8 h-8 text-neutral-400 stroke-[1.5]" />
                          <p className="font-medium text-sm">No se encontraron productos en este depósito con los filtros activos</p>
                          <span className="text-xs text-neutral-400">
                            Pruebe cambiando los términos de búsqueda o verifique la asignación de sucursal
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p, idx) => {
                      const local = localCounts[p.id];
                      const counted = local?.counted ?? p.currentStock;
                      const diff = counted - p.currentStock;
                      const impactUSD = diff * p.costPrice;
                      const locationText = [p.aisle ? `P:${p.aisle}` : '', p.shelf ? `E:${p.shelf}` : '']
                        .filter(Boolean)
                        .join(' ') || '-';

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors"
                        >
                          <td className="py-3 px-3 text-center text-xs text-neutral-400 font-mono">
                            {idx + 1}
                          </td>

                          <td className="py-3 px-3 font-mono text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                            {p.sku}
                          </td>

                          <td className="py-3 px-3 font-mono text-xs text-neutral-600 dark:text-neutral-400">
                            {p.barcode || '-'}
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-medium text-neutral-900 dark:text-neutral-100 text-xs md:text-sm">
                              {p.name}
                            </div>
                            <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                              <span>{p.departmentName || 'General'}</span>
                              <span>•</span>
                              <span>{p.unitOfMeasure}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center text-xs font-mono text-neutral-600 dark:text-neutral-400">
                            {locationText}
                          </td>

                          {!isBlindCount && (
                            <td className="py-3 px-3 text-right font-mono text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                              {p.currentStock}
                            </td>
                          )}

                          <td className="py-2 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleCountChange(p.id, counted - 1)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
                                title="Restar 1"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>

                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={counted}
                                onChange={(e) => handleCountChange(p.id, parseFloat(e.target.value) || 0)}
                                className="w-16 py-1 px-1.5 text-center font-mono text-xs md:text-sm font-bold bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-100"
                              />

                              <button
                                type="button"
                                onClick={() => handleCountChange(p.id, counted + 1)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
                                title="Sumar 1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          {!isBlindCount && (
                            <>
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold font-mono ${
                                    diff === 0
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      : diff > 0
                                      ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                  }`}
                                >
                                  {diff > 0 ? `+${diff}` : diff}
                                </span>
                              </td>

                              <td className="py-3 px-3 text-right font-mono text-xs">
                                <span
                                  className={`font-semibold ${
                                    impactUSD > 0
                                      ? 'text-indigo-600 dark:text-indigo-400'
                                      : impactUSD < 0
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-neutral-400'
                                  }`}
                                >
                                  {impactUSD > 0 ? `+${formatMoneyUSD(impactUSD)}` : formatMoneyUSD(impactUSD)}
                                </span>
                              </td>
                            </>
                          )}

                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={local?.notes || ''}
                              onChange={(e) => handleNoteChange(p.id, e.target.value)}
                              placeholder="Observación..."
                              className="w-full py-1 px-2 text-xs bg-transparent border border-neutral-200 dark:border-neutral-800 rounded-lg focus:bg-white dark:focus:bg-neutral-950 focus:outline-none focus:border-neutral-400"
                            />
                          </td>

                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMarkMatching(p)}
                                className="p-1 rounded-lg text-neutral-400 hover:text-emerald-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                title="Marcar conforme (igual al teórico)"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetZero(p)}
                                className="p-1 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                title="Fijar en cero (0)"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Summary */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-900/60 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-500">
              <span>
                Mostrando {filteredProducts.length} de {productsStock.length} productos en depósito
              </span>
              <div className="flex items-center gap-4">
                <span>
                  Unidades Teóricas: <strong>{statistics.totalSystemUnits}</strong>
                </span>
                <span>
                  Unidades Contadas: <strong>{statistics.totalCountedUnits}</strong>
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* History Tab */
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm md:text-base">
              Sesiones Registradas de Conteo de Inventario
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="rounded-lg flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
              <span>Actualizar Historial</span>
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-neutral-100/70 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400 font-semibold text-xs border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th className="py-3 px-3">Folio</th>
                  <th className="py-3 px-3">Título / Notas</th>
                  <th className="py-3 px-3">Depósito</th>
                  <th className="py-3 px-3 text-center">Modo</th>
                  <th className="py-3 px-3 text-center">Estado</th>
                  <th className="py-3 px-3 text-right">Ítems con Dif.</th>
                  <th className="py-3 px-3 text-right">Impacto USD</th>
                  <th className="py-3 px-3">Fecha</th>
                  <th className="py-3 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {loadingHistory ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-3 px-3">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="py-3 px-3">
                        <Skeleton className="h-4 w-40" />
                      </td>
                      <td className="py-3 px-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="py-3 px-3">
                        <Skeleton className="h-4 w-16 mx-auto" />
                      </td>
                      <td className="py-3 px-3">
                        <Skeleton className="h-4 w-16 mx-auto" />
                      </td>
                      <td className="py-3 px-3">
                        <Skeleton className="h-4 w-12 ml-auto" />
                      </td>
                      <td className="py-3 px-3">
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </td>
                      <td className="py-3 px-3">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="py-3 px-3">
                        <Skeleton className="h-6 w-16 mx-auto" />
                      </td>
                    </tr>
                  ))
                ) : historySessions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-neutral-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <History className="w-8 h-8 text-neutral-400 stroke-[1.5]" />
                        <p className="font-medium text-sm">No hay sesiones de conteo registradas en este depósito</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  historySessions.map((session) => (
                    <tr
                      key={session.id}
                      className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <td className="py-3 px-3 font-mono text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {session.countNumber}
                      </td>

                      <td className="py-3 px-3 text-xs">
                        <div className="font-medium text-neutral-900 dark:text-neutral-100">
                          {session.title || 'Conteo Físico General'}
                        </div>
                        {session.notes && <div className="text-neutral-500 text-[11px] truncate max-w-xs">{session.notes}</div>}
                      </td>

                      <td className="py-3 px-3 text-xs text-neutral-700 dark:text-neutral-300">
                        {session.warehouseName || 'Depósito'}
                      </td>

                      <td className="py-3 px-3 text-center text-xs">
                        {session.blindCount ? (
                          <Badge variant="warning">A Ciegas</Badge>
                        ) : (
                          <Badge variant="neutral">Estándar</Badge>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center text-xs">
                        <Badge
                          variant={
                            session.status === 'APPLIED'
                              ? 'success'
                              : session.status === 'IN_PROGRESS'
                              ? 'info'
                              : 'neutral'
                          }
                        >
                          {session.status === 'APPLIED'
                            ? 'Conciliado'
                            : session.status === 'IN_PROGRESS'
                            ? 'En Progreso'
                            : session.status}
                        </Badge>
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-xs font-semibold">
                        {session.totalDiscrepancies}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-xs font-semibold">
                        {formatMoneyUSD(session.netCostImpact || 0)}
                      </td>

                      <td className="py-3 px-3 text-xs text-neutral-500">
                        {new Date(session.startedAt).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResumeSession(session)}
                            className="rounded-lg text-xs py-1 px-2"
                            title="Reanudar o cargar sesión"
                          >
                            Abrir
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/api/inventory/counts/${session.id}/sheet-html`, '_blank')}
                            className="rounded-lg p-1.5"
                            title="Imprimir planilla"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: New Count Session */}
      <Modal
        isOpen={showNewSessionModal}
        onClose={() => setShowNewSessionModal(false)}
        title="Iniciar Nueva Sesión de Conteo Físico"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateSession} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Título de la Sesión
            </label>
            <input
              type="text"
              value={newSessionTitle}
              onChange={(e) => setNewSessionTitle(e.target.value)}
              placeholder="Ej. Auditoría de Cierre Mensual - Pasillos A y B"
              className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Alcance por Departamento (Opcional)
            </label>
            <select
              value={newSessionDepartmentId}
              onChange={(e) => setNewSessionDepartmentId(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-800 dark:text-neutral-200 focus:outline-none"
            >
              <option value="">Todo el Depósito (Todos los Departamentos)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Notas u Observaciones
            </label>
            <textarea
              value={newSessionNotes}
              onChange={(e) => setNewSessionNotes(e.target.value)}
              placeholder="Indicaciones para el equipo de almacén, condiciones del conteo..."
              rows={3}
              className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-100"
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
            <input
              type="checkbox"
              id="blindCountCheckbox"
              checked={newSessionBlind}
              onChange={(e) => setNewSessionBlind(e.target.checked)}
              className="w-4 h-4 rounded text-neutral-900 focus:ring-neutral-900 dark:focus:ring-neutral-100"
            />
            <label htmlFor="blindCountCheckbox" className="text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
              <strong>Activar Conteo a Ciegas:</strong> Oculta las existencias teóricas del sistema en la pantalla y en
              la planilla impresa para que los auditores no estén condicionados por el stock del sistema.
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowNewSessionModal(false)}
              className="rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={creatingSession}
              className="rounded-lg flex items-center gap-1.5"
            >
              {creatingSession ? 'Creando...' : 'Iniciar Conteo'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Reconcile & Generate Adjustment */}
      <Modal
        isOpen={showReconcileModal}
        onClose={() => setShowReconcileModal(false)}
        title="Conciliación y Ajuste Automático de Inventario"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-neutral-500">Ítems con Diferencias:</span>
              <strong className="text-neutral-900 dark:text-neutral-100">
                {statistics.itemsSurplus + statistics.itemsMissing} productos
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Sobrantes (+):</span>
              <strong className="text-indigo-600 dark:text-indigo-400">
                +{formatMoneyUSD(statistics.totalCostSurplusUSD)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Faltantes (-):</span>
              <strong className="text-rose-600 dark:text-rose-400">
                -{formatMoneyUSD(statistics.totalCostMissingUSD)}
              </strong>
            </div>
            <div className="flex justify-between border-t border-neutral-200 dark:border-neutral-700 pt-1.5">
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">Impacto Neto Valorado:</span>
              <strong className="text-neutral-900 dark:text-neutral-100 font-mono text-sm">
                {formatMoneyUSD(statistics.netImpactUSD)}
              </strong>
            </div>
            <div className="text-right text-[11px] text-neutral-500">
              ≈ {formatMoneyVES(statistics.netImpactVES)}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Motivo o Justificación del Ajuste
            </label>
            <textarea
              value={reconcileNotes}
              onChange={(e) => setReconcileNotes(e.target.value)}
              placeholder="Ej. Ajuste por conteo físico periódico autorizado por gerencia..."
              rows={3}
              className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowReconcileModal(false)}
              className="rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmReconcile}
              disabled={reconciling}
              className="rounded-lg flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {reconciling ? 'Aplicando...' : 'Confirmar y Ajustar Stock'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default InventoryCountView;
