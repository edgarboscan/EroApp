import React, { useState, useEffect, useMemo } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PdfViewerModal } from "../../components/ui/PdfViewerModal";
import {
  BookOpen,
  Search,
  Plus,
  Layers,
  DollarSign,
  TrendingUp,
  FolderTree,
  Filter,
  Eye,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ShieldAlert,
  FileText,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "../../stores/authStore";
import { formatMoneyVES, formatMoneyUSD } from "@ero/shared";
import { useNavigate } from "react-router-dom";
import { downloadAccountingFile } from "./accountingExportHelper";

interface AccountItem {
  id: string;
  code: string;
  name: string;
  level: number;
  parentId: string | null;
  parentCode: string | null;
  parentName: string | null;
  accountType:
    | "ASSET"
    | "LIABILITY"
    | "EQUITY"
    | "REVENUE"
    | "COST"
    | "EXPENSE"
    | "ORDER";
  classification:
    | "CURRENT"
    | "NON_CURRENT"
    | "OPERATING"
    | "FINANCIAL"
    | "OTHER";
  normalBalance: "DEBIT" | "CREDIT";
  acceptsPostings: boolean;
  isMonetary: boolean;
  isBankOrCash: boolean;
  isActive: boolean;
  notes: string | null;
  balanceVes: number;
  balanceUsd: number;
}

export const ChartOfAccountsView: React.FC = () => {
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [levelFilter, setLevelFilter] = useState<string>("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountItem | null>(
    null,
  );
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    level: 4,
    parentId: "",
    accountType: "ASSET" as AccountItem["accountType"],
    classification: "CURRENT" as AccountItem["classification"],
    normalBalance: "DEBIT" as AccountItem["normalBalance"],
    acceptsPostings: true,
    isMonetary: true,
    isBankOrCash: false,
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounting/accounts", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setAccounts(json.data);
        }
      } else {
        toast.error("Error al cargar catálogo de cuentas");
      }
    } catch {
      toast.error("Error de conexión al cargar cuentas");
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchesSearch =
        acc.code.toLowerCase().includes(search.toLowerCase()) ||
        acc.name.toLowerCase().includes(search.toLowerCase());
      const matchesType =
        typeFilter === "ALL" || acc.accountType === typeFilter;
      const matchesLevel =
        levelFilter === "ALL" || acc.level === parseInt(levelFilter, 10);
      return matchesSearch && matchesType && matchesLevel;
    });
  }, [accounts, search, typeFilter, levelFilter]);

  // KPIs
  const totalAccounts = accounts.length;
  const assetAccounts = accounts.filter(
    (a) => a.accountType === "ASSET",
  ).length;
  const liabilityEquity = accounts.filter(
    (a) => a.accountType === "LIABILITY" || a.accountType === "EQUITY",
  ).length;
  const postingAccounts = accounts.filter((a) => a.acceptsPostings).length;

  const handleOpenNewModal = (parent?: AccountItem) => {
    setEditingAccount(null);
    setFormData({
      code: parent ? `${parent.code}.` : "",
      name: "",
      level: parent ? Math.min(parent.level + 1, 5) : 1,
      parentId: parent ? parent.id : "",
      accountType: parent ? parent.accountType : "ASSET",
      classification: parent ? parent.classification : "CURRENT",
      normalBalance: parent ? parent.normalBalance : "DEBIT",
      acceptsPostings: true,
      isMonetary: true,
      isBankOrCash: false,
      notes: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (acc: AccountItem) => {
    setEditingAccount(acc);
    setFormData({
      code: acc.code,
      name: acc.name,
      level: acc.level,
      parentId: acc.parentId || "",
      accountType: acc.accountType,
      classification: acc.classification,
      normalBalance: acc.normalBalance,
      acceptsPostings: acc.acceptsPostings,
      isMonetary: acc.isMonetary,
      isBankOrCash: acc.isBankOrCash,
      notes: acc.notes || "",
    });
    setIsModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("El código y el nombre son obligatorios");
      return;
    }
    setIsSaving(true);
    try {
      const url = editingAccount
        ? `/api/accounting/accounts/${editingAccount.id}`
        : "/api/accounting/accounts";
      const method = editingAccount ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...formData,
          parentId: formData.parentId || null,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          editingAccount
            ? "Cuenta actualizada correctamente"
            : "Cuenta contable creada",
        );
        setIsModalOpen(false);
        fetchAccounts();
      } else {
        toast.error(json.error?.message || "Error al guardar la cuenta");
      }
    } catch {
      toast.error("Error de red al guardar la cuenta");
    } finally {
      setIsSaving(false);
    }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case "ASSET":
        return "Activo";
      case "LIABILITY":
        return "Pasivo";
      case "EQUITY":
        return "Patrimonio";
      case "REVENUE":
        return "Ingreso";
      case "COST":
        return "Costo";
      case "EXPENSE":
        return "Gasto";
      case "ORDER":
        return "Orden";
      default:
        return type;
    }
  };

  const handleExport = async (format: "xlsx" | "csv") => {
    setExporting(format);
    const query = new URLSearchParams();
    query.set("format", format);
    if (search) query.set("search", search);
    if (typeFilter !== "ALL") query.set("type", typeFilter);
    if (levelFilter !== "ALL") query.set("level", levelFilter);
    const ext = format === "xlsx" ? "xlsx" : "csv";
    await downloadAccountingFile(
      `/api/accounting/accounts?${query.toString()}`,
      `catalogo_de_cuentas.${ext}`,
      token,
    );
    setExporting(null);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#333333] dark:text-[#E0E0E0] flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#007BFF] dark:text-[#3D91FF]" />
            Catálogo de Cuentas (VEN-NIF / NIIF)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Estructura jerárquica oficial, asociación a rubros financieros y
            control de saldos multimoneda
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setPdfModalOpen(true)}
            className="flex items-center gap-2 border-gray-300 dark:border-gray-700 rounded-lg hover:border-[#007BFF] dark:hover:border-[#3D91FF]"
            title="Ver catálogo oficial en formato PDF"
          >
            <FileText className="w-4 h-4 text-[#007BFF] dark:text-[#3D91FF]" />
            PDF
          </Button>

          <Button
            variant="outline"
            disabled={exporting !== null}
            onClick={() => handleExport("xlsx")}
            className="flex items-center gap-2 border-gray-300 dark:border-gray-700 rounded-lg hover:border-[#28A745] dark:hover:border-[#4ADE80]"
            title="Exportar a Microsoft Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#28A745] dark:text-[#4ADE80]" />
            {exporting === "xlsx" ? "Generando..." : "Excel"}
          </Button>

          <Button
            variant="outline"
            disabled={exporting !== null}
            onClick={() => handleExport("csv")}
            className="flex items-center gap-2 border-gray-300 dark:border-gray-700 rounded-lg"
            title="Exportar archivo CSV con codificación UTF-8"
          >
            <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            {exporting === "csv" ? "Generando..." : "CSV"}
          </Button>

          <Button
            variant="outline"
            onClick={() => handleOpenNewModal()}
            className="flex items-center gap-2 border-[#007BFF] dark:border-[#3D91FF] rounded-lg bg-blue-50 dark:bg-blue-600/30 hover:bg-border-blue-600 dark:hover:border-blue-500"
            title="Nueva Cuenta Contable"
          >
            <Plus className="w-4 h-4 text-blue-600 dark:blue-500" />
            Cuenta
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
                Total Cuentas
              </p>
              <h3 className="text-2xl font-bold text-[#333333] dark:text-[#E0E0E0] mt-1">
                {totalAccounts}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-[#007BFF] dark:text-[#3D91FF]">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
                Cuentas de Activo
              </p>
              <h3 className="text-2xl font-bold text-[#333333] dark:text-[#E0E0E0] mt-1">
                {assetAccounts}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-900/30 text-[#28A745] dark:text-[#4ADE80]">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#FFC107] dark:border-l-[#FBBF24] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
                Pasivo y Patrimonio
              </p>
              <h3 className="text-2xl font-bold text-[#333333] dark:text-[#E0E0E0] mt-1">
                {liabilityEquity}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-[#FFC107] dark:text-[#FBBF24]">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#17A2B8] dark:border-l-[#38C9DD] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
                Cuentas con Detalle
              </p>
              <h3 className="text-2xl font-bold text-[#333333] dark:text-[#E0E0E0] mt-1">
                {postingAccounts}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 text-[#17A2B8] dark:text-[#38C9DD]">
              <FolderTree className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <Card className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por código o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-lg"
            />
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#242526] text-[#333333] dark:text-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007BFF] dark:focus:ring-[#3D91FF] text-sm"
            >
              <option value="ALL">Todos los Tipos de Cuenta</option>
              <option value="ASSET">1 - Activo</option>
              <option value="LIABILITY">2 - Pasivo</option>
              <option value="EQUITY">3 - Patrimonio</option>
              <option value="REVENUE">4 - Ingresos</option>
              <option value="COST">5 - Costos</option>
              <option value="EXPENSE">6 - Gastos Operacionales</option>
              <option value="ORDER">8 - Cuentas de Orden</option>
            </select>
          </div>

          <div>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#242526] text-[#333333] dark:text-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007BFF] dark:focus:ring-[#3D91FF] text-sm"
            >
              <option value="ALL">Todos los Niveles Jerárquicos</option>
              <option value="1">Nivel 1 - Grupo</option>
              <option value="2">Nivel 2 - Subgrupo</option>
              <option value="3">Nivel 3 - Rubro</option>
              <option value="4">Nivel 4 - Cuenta Detalle</option>
            </select>
          </div>

          <div className="flex items-center justify-end">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Mostrando {filteredAccounts.length} de {accounts.length} cuentas
            </span>
          </div>
        </div>
      </Card>

      {/* Tabla del Catálogo Contable */}
      <Card className="rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-[#F4F6F9] dark:bg-[#18191A] text-xs uppercase font-semibold text-gray-600 dark:text-gray-400 sticky top-0 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="py-3 px-4">Código Contable</th>
                <th className="py-3 px-4">Descripción / Nombre</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4 text-center">Naturaleza</th>
                <th className="py-3 px-4 text-center">Movimientos</th>
                <th className="py-3 px-4 text-center">VEN-NIF</th>
                <th className="py-3 px-4 text-right">Saldo Actual (VES)</th>
                <th className="py-3 px-4 text-right">Saldo (USD)</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-[#242526]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">
                    Cargando plan de cuentas oficial...
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">
                    No se encontraron cuentas contables que coincidan con la
                    búsqueda.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => {
                  const isTitleLevel = acc.level <= 2;
                  const paddingLeft = (acc.level - 1) * 1.5;

                  return (
                    <tr
                      key={acc.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                        isTitleLevel
                          ? "bg-gray-50/50 dark:bg-gray-800/20 font-semibold"
                          : ""
                      }`}
                    >
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          style={{ marginLeft: `${paddingLeft}rem` }}
                          className={`font-mono text-xs inline-block px-1.5 py-0.5 rounded ${
                            acc.acceptsPostings
                              ? "bg-blue-50 dark:bg-blue-900/30 text-[#007BFF] dark:text-[#3D91FF] font-medium"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {acc.code}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-[#333333] dark:text-[#E0E0E0]">
                        <span
                          className={
                            isTitleLevel
                              ? "font-bold uppercase tracking-wide"
                              : "font-normal"
                          }
                        >
                          {acc.name}
                        </span>
                      </td>

                      <td className="py-2.5 px-4">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {getAccountTypeLabel(acc.accountType)}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            acc.normalBalance === "DEBIT"
                              ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                              : "bg-emerald-50 dark:bg-emerald-900/30 text-[#28A745] dark:text-[#4ADE80]"
                          }`}
                        >
                          {acc.normalBalance === "DEBIT"
                            ? "Deudor"
                            : "Acreedor"}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        {acc.acceptsPostings ? (
                          <Badge variant="success" className="text-xs">
                            Detalle
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">Grupo</span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            acc.isMonetary
                              ? "text-gray-500 dark:text-gray-400"
                              : "bg-amber-50 dark:bg-amber-900/30 text-[#FFC107] dark:text-[#FBBF24] font-medium"
                          }`}
                          title={
                            acc.isMonetary
                              ? "Monetaria (Genera REI)"
                              : "No Monetaria (Se reexpresa por INPC)"
                          }
                        >
                          {acc.isMonetary ? "Monetaria" : "No Monet."}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono text-xs text-[#333333] dark:text-[#E0E0E0]">
                        {acc.acceptsPostings || acc.balanceVes !== 0
                          ? `${formatMoneyVES(acc.balanceVes)}`
                          : "-"}
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono text-xs text-gray-500 dark:text-gray-400">
                        {acc.acceptsPostings || acc.balanceUsd !== 0
                          ? `{formatMoneyUSD(acc.balanceUsd)}`
                          : "-"}
                      </td>

                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {acc.acceptsPostings && (
                            <button
                              onClick={() =>
                                navigate(
                                  `/accounting/ledger?accountId=${acc.id}`,
                                )
                              }
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 hover:text-[#007BFF] transition-colors"
                              title="Ver movimientos en Libro Mayor"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenNewModal(acc)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 hover:text-green-600 transition-colors"
                            title="Agregar subcuenta hija"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(acc)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 hover:text-blue-600 transition-colors"
                            title="Modificar cuenta"
                          >
                            <Edit2 className="w-4 h-4" />
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
      </Card>

      {/* Modal Crear / Editar Cuenta */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingAccount
            ? `Editar Cuenta Contable: ${editingAccount.code}`
            : "Nueva Cuenta en el Plan Contable"
        }
      >
        <form onSubmit={handleSaveAccount} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Código Contable <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                placeholder="Ej. 1.1.01.01.001"
                required
                className="font-mono text-sm rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Nivel Jerárquico <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.level}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    level: parseInt(e.target.value, 10),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#242526] text-[#333333] dark:text-[#E0E0E0] rounded-lg text-sm"
              >
                <option value={1}>1 - Grupo Principal</option>
                <option value={2}>2 - Subgrupo</option>
                <option value={3}>3 - Rubro</option>
                <option value={4}>4 - Cuenta de Mayor</option>
                <option value={5}>5 - Subcuenta de Detalle</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Nombre o Título de la Cuenta{" "}
              <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Ej. Banco Mercantil Cuenta Corriente"
              required
              className="text-sm rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Tipo de Cuenta
              </label>
              <select
                value={formData.accountType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    accountType: e.target.value as any,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#242526] text-[#333333] dark:text-[#E0E0E0] rounded-lg text-sm"
              >
                <option value="ASSET">1 - Activo</option>
                <option value="LIABILITY">2 - Pasivo</option>
                <option value="EQUITY">3 - Patrimonio</option>
                <option value="REVENUE">4 - Ingreso</option>
                <option value="COST">5 - Costo</option>
                <option value="EXPENSE">6 - Gasto Operacional</option>
                <option value="ORDER">8 - Cuenta de Orden</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Clasificación NIIF
              </label>
              <select
                value={formData.classification}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    classification: e.target.value as any,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#242526] text-[#333333] dark:text-[#E0E0E0] rounded-lg text-sm"
              >
                <option value="CURRENT">Corriente / Corto Plazo</option>
                <option value="NON_CURRENT">No Corriente / Largo Plazo</option>
                <option value="OPERATING">Operacional</option>
                <option value="FINANCIAL">Financiero</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Naturaleza de Saldo
              </label>
              <select
                value={formData.normalBalance}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    normalBalance: e.target.value as any,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#242526] text-[#333333] dark:text-[#E0E0E0] rounded-lg text-sm"
              >
                <option value="DEBIT">Deudora (Débito)</option>
                <option value="CREDIT">Acreedora (Crédito)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.acceptsPostings}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    acceptsPostings: e.target.checked,
                  })
                }
                className="rounded border-gray-300 text-[#007BFF] focus:ring-[#007BFF]"
              />
              <span>
                Acepta Movimientos Directos (Cuenta de Detalle / Imputable)
              </span>
            </label>

            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isMonetary}
                onChange={(e) =>
                  setFormData({ ...formData, isMonetary: e.target.checked })
                }
                className="rounded border-gray-300 text-[#007BFF] focus:ring-[#007BFF]"
              />
              <span>
                Partida Monetaria (VEN-NIF B-10: Genera REI, no se reexpresa)
              </span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Notas Explicativas o Reglas Contables
            </label>
            <Input
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Instrucciones para la imputación de esta cuenta..."
              className="text-sm rounded-lg"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-[#007BFF] hover:bg-blue-600 text-white rounded-lg"
            >
              {isSaving
                ? "Guardando..."
                : editingAccount
                  ? "Actualizar Cuenta"
                  : "Crear Cuenta"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Visor PDF Oficial */}
      <PdfViewerModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title="Catálogo Oficial de Cuentas Contables"
        subtitle="Plan de Cuentas Jerárquico bajo principios VEN-NIF / NIIF"
        endpoint={`/api/accounting/accounts?format=pdf${search ? `&search=${encodeURIComponent(search)}` : ""}${typeFilter !== "ALL" ? `&type=${typeFilter}` : ""}`}
        filename="catalogo_de_cuentas_oficial.pdf"
      />
    </div>
  );
};
export default ChartOfAccountsView;
