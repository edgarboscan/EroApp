import React, { useState, useEffect, useMemo } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PdfViewerModal } from "../../components/ui/PdfViewerModal";
import {
  FileText,
  Search,
  Plus,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Eye,
  Trash2,
  Layers,
  ArrowRightLeft,
  DollarSign,
  Ban,
  FileCheck,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "../../stores/authStore";
import { useExchangeRateStore } from "../../stores/exchangeRateStore";
import { formatMoneyVES, formatMoneyUSD } from "@ero/shared";
import { downloadAccountingFile } from "./accountingExportHelper";

interface JournalEntrySummary {
  id: string;
  companyId: string;
  branchId: string | null;
  branchName: string | null;
  periodId: string | null;
  entryNumber: string;
  entryDate: string;
  entryType:
    | "STANDARD"
    | "OPENING"
    | "ADJUSTMENT"
    | "EXCHANGE_DIFF"
    | "INFLATION_ADJUSTMENT"
    | "CLOSING";
  concept: string;
  notes: string | null;
  currency: "VES" | "USD";
  exchangeRate: number;
  totalDebitVes: number;
  totalCreditVes: number;
  totalDebitUsd: number;
  totalCreditUsd: number;
  status: "DRAFT" | "POSTED" | "ANNULLED";
  createdByName: string;
  postedByName: string | null;
  postedAt: string | null;
  lineCount: number;
  createdAt: string;
}

interface AccountOption {
  id: string;
  code: string;
  name: string;
  normalBalance: "DEBIT" | "CREDIT";
}

interface NewEntryLine {
  id: string;
  accountId: string;
  description: string;
  debitVes: number;
  creditVes: number;
  referenceDoc: string;
}

export const JournalEntriesView: React.FC = () => {
  const token = useAuthStore((s) => s.token);
  const currentBcvRate = useExchangeRateStore((s) => s.rate);

  const [entries, setEntries] = useState<JournalEntrySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [startDate, setStartDate] = useState(
    `${new Date().getFullYear()}-01-01`,
  );
  const [endDate, setEndDate] = useState(`${new Date().getFullYear()}-12-31`);

  // Catálogo de cuentas para selector
  const [postingAccounts, setPostingAccounts] = useState<AccountOption[]>([]);

  // Modal Ver Detalle
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Visor PDF y Exportaciones
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [viewerPdfUrl, setViewerPdfUrl] = useState<string | null>(null);
  const [viewerPdfTitle, setViewerPdfTitle] = useState(
    "Reporte Oficial del Libro Diario",
  );
  const [viewerPdfSubtitle, setViewerPdfSubtitle] = useState(
    "Registros Cronológicos según Código de Comercio",
  );
  const [exporting, setExporting] = useState<string | null>(null);

  // Modal Nuevo Comprobante
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [concept, setConcept] = useState("");
  const [entryType, setEntryType] =
    useState<JournalEntrySummary["entryType"]>("STANDARD");
  const [currency, setCurrency] = useState<"VES" | "USD">("VES");
  const [exchangeRate, setExchangeRate] = useState<number>(
    currentBcvRate || 75.5,
  );
  const [lines, setLines] = useState<NewEntryLine[]>([
    {
      id: "1",
      accountId: "",
      description: "",
      debitVes: 0,
      creditVes: 0,
      referenceDoc: "",
    },
    {
      id: "2",
      accountId: "",
      description: "",
      debitVes: 0,
      creditVes: 0,
      referenceDoc: "",
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEntries();
    fetchPostingAccounts();
  }, [startDate, endDate]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(
        `/api/accounting/journal-entries?${params.toString()}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setEntries(json.data);
        }
      }
    } catch {
      toast.error("Error al cargar comprobantes de diario");
    } finally {
      setLoading(false);
    }
  };

  const fetchPostingAccounts = async () => {
    try {
      const res = await fetch("/api/accounting/accounts?activeOnly=true", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const detailOnly = json.data
            .filter((a: any) => a.acceptsPostings)
            .map((a: any) => ({
              id: a.id,
              code: a.code,
              name: a.name,
              normalBalance: a.normalBalance,
            }));
          setPostingAccounts(detailOnly);
        }
      }
    } catch {
      // Ignorar fallas silenciosas
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const matchesSearch =
        e.entryNumber.toLowerCase().includes(search.toLowerCase()) ||
        e.concept.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || e.status === statusFilter;
      const matchesType = typeFilter === "ALL" || e.entryType === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [entries, search, statusFilter, typeFilter]);

  // Cálculos de Partida Doble en Modal de Creación
  const totalDebit = lines.reduce(
    (sum, l) => sum + (Number(l.debitVes) || 0),
    0,
  );
  const totalCredit = lines.reduce(
    (sum, l) => sum + (Number(l.creditVes) || 0),
    0,
  );
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference < 0.05 && totalDebit > 0;

  // KPIs
  const totalComprobantes = entries.length;
  const postedCount = entries.filter((e) => e.status === "POSTED").length;
  const draftCount = entries.filter((e) => e.status === "DRAFT").length;
  const totalDebitsVes = entries
    .filter((e) => e.status === "POSTED")
    .reduce((s, e) => s + e.totalDebitVes, 0);

  const handleOpenDetail = async (id: string) => {
    setIsDetailModalOpen(true);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/accounting/journal-entries/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSelectedEntry(json.data);
        }
      }
    } catch {
      toast.error("Error al cargar detalle del comprobante");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handlePostEntry = async (id: string) => {
    try {
      const res = await fetch(`/api/accounting/journal-entries/${id}/post`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Comprobante asentado legalmente en el Libro Diario");
        fetchEntries();
        if (selectedEntry?.id === id) {
          handleOpenDetail(id);
        }
      } else {
        toast.error(json.error?.message || "Error al asentar comprobante");
      }
    } catch {
      toast.error("Error de conexión al asentar");
    }
  };

  const handleAnnulEntry = async (id: string) => {
    const reason = prompt(
      "Ingrese el motivo de anulación legal del comprobante:",
    );
    if (!reason) return;

    try {
      const res = await fetch(`/api/accounting/journal-entries/${id}/annul`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          "Comprobante anulado según normas del Código de Comercio",
        );
        fetchEntries();
        if (selectedEntry?.id === id) {
          setIsDetailModalOpen(false);
        }
      } else {
        toast.error(json.error?.message || "Error al anular comprobante");
      }
    } catch {
      toast.error("Error de conexión al anular");
    }
  };

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        id: Math.random().toString(),
        accountId: "",
        description: concept || "",
        debitVes: 0,
        creditVes: 0,
        referenceDoc: "",
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) {
      toast.warning("Un comprobante contable debe tener al menos dos líneas");
      return;
    }
    const updated = [...lines];
    updated.splice(index, 1);
    setLines(updated);
  };

  const handleLineChange = (
    index: number,
    field: keyof NewEntryLine,
    value: any,
  ) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const handleSaveJournalEntry = async (shouldPost: boolean) => {
    if (!concept.trim()) {
      toast.error("El concepto del comprobante es obligatorio");
      return;
    }

    if (!isBalanced) {
      toast.error(
        `Partida Doble Descuadrada: Diferencia de Bs. ${difference.toFixed(2)}`,
      );
      return;
    }

    // Validar cuentas
    for (const l of lines) {
      if (!l.accountId) {
        toast.error(
          "Todas las líneas deben tener una cuenta contable asignada",
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const rate = exchangeRate > 0 ? exchangeRate : 1;
      const formattedLines = lines.map((l) => ({
        accountId: l.accountId,
        description: l.description || concept,
        debitVes: Number(l.debitVes) || 0,
        creditVes: Number(l.creditVes) || 0,
        debitUsd: Number(((Number(l.debitVes) || 0) / rate).toFixed(2)),
        creditUsd: Number(((Number(l.creditVes) || 0) / rate).toFixed(2)),
        referenceDoc: l.referenceDoc || null,
      }));

      const res = await fetch("/api/accounting/journal-entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          entryDate,
          entryType,
          concept,
          currency,
          exchangeRate: rate,
          lines: formattedLines,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const createdId = json.data.id;
        toast.success(
          `Comprobante ${json.data.entryNumber} registrado en borrador`,
        );

        if (shouldPost) {
          await handlePostEntry(createdId);
        }

        setIsNewModalOpen(false);
        fetchEntries();
        // Reset form
        setConcept("");
        setLines([
          {
            id: "1",
            accountId: "",
            description: "",
            debitVes: 0,
            creditVes: 0,
            referenceDoc: "",
          },
          {
            id: "2",
            accountId: "",
            description: "",
            debitVes: 0,
            creditVes: 0,
            referenceDoc: "",
          },
        ]);
      } else {
        toast.error(json.error?.message || "Error al crear comprobante");
      }
    } catch {
      toast.error("Error de red al guardar el asiento contable");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "POSTED":
        return <Badge variant="success">Asentado Legal</Badge>;
      case "DRAFT":
        return <Badge variant="warning">Borrador</Badge>;
      case "ANNULLED":
        return <Badge variant="danger">Anulado</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "STANDARD":
        return "Operación Estándar";
      case "OPENING":
        return "Apertura de Ejercicio";
      case "ADJUSTMENT":
        return "Ajuste / Regularización";
      case "EXCHANGE_DIFF":
        return "Fluctuación Cambiaria";
      case "INFLATION_ADJUSTMENT":
        return "Ajuste Inflación (REI)";
      case "CLOSING":
        return "Cierre de Ejercicio";
      default:
        return type;
    }
  };

  const handleExport = async (format: "xlsx" | "csv") => {
    setExporting(format);
    const query = new URLSearchParams();
    query.set("format", format);
    if (startDate) query.set("startDate", startDate);
    if (endDate) query.set("endDate", endDate);
    if (statusFilter !== "ALL") query.set("status", statusFilter);
    if (typeFilter !== "ALL") query.set("type", typeFilter);
    if (search) query.set("search", search);

    const ext = format === "xlsx" ? "xlsx" : "csv";
    await downloadAccountingFile(
      `/api/accounting/journal-entries?${query.toString()}`,
      `libro_diario_legal_${startDate || "inicio"}_${endDate || "fin"}.${ext}`,
      token,
    );
    setExporting(null);
  };

  const handleOpenGeneralJournalPdf = () => {
    const query = new URLSearchParams();
    query.set("format", "pdf");
    if (startDate) query.set("startDate", startDate);
    if (endDate) query.set("endDate", endDate);
    if (statusFilter !== "ALL") query.set("status", statusFilter);
    if (typeFilter !== "ALL") query.set("type", typeFilter);
    if (search) query.set("search", search);

    setViewerPdfUrl(`/api/accounting/journal-entries?${query.toString()}`);
    setViewerPdfTitle("Libro Diario Legal Oficial");
    setViewerPdfSubtitle(
      `Registro Cronológico Oficial (${startDate || "Inicio"} al ${endDate || "Fin"}) - Código de Comercio`,
    );
    setPdfModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#333333] dark:text-[#E0E0E0] flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#007BFF] dark:text-[#3D91FF]" />
            Libro Diario Legal (Código de Comercio)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Registro cronológico inalterable de operaciones con validación de
            partida doble y soporte multimoneda
          </p>
        </div>

        <div className="flex  items-center gap-2.5">
          <Button
            variant="outline"
            onClick={handleOpenGeneralJournalPdf}
            className="flex items-center gap-2 border-gray-300 dark:border-gray-700 rounded-lg hover:border-[#007BFF] dark:hover:border-[#3D91FF]"
            title="Ver Libro Diario Legal en formato oficial PDF"
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
            className="flex items-center gap-2 border-gray-300 dark:border-gray-700 rounded-lg hover:border-700 dark:hover:border-gray-300"
            title="Exportar archivo CSV con codificación UTF-8"
          >
            <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            {exporting === "csv" ? "Generando..." : "CSV"}
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setExchangeRate(currentBcvRate || 75.5);
              setIsNewModalOpen(true);
            }}
            className="flex items-center gap-2 border-[#007BFF] dark:border-[#3D91FF] rounded-lg bg-blue-50 dark:bg-blue-600/30 hover:bg-border-blue-600 dark:hover:border-blue-500"
            title="Nuevo Asiento de Diario"
          >
            <Plus className="w-4 h-4 text-blue-600 dark:blue-500" />
            Asiento
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
                Comprobantes Registrados
              </p>
              <h3 className="text-2xl font-bold text-[#333333] dark:text-[#E0E0E0] mt-1">
                {totalComprobantes}
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
                Asentados Legalmente
              </p>
              <h3 className="text-2xl font-bold text-[#333333] dark:text-[#E0E0E0] mt-1">
                {postedCount}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-900/30 text-[#28A745] dark:text-[#4ADE80]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#FFC107] dark:border-l-[#FBBF24] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
                Pendientes en Borrador
              </p>
              <h3 className="text-2xl font-bold text-[#333333] dark:text-[#E0E0E0] mt-1">
                {draftCount}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-[#FFC107] dark:text-[#FBBF24]">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#17A2B8] dark:border-l-[#38C9DD] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
                Total Débitos Asentados
              </p>
              <h3 className="text-xl font-bold font-mono text-[#333333] dark:text-[#E0E0E0] mt-1">
                {formatMoneyVES(totalDebitsVes)}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 text-[#17A2B8] dark:text-[#38C9DD]">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <Card className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar concepto o correlativo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-lg"
            />
          </div>

          <div>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg text-sm"
              title="Fecha inicial"
            />
          </div>

          <div>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg text-sm"
              title="Fecha final"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#242526] text-[#333333] dark:text-[#E0E0E0] rounded-lg text-sm"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="POSTED">Asentados (Válidos)</option>
              <option value="DRAFT">En Borrador</option>
              <option value="ANNULLED">Anulados</option>
            </select>
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#242526] text-[#333333] dark:text-[#E0E0E0] rounded-lg text-sm"
            >
              <option value="ALL">Todos los Tipos de Asiento</option>
              <option value="STANDARD">Operación Estándar</option>
              <option value="OPENING">Apertura de Ejercicio</option>
              <option value="ADJUSTMENT">Ajustes / Regularización</option>
              <option value="EXCHANGE_DIFF">Fluctuación Cambiaria</option>
              <option value="INFLATION_ADJUSTMENT">
                Ajuste Inflación (REI)
              </option>
              <option value="CLOSING">Cierre Fiscal</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Tabla del Libro Diario */}
      <Card className="rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-[#F4F6F9] dark:bg-[#18191A] text-xs uppercase font-semibold text-gray-600 dark:text-gray-400 sticky top-0 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="py-3 px-4">Correlativo Legal</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Concepto / Glosa</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4 text-right">Total Débito (VES)</th>
                <th className="py-3 px-4 text-right">Total Crédito (VES)</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-[#242526]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    Cargando asientos del Libro Diario...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    No se encontraron comprobantes contables registrados en el
                    período.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-xs font-semibold text-[#007BFF] dark:text-[#3D91FF]">
                      {entry.entryNumber}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">
                      {entry.entryDate}
                    </td>

                    <td
                      className="py-3 px-4 max-w-md truncate text-[#333333] dark:text-[#E0E0E0]"
                      title={entry.concept}
                    >
                      <span className="font-medium">{entry.concept}</span>
                      <div className="text-xs text-gray-400">
                        {entry.lineCount} líneas | Creado por{" "}
                        {entry.createdByName}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                      {getTypeLabel(entry.entryType)}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-xs font-medium text-[#333333] dark:text-[#E0E0E0]">
                      {formatMoneyVES(entry.totalDebitVes)}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-xs font-medium text-[#333333] dark:text-[#E0E0E0]">
                      {formatMoneyVES(entry.totalCreditVes)}
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {getStatusBadge(entry.status)}
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenDetail(entry.id)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 hover:text-[#007BFF] transition-colors"
                          title="Ver Comprobante Completo"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setViewerPdfUrl(
                              `/api/accounting/journal-entries/${entry.id}/pdf`,
                            );
                            setViewerPdfTitle(
                              `Comprobante N° ${entry.entryNumber}`,
                            );
                            setViewerPdfSubtitle(
                              `Voucher Oficial con Cuadro de Firmas - ${entry.concept}`,
                            );
                            setPdfModalOpen(true);
                          }}
                          className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded text-blue-600 transition-colors"
                          title="Imprimir / Ver Comprobante Oficial en PDF"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {entry.status === "DRAFT" && (
                          <button
                            onClick={() => handlePostEntry(entry.id)}
                            className="p-1 hover:bg-green-50 dark:hover:bg-green-900/30 rounded text-green-600 transition-colors"
                            title="Asentar Legalmente"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}

                        {entry.status !== "ANNULLED" && (
                          <button
                            onClick={() => handleAnnulEntry(entry.id)}
                            className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-red-500 hover:text-red-600 transition-colors"
                            title="Anular Comprobante"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Detalle de Comprobante Contable */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={
          selectedEntry
            ? `Comprobante Contable: ${selectedEntry.entryNumber}`
            : "Detalle de Asiento"
        }
      >
        {loadingDetail || !selectedEntry ? (
          <div className="py-8 text-center text-gray-500">
            Cargando desglose de partida doble...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Cabecera del comprobante */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-200 dark:border-gray-800 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-[#333333] dark:text-[#E0E0E0] text-base">
                    {selectedEntry.concept}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Fecha:{" "}
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                      {selectedEntry.entryDate}
                    </span>{" "}
                    | Tipo:{" "}
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                      {getTypeLabel(selectedEntry.entryType)}
                    </span>{" "}
                    | Tasa BCV:{" "}
                    <span className="font-mono">
                      {formatMoneyVES(selectedEntry.exchangeRate)}
                    </span>
                  </p>
                </div>
                <div>{getStatusBadge(selectedEntry.status)}</div>
              </div>
              {selectedEntry.notes && (
                <p className="text-xs italic text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-1">
                  Nota: {selectedEntry.notes}
                </p>
              )}
            </div>

            {/* Líneas del Comprobante */}
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#F4F6F9] dark:bg-[#18191A] font-semibold text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="py-2 px-3">Cuenta Contable</th>
                    <th className="py-2 px-3">Descripción de la Línea</th>
                    <th className="py-2 px-3">Ref. Doc</th>
                    <th className="py-2 px-3 text-right">Débito (VES)</th>
                    <th className="py-2 px-3 text-right">Crédito (VES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-[#242526]">
                  {selectedEntry.lines.map((line: any) => (
                    <tr key={line.id}>
                      <td className="py-2 px-3 font-mono font-medium">
                        <span className="text-[#007BFF] dark:text-[#3D91FF]">
                          {line.accountCode}
                        </span>{" "}
                        - {line.accountName}
                      </td>
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                        {line.description}
                      </td>
                      <td className="py-2 px-3 text-gray-500 font-mono">
                        {line.referenceDoc || "-"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium">
                        {line.debitVes > 0
                          ? `${formatMoneyVES(line.debitVes)}`
                          : "-"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium">
                        {line.creditVes > 0
                          ? `${formatMoneyVES(line.creditVes)}`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#F4F6F9] dark:bg-[#18191A] font-bold border-t border-gray-300 dark:border-gray-700">
                  <tr>
                    <td colSpan={3} className="py-2 px-3 text-right uppercase">
                      Totales Cuadrados (Partida Doble):
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-[#007BFF] dark:text-[#3D91FF]">
                      {formatMoneyVES(selectedEntry.totalDebitVes)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-[#007BFF] dark:text-[#3D91FF]">
                      {formatMoneyVES(selectedEntry.totalCreditVes)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pie de Auditoría */}
            <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-800 gap-2">
              <div>
                Elaborado por:{" "}
                <span className="font-semibold text-gray-600 dark:text-gray-300">
                  {selectedEntry.createdByName}
                </span>
                {selectedEntry.postedByName && (
                  <>
                    {" "}
                    | Asentado por:{" "}
                    <span className="font-semibold text-green-600">
                      {selectedEntry.postedByName}
                    </span>{" "}
                    el {selectedEntry.postedAt}
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewerPdfUrl(
                      `/api/accounting/journal-entries/${selectedEntry.id}/pdf`,
                    );
                    setViewerPdfTitle(
                      `Comprobante N° ${selectedEntry.entryNumber}`,
                    );
                    setViewerPdfSubtitle(
                      `Voucher Oficial con Cuadro de Firmas - ${selectedEntry.concept}`,
                    );
                    setPdfModalOpen(true);
                  }}
                  className="border-gray-300 dark:border-gray-700 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-[#007BFF] dark:text-[#3D91FF]" />
                  Ver Voucher PDF
                </Button>

                {selectedEntry.status === "DRAFT" && (
                  <Button
                    onClick={() => handlePostEntry(selectedEntry.id)}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Asentar Ahora
                  </Button>
                )}
                {selectedEntry.status !== "ANNULLED" && (
                  <Button
                    variant="outline"
                    onClick={() => handleAnnulEntry(selectedEntry.id)}
                    className="text-red-500 border-red-300 hover:bg-red-50 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Anular
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Nuevo Asiento Contable */}
      <Modal
        size="5xl"
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Registrar Nuevo Asiento en el Libro Diario"
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto px-1">
          {/* Parámetros del Asiento */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Fecha del Comprobante
              </label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="text-xs rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Tipo de Asiento
              </label>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value as any)}
                className="w-full px-2.5 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#242526] text-[#333333] dark:text-[#E0E0E0] rounded-lg text-xs"
              >
                <option value="STANDARD">Operación Estándar</option>
                <option value="OPENING">Apertura de Ejercicio</option>
                <option value="ADJUSTMENT">Ajustes / Regularización</option>
                <option value="EXCHANGE_DIFF">Fluctuación Cambiaria</option>
                <option value="INFLATION_ADJUSTMENT">
                  Ajuste Inflación REI
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Moneda Base
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as any)}
                className="w-full px-2.5 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#242526] text-[#333333] dark:text-[#E0E0E0] rounded-lg text-xs"
              >
                <option value="VES">Bolívares (VES)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Tasa Oficial BCV
              </label>
              <Input
                type="number"
                step="0.0001"
                value={exchangeRate}
                onChange={(e) =>
                  setExchangeRate(parseFloat(e.target.value) || 1)
                }
                className="text-xs font-mono rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Concepto General / Glosa <span className="text-red-500">*</span>
            </label>
            <Input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej. Registro de cancelación de factura comercial con retención de IVA..."
              className="text-xs rounded-lg"
              required
            />
          </div>

          {/* Grilla dinámica de Partida Doble */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Desglose de Cuentas (Partida Doble)
              </label>
              <Button
                type="button"
                onClick={handleAddLine}
                variant="outline"
                className="text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 text-[#007BFF]"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Línea
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#F4F6F9] dark:bg-[#18191A] font-semibold text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="py-2 px-2 w-1/3">Cuenta Imputable</th>
                    <th className="py-2 px-2">Descripción</th>
                    <th className="py-2 px-2 w-24">Doc Ref</th>
                    <th className="py-2 px-2 w-28 text-right">Débito (VES)</th>
                    <th className="py-2 px-2 w-28 text-right">Crédito (VES)</th>
                    <th className="py-2 px-1 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-[#242526]">
                  {lines.map((line, idx) => (
                    <tr key={line.id}>
                      <td className="p-1">
                        <select
                          value={line.accountId}
                          onChange={(e) =>
                            handleLineChange(idx, "accountId", e.target.value)
                          }
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#242526] text-[#333333] dark:text-[#E0E0E0] rounded text-xs"
                          required
                        >
                          <option value="">-- Seleccione Cuenta --</option>
                          {postingAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-1">
                        <Input
                          value={line.description}
                          onChange={(e) =>
                            handleLineChange(idx, "description", e.target.value)
                          }
                          placeholder="Glosa de la línea..."
                          className="text-xs py-1 px-2 h-8 rounded"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          value={line.referenceDoc}
                          onChange={(e) =>
                            handleLineChange(
                              idx,
                              "referenceDoc",
                              e.target.value,
                            )
                          }
                          placeholder="Doc #"
                          className="text-xs py-1 px-2 h-8 font-mono rounded"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debitVes || ""}
                          onChange={(e) =>
                            handleLineChange(
                              idx,
                              "debitVes",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          placeholder="0.00"
                          className="text-xs py-1 px-2 h-8 font-mono text-right rounded"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.creditVes || ""}
                          onChange={(e) =>
                            handleLineChange(
                              idx,
                              "creditVes",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          placeholder="0.00"
                          className="text-xs py-1 px-2 h-8 font-mono text-right rounded"
                        />
                      </td>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded"
                          title="Eliminar línea"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Barra de Cuadre de Partida Doble */}
            <div
              className={`p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center text-xs font-mono ${
                isBalanced
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-[#28A745] dark:text-[#4ADE80] border border-emerald-200 dark:border-emerald-800"
                  : "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
              }`}
            >
              <div className="flex items-center gap-2">
                {isBalanced ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#28A745]" />
                    <span className="font-sans font-bold">
                      Partida Doble Cuadrada (Débitos = Créditos)
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="font-sans font-bold">
                      Descuadre Contable: Diferencia de Bs.{" "}
                      {difference.toFixed(2)}
                    </span>
                  </>
                )}
              </div>

              <div className="flex gap-4 font-bold mt-2 sm:mt-0">
                <span>Débito: {formatMoneyVES(totalDebit)}</span>
                <span>Crédito: {formatMoneyVES(totalCredit)}</span>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNewModalOpen(false)}
              className="rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSaveJournalEntry(false)}
              disabled={isSubmitting || !isBalanced}
              className="rounded-lg border-[#007BFF] text-[#007BFF] hover:bg-blue-50"
            >
              Guardar en Borrador
            </Button>
            <Button
              type="button"
              onClick={() => handleSaveJournalEntry(true)}
              disabled={isSubmitting || !isBalanced}
              className="bg-[#007BFF] hover:bg-blue-600 text-white rounded-lg"
            >
              {isSubmitting ? "Asentando..." : "Asentar Legalmente"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Visor PDF Oficial */}
      <PdfViewerModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title={viewerPdfTitle}
        subtitle={viewerPdfSubtitle}
        endpoint={viewerPdfUrl}
        filename={`${viewerPdfTitle.toLowerCase().replace(/[^a-z0-9]/g, "_")}.pdf`}
      />
    </div>
  );
};
export default JournalEntriesView;
