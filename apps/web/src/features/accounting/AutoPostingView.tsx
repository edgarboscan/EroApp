import React, { useState, useEffect } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";

import {
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Play,
  Settings,
  ListFilter,
  Search,
  ArrowRight,
  FileCheck,
  ShieldCheck,
  Layers,
  DollarSign,
  TrendingUp,
  Receipt,
  ShoppingCart,
  CreditCard,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "../../stores/authStore";
import { formatMoneyVES, formatMoneyUSD, formatNumber } from "@ero/shared";

interface EngineSettings {
  id?: string;
  companyId?: string;
  autoPostingEnabled: boolean;
  defaultEntryStatus: "DRAFT" | "POSTED";
  postSales: boolean;
  postPurchases: boolean;
  postPayments: boolean;
  postNotes: boolean;
  postInventoryAdjustments: boolean;
  postTreasury: boolean;
}

interface EngineStats {
  totalPostedEntries: number;
  totalPostedVes: number;
  totalPostedUsd: number;
  pendingSalesInvoices: number;
  pendingPurchaseInvoices: number;
  pendingPayablePayments: number;
}

interface MappingItem {
  id?: string;
  mappingKey: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  description?: string;
}

interface AccountOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

export function AutoPostingView() {
  const { token, hasPermission } = useAuthStore();
  const canWrite = hasPermission("accounting", "write");
  const canPost = hasPermission("accounting", "post");

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [runningBatch, setRunningBatch] = useState(false);

  const [settings, setSettings] = useState<EngineSettings>({
    autoPostingEnabled: true,
    defaultEntryStatus: "POSTED",
    postSales: true,
    postPurchases: true,
    postPayments: true,
    postNotes: true,
    postInventoryAdjustments: true,
    postTreasury: true,
  });

  const [stats, setStats] = useState<EngineStats>({
    totalPostedEntries: 0,
    totalPostedVes: 0,
    totalPostedUsd: 0,
    pendingSalesInvoices: 0,
    pendingPurchaseInvoices: 0,
    pendingPayablePayments: 0,
  });

  const [mappings, setMappings] = useState<MappingItem[]>([]);
  const [allAccounts, setAllAccounts] = useState<AccountOption[]>([]);
  const [mappingSearch, setMappingSearch] = useState("");

  // Modal para editar mapeo
  const [selectedMapping, setSelectedMapping] = useState<MappingItem | null>(
    null,
  );
  const [newAccountId, setNewAccountId] = useState("");
  const [savingMapping, setSavingMapping] = useState(false);

  // Consola de batch posting
  const [batchType, setBatchType] = useState<string>("ALL");
  const [batchLimit, setBatchLimit] = useState<number>(50);
  const [batchLogs, setBatchLogs] = useState<string[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const [statusRes, mapRes, accRes] = await Promise.all([
        fetch("/api/accounting/auto-posting/status", { headers }),
        fetch("/api/accounting/auto-posting/mappings", { headers }),
        fetch("/api/accounting/accounts?activeOnly=true", { headers }),
      ]);

      if (statusRes.ok) {
        const json = await statusRes.json();
        if (json.success && json.data) {
          setSettings(json.data.settings);
          setStats(json.data.stats);
        }
      }

      if (mapRes.ok) {
        const json = await mapRes.json();
        if (json.success && json.data) {
          setMappings(json.data);
        }
      }

      if (accRes.ok) {
        const json = await accRes.json();
        if (json.success && json.data) {
          setAllAccounts(
            json.data.map((a: any) => ({
              id: a.id,
              code: a.code,
              name: a.name,
              accountType: a.accountType,
            })),
          );
        }
      }
    } catch (err: any) {
      toast.error(
        "Error cargando configuración del motor contable: " + err.message,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSetting = async (key: keyof EngineSettings, value: any) => {
    if (!canWrite) {
      toast.error("No tiene permisos para modificar la configuración contable");
      return;
    }

    const updated = { ...settings, [key]: value };
    setSettings(updated);
    setSavingSettings(true);

    try {
      const res = await fetch("/api/accounting/auto-posting/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updated),
      });

      if (res.ok) {
        toast.success("Configuración actualizada correctamente");
      } else {
        toast.error("Error al guardar configuración");
        loadAllData();
      }
    } catch (err: any) {
      toast.error("Error de conexión: " + err.message);
      loadAllData();
    } finally {
      setSavingSettings(false);
    }
  };

  const handleOpenEditMapping = (item: MappingItem) => {
    setSelectedMapping(item);
    setNewAccountId(item.accountId);
  };

  const handleSaveMapping = async () => {
    if (!selectedMapping || !newAccountId || !canWrite) return;
    setSavingMapping(true);

    try {
      const targetAcc = allAccounts.find((a) => a.id === newAccountId);
      const updatedList = mappings.map((m) =>
        m.mappingKey === selectedMapping.mappingKey
          ? {
              ...m,
              accountId: newAccountId,
              accountCode: targetAcc?.code,
              accountName: targetAcc?.name,
            }
          : m,
      );

      const res = await fetch("/api/accounting/auto-posting/mappings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mappings: [
            {
              mappingKey: selectedMapping.mappingKey,
              accountId: newAccountId,
              description: selectedMapping.description,
            },
          ],
        }),
      });

      if (res.ok) {
        setMappings(updatedList);
        setSelectedMapping(null);
        toast.success("Mapeo contable actualizado");
      } else {
        toast.error("Error guardando mapeo");
      }
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setSavingMapping(false);
    }
  };

  const handleRunBatch = async () => {
    if (!canPost) {
      toast.error("No tiene permisos para asentar comprobantes en lote");
      return;
    }

    setRunningBatch(true);
    setBatchLogs([]);

    try {
      const res = await fetch("/api/accounting/auto-posting/post-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          originType: batchType,
          limit: batchLimit,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const { processed, posted, errors, details } = json.data;
          setBatchLogs(details || []);
          toast.success(
            `Proceso finalizado: ${posted} asentados, ${errors} errores`,
          );
          loadAllData();
        }
      } else {
        toast.error("Fallo al ejecutar proceso por lote");
      }
    } catch (err: any) {
      toast.error("Error de conexión: " + err.message);
    } finally {
      setRunningBatch(false);
    }
  };

  const filteredMappings = mappings.filter(
    (m) =>
      m.mappingKey.toLowerCase().includes(mappingSearch.toLowerCase()) ||
      (m.description || "")
        .toLowerCase()
        .includes(mappingSearch.toLowerCase()) ||
      (m.accountCode || "")
        .toLowerCase()
        .includes(mappingSearch.toLowerCase()) ||
      (m.accountName || "").toLowerCase().includes(mappingSearch.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-gray-400" />
            <h1 className="text-2xl font-bold tracking-tight text-[#333333] dark:text-[#E0E0E0] flex items-center gap-2">
              Motor de Contabilización Automática
            </h1>
            <Badge
              variant={settings.autoPostingEnabled ? "success" : "neutral"}
              className="text-xs"
            >
              {settings.autoPostingEnabled
                ? "Activo en Tiempo Real"
                : "Pausado"}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Integración de ventas POS, facturación comercial, compras, CxP y
            tesorería con libros legales VEN-NIF.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllData}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Métricas y Estado */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="c">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
              Asientos Asentados
            </p>
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-[#007BFF] dark:text-[#3D91FF]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-[#333333] dark:text-[#E0E0E0] mt-1">
            {stats.totalPostedEntries.toLocaleString()}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
            <span>
              <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
                {formatMoneyVES(stats.totalPostedVes)}
              </p>
            </span>
            <span>
              {" "}
              <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
                •
              </p>
            </span>
            <span>
              {" "}
              <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
                {formatMoneyUSD(stats.totalPostedUsd)}
              </p>
            </span>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
              Ventas Pendientes
            </p>
            <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-900/30 text-[#28A745] dark:text-[#4ADE80]">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-[#333333] dark:text-[#E0E0E0] mt-1">
            {stats.pendingSalesInvoices.toLocaleString()}
          </h3>
          <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
            Facturas de venta y POS sin comprobante contable
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#FFC107] dark:border-l-[#FBBF24] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
              Compras Pendientes
            </p>
            <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-900/30 text-[#28A745] dark:text-[#4ADE80]">
              <Building2 className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-[#333333] dark:text-[#E0E0E0] mt-1">
            {stats.pendingPurchaseInvoices.toLocaleString()}
          </h3>
          <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
            Facturas de proveedores por asentar en el Diario
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#17A2B8] dark:border-l-[#38C9DD] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
              Pagos CxP Pendientes
            </p>
            <div className="p-2.5 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 text-[#17A2B8] dark:text-[#38C9DD]">
              <CreditCard className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-[#333333] dark:text-[#E0E0E0] mt-1">
            {stats.pendingPayablePayments.toLocaleString()}
          </h3>
          <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
            Comprobantes de pago y retenciones sin asiento
          </p>
        </Card>
      </div>

      {/* Panel de Configuración y Triggers por Módulo */}
      <Card className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-s">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Configuración de Disparadores Automáticos
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-300">
              Estado de Asientos Generados:
            </span>
            <select
              value={settings.defaultEntryStatus}
              onChange={(e) =>
                handleToggleSetting(
                  "defaultEntryStatus",
                  e.target.value as "DRAFT" | "POSTED",
                )
              }
              disabled={!canWrite || savingSettings}
              aria-label="Estado por defecto de asientos contables"
              className="w-full h-9 px-3 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="POSTED">
                Asentado Legal (POSTED - Directo al Mayor)
              </option>
              <option value="DRAFT">
                Borrador (DRAFT - Requiere Aprobación Contador)
              </option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm p-2  ">
          {/* Switch General */}
          <div className="rounded-lg border flex items-start justify-between transition-colors bg-white dark:bg-[#242526] border-blue-200 dark:border-blue-900/40 shadow-xs p-2">
            <div>
              <p className="font-medium text-gray-400">
                Motor de Contabilización
              </p>
              <p className="text-xs text-gray-300 mt-0.5">
                Generación continua de asientos al procesar documentos
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoPostingEnabled}
              onChange={(e) =>
                handleToggleSetting("autoPostingEnabled", e.target.checked)
              }
              disabled={!canWrite || savingSettings}
              aria-label="Habilitar motor de contabilización general"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-950"
            />
          </div>

          {/* Ventas & POS */}
          <div className="rounded-lg border flex items-start justify-between transition-colors bg-white dark:bg-[#242526] border-blue-200 dark:border-blue-900/40 shadow-xs p-2">
            <div>
              <p className="font-medium text-gray-400">
                Ventas y Costo de Ventas
              </p>
              <p className="text-xs text-gray-300 mt-0.5">
                Asientos de ingresos, IVA débito y salida al costo en Kardex
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.postSales}
              onChange={(e) =>
                handleToggleSetting("postSales", e.target.checked)
              }
              disabled={!canWrite || savingSettings}
              aria-label="Contabilizar ventas y costo de mercancía vendida"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-950"
            />
          </div>

          {/* Compras Proveedores */}
          <div className="rounded-lg border flex items-start justify-between transition-colors bg-white dark:bg-[#242526] border-blue-200 dark:border-blue-900/40 shadow-xs p-2">
            <div>
              <p className="font-medium text-gray-400">
                Facturación de Compras
              </p>
              <p className="text-xs text-gray-300 mt-0.5">
                Inventario entrante, IVA crédito fiscal y cuentas por pagar
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.postPurchases}
              onChange={(e) =>
                handleToggleSetting("postPurchases", e.target.checked)
              }
              disabled={!canWrite || savingSettings}
              aria-label="Contabilizar compras a proveedores"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-950"
            />
          </div>

          {/* Pagos CxP */}
          <div className="rounded-lg border flex items-start justify-between transition-colors bg-white dark:bg-[#242526] border-blue-200 dark:border-blue-900/40 shadow-xs p-2">
            <div>
              <p className="font-medium text-gray-400">
                Pagos a Proveedores (CxP)
              </p>
              <p className="text-xs text-gray-300 mt-0.5">
                Descarga de pasivo, salida de tesorería y retenciones fiscales
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.postPayments}
              onChange={(e) =>
                handleToggleSetting("postPayments", e.target.checked)
              }
              disabled={!canWrite || savingSettings}
              aria-label="Contabilizar pagos a proveedores"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-950"
            />
          </div>

          {/* Notas de Crédito / Débito */}
          <div className="rounded-lg border flex items-start justify-between transition-colors bg-white dark:bg-[#242526] border-blue-200 dark:border-blue-900/40 shadow-xs p-2">
            <div>
              <p className="font-medium text-gray-400">
                Notas de Crédito y Débito
              </p>
              <p className="text-xs text-gray-300 mt-0.5">
                Devoluciones en ventas, reversión de débitos y reingreso a stock
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.postNotes}
              onChange={(e) =>
                handleToggleSetting("postNotes", e.target.checked)
              }
              disabled={!canWrite || savingSettings}
              aria-label="Contabilizar notas de crédito y débito"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-950"
            />
          </div>

          {/* Depósitos de Turno Caja */}
          <div className="rounded-lg border flex items-start justify-between transition-colors bg-white dark:bg-[#242526] border-blue-200 dark:border-blue-900/40 shadow-xs p-2">
            <div>
              <p className="font-medium text-gray-400">
                Depósitos Bancarios de Caja
              </p>
              <p className="text-xs text-gray-300 mt-0.5">
                Traspaso contable de Caja Mostrador a Cuenta Bancaria destino
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.postTreasury}
              onChange={(e) =>
                handleToggleSetting("postTreasury", e.target.checked)
              }
              disabled={!canWrite || savingSettings}
              aria-label="Contabilizar depósitos bancarios de caja"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-950"
            />
          </div>
        </div>
      </Card>

      {/* Panel de Contabilización en Lote (Batch Posting) */}
      <Card className="p-5 border border-gray-200 rounded-lg space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Contabilización Masiva de Documentos Pendientes
              </h2>
            </div>
            <p className="w-fit text-xs text-gray-500 mt-0.5">
              Escanea y genera asientos contables para operaciones históricas
              que no tengan registro en el Libro Diario.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={batchType}
              onChange={(e) => setBatchType(e.target.value)}
              aria-label="Tipo de documento a contabilizar masivamente"
              className=" h-9 px-3 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">Todos los Documentos</option>
              <option value="SALE_INVOICE">Solo Facturas de Venta</option>
              <option value="PURCHASE_INVOICE">Solo Facturas de Compra</option>
              <option value="AP_PAYMENT">Solo Pagos de Proveedores</option>
            </select>

            <select
              value={batchLimit}
              onChange={(e) => setBatchLimit(Number(e.target.value))}
              aria-label="Límite de documentos por lote"
              className="h-9 px-3 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value={25}>25 docs</option>
              <option value={50}>50 docs</option>
              <option value={100}>100 docs</option>
              <option value={250}>250 docs</option>
            </select>

            <Button
              size="sm"
              onClick={handleRunBatch}
              disabled={runningBatch || !canPost}
              className="flex items-center gap-1.5 bg-gray-900 text-white hover:bg-gray-800"
            >
              <Play
                className={`w-3.5 h-3.5 ${runningBatch ? "animate-spin" : ""}`}
              />
              {runningBatch ? "Contabilizando..." : "Asientos en Lote"}
            </Button>
          </div>
        </div>

        {batchLogs.length > 0 && (
          <div className="mt-3 p-3 bg-gray-900 text-gray-100 rounded-lg text-xs font-mono max-h-40 overflow-y-auto space-y-1">
            <div className="text-gray-400 font-semibold border-b border-gray-800 pb-1">
              Registro de Ejecución del Motor:
            </div>
            {batchLogs.map((log, idx) => (
              <div key={idx} className="leading-relaxed">
                {log}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Matriz de Mapeo Contable */}
      <Card className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Matriz de Mapeo de Cuentas Contables (VEN-NIF)
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Define a qué cuenta del catálogo se imputa cada rubro operativo
              del ERP.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
            <Input
              placeholder="Buscar regla o cuenta..."
              value={mappingSearch}
              onChange={(e) => setMappingSearch(e.target.value)}
              className="pl-8 text-xs py-1.5"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#F4F6F9] dark:bg-[#18191A] text-xs uppercase font-semibold text-gray-600 dark:text-gray-400 sticky top-0 border-b border-gray-200 dark:border-gray-800">
                <th className="py-2.5 px-4">Clave Operativa</th>
                <th className="py-2.5 px-4">Descripción del Flujo</th>
                <th className="py-2.5 px-4">Código Cuenta</th>
                <th className="py-2.5 px-4">Nombre de la Cuenta Imputada</th>
                <th className="py-2.5 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-[#242526]">
              {filteredMappings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    No se encontraron mapeos que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredMappings.map((m) => (
                  <tr
                    key={m.mappingKey}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono font-medium text-gray-200">
                      {m.mappingKey}
                    </td>
                    <td className="py-2.5 px-4 text-gray-200">
                      {m.description || "Sin descripción"}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-gray-200">
                      {m.accountCode || "No asignado"}
                    </td>
                    <td className="py-2.5 px-4 text-gray-200 font-medium">
                      {m.accountName || "Cuenta no encontrada"}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditMapping(m)}
                        disabled={!canWrite}
                        className="text-xs py-1 px-2.5 h-auto"
                      >
                        Cambiar Cuenta
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal para Editar Mapeo */}
      {selectedMapping && (
        <Modal
          isOpen={Boolean(selectedMapping)}
          onClose={() => setSelectedMapping(null)}
          title={`Configurar Cuenta: ${selectedMapping.mappingKey}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-300">
              {selectedMapping.description}
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-200">
                Seleccionar Cuenta del Catálogo VEN-NIF:
              </label>
              <select
                value={newAccountId}
                onChange={(e) => setNewAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#242526] text-[#333333] dark:text-[#E0E0E0] rounded-lg text-sm"
              >
                <option value="">Seleccione una cuenta contable...</option>
                {allAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} - {acc.name} ({acc.accountType})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedMapping(null)}
                disabled={savingMapping}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSaveMapping}
                disabled={savingMapping || !newAccountId}
                className="bg-gray-900 text-white hover:bg-gray-800"
              >
                {savingMapping ? "Guardando..." : "Asignar Cuenta"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
