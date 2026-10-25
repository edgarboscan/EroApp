import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { toast } from "sonner";
import { formatMoneyUSD, formatMoneyVES } from "../../utils/formatters";
import {
  Users,
  Search,
  Plus,
  FileSpreadsheet,
  X,
  CreditCard,
  Building2,
  Phone,
  Mail,
  Edit2,
  Lock,
  Unlock,
  Star,
  History,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Truck,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Check,
  Award,
} from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { showConfirmQuestion } from "../../lib/sweetalert";

export type CustomerTier = "VIP" | "EXCELLENT" | "REGULAR" | "RISKY" | "MOROSO";

export interface Customer {
  id: string;
  docType: "V" | "E" | "J" | "G" | "P";
  docNumber: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  isSpecialTaxpayer: boolean;
  creditEnabled: boolean;
  creditLimit: number;
  paymentTermsDays: number;
  isActive: boolean;
  isBlocked: boolean;
  blockReason?: string | null;
  blockedAt?: string | null;
  ratingScore: number;
  ratingTier: CustomerTier;
  ratingNotes?: string | null;
  notes?: string | null;
  currentBalance: number;
  pendingInvoicesCount: number;
  totalInvoicesCount: number;
  totalInvoicedUSD: number;
}

interface CustomerHistoryData {
  customer: Customer;
  statistics: {
    totalInvoicedUSD: number;
    totalPaidUSD: number;
    currentBalanceUSD: number;
    totalOverdueUSD: number;
    overdueCount: number;
    invoicesCount: number;
    paidInvoicesCount: number;
    quotationsCount: number;
    deliveryNotesCount: number;
    paymentsCount: number;
    punctualityRate: number;
    suggestedScore: number;
    suggestedTier: CustomerTier;
    suggestedReason: string;
  };
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    controlNumber?: string | null;
    invoiceDate: string;
    currency: "USD" | "VES";
    totalAmount: number;
    status: "PAID" | "PENDING" | "ANNULLED";
    isCredit: boolean;
    amountBalance?: number | null;
    daysOverdue?: number;
  }>;
  quotations: Array<{
    id: string;
    quotationNumber: string;
    quotationDate: string;
    validUntilDate: string;
    currency: "USD" | "VES";
    totalAmount: number;
    status: string;
    itemsCount: number;
  }>;
  deliveryNotes: Array<{
    id: string;
    deliveryNumber: string;
    deliveryDate: string;
    currency: "USD" | "VES";
    totalAmount: number;
    driverName?: string | null;
    vehiclePlate?: string | null;
    status: string;
    itemsCount: number;
  }>;
  payments: Array<{
    id: string;
    invoiceId: string;
    invoiceNumber: string;
    method: string;
    amountUSD: number;
    amountVES: number;
    exchangeRate: number;
    referenceNumber?: string | null;
    createdAt: string;
    bankName?: string | null;
    bankAccountNumber?: string | null;
  }>;
}

export const getTierBadge = (tier: CustomerTier) => {
  switch (tier) {
    case "VIP":
      return {
        label: "VIP / Preferencial",
        badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
        starColor: "text-purple-600 fill-purple-600",
      };
    case "EXCELLENT":
      return {
        label: "Excelente / Confiable",
        badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
        starColor: "text-emerald-600 fill-emerald-600",
      };
    case "REGULAR":
      return {
        label: "Regular / Estándar",
        badgeColor: "bg-sky-100 text-sky-800 border-sky-200",
        starColor: "text-sky-600 fill-sky-600",
      };
    case "RISKY":
      return {
        label: "Riesgo Moderado",
        badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
        starColor: "text-amber-600 fill-amber-600",
      };
    case "MOROSO":
      return {
        label: "Moroso / Crítico",
        badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
        starColor: "text-rose-600 fill-rose-600",
      };
    default:
      return {
        label: tier || "Estándar",
        badgeColor: "bg-neutral-100 text-neutral-400  border-neutral-200",
        starColor: "text-neutral-500 fill-neutral-500",
      };
  }
};

const formatSafeDate = (d?: string | null): string => {
  if (!d) return "N/A";
  try {
    const str = String(d).replace(" ", "T");
    const parsed = new Date(str);
    return isNaN(parsed.getTime())
      ? String(d).slice(0, 10)
      : parsed.toLocaleDateString("es-VE");
  } catch {
    return String(d).slice(0, 10);
  }
};

export const CustomersView: React.FC = () => {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "blocked" | "credit" | "debt"
  >("all");
  const [isLoading, setIsLoading] = useState(false);

  // Modal Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Modal Bloqueo
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockingCustomer, setBlockingCustomer] = useState<Customer | null>(
    null,
  );
  const [blockReasonInput, setBlockReasonInput] = useState("");
  const [isBlockingSubmit, setIsBlockingSubmit] = useState(false);

  // Modal Calificación
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingCustomer, setRatingCustomer] = useState<Customer | null>(null);
  const [ratingScoreInput, setRatingScoreInput] = useState(5.0);
  const [ratingTierInput, setRatingTierInput] =
    useState<CustomerTier>("REGULAR");
  const [ratingNotesInput, setRatingNotesInput] = useState("");

  // Modal Historial & Estadísticas
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<CustomerHistoryData | null>(
    null,
  );
  const [historyActiveTab, setHistoryActiveTab] = useState<
    "invoices" | "quotations" | "deliveries" | "payments"
  >("invoices");

  // Form State para Crear / Editar
  const [formData, setFormData] = useState({
    docType: "J" as "V" | "E" | "J" | "G" | "P",
    docNumber: "",
    name: "",
    address: "",
    phone: "",
    email: "",
    isSpecialTaxpayer: false,
    creditEnabled: false,
    creditLimit: 0,
    paymentTermsDays: 15,
    isBlocked: false,
    blockReason: "",
    ratingScore: 5.0,
    ratingTier: "REGULAR" as CustomerTier,
    ratingNotes: "",
    notes: "",
  });

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append("q", search.trim());
      if (filterStatus !== "all") params.append("filter", filterStatus);

      const url = `/api/customers?${params.toString()}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (json.success && Array.isArray(json.data)) {
        setCustomers(json.data);
      } else {
        setCustomers([]);
      }
    } catch {
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filterStatus]);

  // Abrir Modal para Crear
  const handleOpenCreateModal = () => {
    setEditingCustomer(null);
    setFormData({
      docType: "J",
      docNumber: "",
      name: "",
      address: "",
      phone: "",
      email: "",
      isSpecialTaxpayer: false,
      creditEnabled: false,
      creditLimit: 0,
      paymentTermsDays: 15,
      isBlocked: false,
      blockReason: "",
      ratingScore: 5.0,
      ratingTier: "REGULAR",
      ratingNotes: "",
      notes: "",
    });
    setIsModalOpen(true);
  };

  // Abrir Modal para Editar
  const handleOpenEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      docType: customer.docType,
      docNumber: customer.docNumber,
      name: customer.name,
      address: customer.address || "",
      phone: customer.phone || "",
      email: customer.email || "",
      isSpecialTaxpayer: customer.isSpecialTaxpayer,
      creditEnabled: customer.creditEnabled,
      creditLimit: customer.creditLimit,
      paymentTermsDays: customer.paymentTermsDays || 15,
      isBlocked: customer.isBlocked,
      blockReason: customer.blockReason || "",
      ratingScore: customer.ratingScore || 5.0,
      ratingTier: customer.ratingTier || "REGULAR",
      ratingNotes: customer.ratingNotes || "",
      notes: customer.notes || "",
    });
    setIsModalOpen(true);
  };

  // Guardar (Crear o Editar)
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.docNumber.trim() || !formData.name.trim()) {
      toast.error("Complete el documento y la razón social");
      return;
    }

    if (formData.isBlocked && !formData.blockReason.trim()) {
      toast.error("Especifique el motivo de bloqueo del cliente");
      return;
    }

    try {
      const isEdit = Boolean(editingCustomer);
      const url = isEdit
        ? `/api/customers/${editingCustomer!.id}`
        : "/api/customers";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          creditLimit: Number(formData.creditLimit) || 0,
          paymentTermsDays: Number(formData.paymentTermsDays) || 0,
          ratingScore: Number(formData.ratingScore) || 5.0,
        }),
      });

      const json = await response.json();
      if (response.ok && json.success) {
        toast.success(
          isEdit
            ? "Cliente actualizado exitosamente"
            : "Cliente registrado exitosamente",
        );
        setIsModalOpen(false);
        fetchCustomers();
      } else {
        throw new Error(json.error?.message || "Error al guardar cliente");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al guardar cliente");
    }
  };

  // Abrir Modal de Bloqueo
  const handleOpenBlockModal = (customer: Customer) => {
    setBlockingCustomer(customer);
    setBlockReasonInput(customer.blockReason || "");
    setIsBlockModalOpen(true);
  };

  // Confirmar Bloqueo
  const handleConfirmBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockingCustomer) return;
    if (!blockReasonInput.trim()) {
      toast.error("Debe ingresar el motivo de bloqueo");
      return;
    }

    setIsBlockingSubmit(true);
    try {
      const response = await fetch(
        `/api/customers/${blockingCustomer.id}/block`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            isBlocked: true,
            blockReason: blockReasonInput.trim(),
          }),
        },
      );

      const json = await response.json();
      if (response.ok && json.success) {
        toast.success(`Cliente ${blockingCustomer.name} ha sido BLOQUEADO`);
        setIsBlockModalOpen(false);
        fetchCustomers();
      } else {
        throw new Error(json.error?.message || "Error al bloquear cliente");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al bloquear cliente");
    } finally {
      setIsBlockingSubmit(false);
    }
  };

  // Desbloquear con Confirmación
  const handleUnblockCustomer = async (customer: Customer) => {
    const confirmed = await showConfirmQuestion({
      title: "¿Desbloquear cliente?",
      text: `Se habilitará nuevamente a "${customer.name}" para operaciones de venta, facturación y crédito comercial.`,
      confirmButtonText: "Sí, Desbloquear",
      cancelButtonText: "Cancelar",
      isDestructive: false,
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/customers/${customer.id}/block`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isBlocked: false,
          blockReason: null,
        }),
      });

      const json = await response.json();
      if (response.ok && json.success) {
        toast.success(`Cliente ${customer.name} desbloqueado exitosamente`);
        fetchCustomers();
      } else {
        throw new Error(json.error?.message || "Error al desbloquear cliente");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al desbloquear cliente");
    }
  };

  // Abrir Modal de Calificación Rápida
  const handleOpenRatingModal = (customer: Customer) => {
    setRatingCustomer(customer);
    setRatingScoreInput(customer.ratingScore || 5.0);
    setRatingTierInput(customer.ratingTier || "REGULAR");
    setRatingNotesInput(customer.ratingNotes || "");
    setIsRatingModalOpen(true);
  };

  // Guardar Calificación Rápida
  const handleSaveRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingCustomer) return;

    try {
      const response = await fetch(`/api/customers/${ratingCustomer.id}/rate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ratingScore: Number(ratingScoreInput),
          ratingTier: ratingTierInput,
          ratingNotes: ratingNotesInput.trim() || null,
        }),
      });

      const json = await response.json();
      if (response.ok && json.success) {
        toast.success(`Calificación de ${ratingCustomer.name} actualizada`);
        setIsRatingModalOpen(false);
        fetchCustomers();
      } else {
        throw new Error(
          json.error?.message || "Error al actualizar calificación",
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar calificación");
    }
  };

  // Abrir Modal de Historial y Estadísticas
  const handleOpenHistoryModal = async (customer: Customer) => {
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistoryActiveTab("invoices");
    setHistoryData(null);

    try {
      const response = await fetch(`/api/customers/${customer.id}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (response.ok && json.success && json.data) {
        setHistoryData(json.data);
      } else {
        toast.error("No se pudo cargar el historial del cliente");
      }
    } catch {
      toast.error("Error al consultar historial del cliente");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Contadores para badges de filtros
  const blockedCount = useMemo(
    () => customers.filter((c) => c.isBlocked).length,
    [customers],
  );
  const debtCount = useMemo(
    () => customers.filter((c) => c.currentBalance > 0).length,
    [customers],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-400  dark:text-neutral-100">
            Directorio de Clientes
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Gestión de cartera, calificación comercial, condiciones de crédito y
            control de bloqueos
          </p>
        </div>

        <Button onClick={handleOpenCreateModal} className="sm:w-auto">
          <Plus className="w-4 h-4 mr-1.5" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar por RIF, cédula, nombre, correo o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-400  dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
          />
        </div>

        {/* Filtros Rápidos */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "all", label: "Todos" },
            { id: "active", label: "Activos" },
            {
              id: "blocked",
              label: `Bloqueados ${blockedCount > 0 ? `(${blockedCount})` : ""}`,
              alert: blockedCount > 0,
            },
            { id: "credit", label: "Con Crédito" },
            {
              id: "debt",
              label: `Con Deuda ${debtCount > 0 ? `(${debtCount})` : ""}`,
              alert: debtCount > 0,
            },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterStatus(item.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filterStatus === item.id
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-400  shadow-xs"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-400  dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Clientes */}
      <div className="overflow-x-auto  border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xs">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase  tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
            <tr>
              <th className="py-3 px-4">Documento & Estado</th>
              <th className="py-3 px-4">Nombre / Razón Social</th>
              <th className="py-3 px-4">Calificación</th>
              <th className="py-3 px-4">Contacto</th>
              <th className="py-3 px-4">Crédito Comercial</th>
              <th className="py-3 px-4 text-right">Saldo Deudor</th>
              <th className="py-3 px-4 text-center w-36">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr
                  key={idx}
                  className="border-b border-neutral-100 dark:border-neutral-800 animate-pulse"
                >
                  <td className="py-3 px-4">
                    <div className="h-4 bg-neutral-200 rounded-lg w-28" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 bg-neutral-200 rounded-lg w-48" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 bg-neutral-200 rounded-lg w-24" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 bg-neutral-200 rounded-lg w-32" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 bg-neutral-200 rounded-lg w-28" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 bg-neutral-200 rounded-lg w-20 ml-auto" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-14 bg-neutral-200 rounded-lg w-28 mx-auto" />
                  </td>
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-neutral-400">
                  <Users className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                  <p className="text-xs font-medium">
                    No se encontraron clientes que coincidan con la búsqueda
                  </p>
                </td>
              </tr>
            ) : (
              customers.map((c) => {
                const tierInfo = getTierBadge(c.ratingTier);
                return (
                  <tr
                    key={c.id}
                    className={`hover:bg-neutral-800 transition-colors ${
                      c.isBlocked ? "bg-rose-50/20" : ""
                    }`}
                  >
                    {/* Documento y Estado */}
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-neutral-400 ">
                        {c.docType}-{c.docNumber}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {c.isBlocked ? (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200"
                            title={`Bloqueado: ${c.blockReason || "Sin motivo especificado"}`}
                          >
                            <Lock className="w-3 h-3 text-rose-600" />
                            BLOQUEADO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Activo
                          </span>
                        )}
                        {c.isSpecialTaxpayer && (
                          <span className="px-1.5 py-0.5 rounded-lg text-[10px] bg-amber-100 text-amber-800 border border-amber-200 font-semibold">
                            SENIAT
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Nombre y Dirección */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-neutral-400 ">
                        {c.name}
                      </div>
                      {c.address && (
                        <div className="text-[11px] text-neutral-400 truncate max-w-xs">
                          {c.address}
                        </div>
                      )}
                      {c.isBlocked && c.blockReason && (
                        <div className="text-[10px] text-rose-600 mt-0.5 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                          <span className="truncate max-w-xs">
                            {c.blockReason}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Calificación */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <div className="flex items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < Math.round(c.ratingScore || 5)
                                  ? tierInfo.starColor
                                  : "text-neutral-200 fill-neutral-200"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="font-mono font-bold text-neutral-400  text-[11px]">
                          {Number(c.ratingScore || 5).toFixed(1)}
                        </span>
                      </div>
                      <div className="mt-1">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded-lg text-[10px] font-semibold border ${tierInfo.badgeColor}`}
                        >
                          {tierInfo.label}
                        </span>
                      </div>
                    </td>

                    {/* Contacto */}
                    <td className="py-3 px-4 text-neutral-600">
                      {c.phone ? (
                        <div className="flex items-center gap-1 text-[11px]">
                          <Phone className="w-3 h-3 text-neutral-400 shrink-0" />
                          <span>{c.phone}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-neutral-400">-</span>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1 text-[11px] text-neutral-500 mt-0.5 truncate max-w-xs">
                          <Mail className="w-3 h-3 text-neutral-400 shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                    </td>

                    {/* Línea de Crédito */}
                    <td className="py-3 px-4">
                      {c.creditEnabled ? (
                        <div>
                          <div className="font-semibold text-neutral-400  font-mono">
                            {formatMoneyUSD(c.creditLimit)}
                          </div>
                          <div className="text-[10px] text-neutral-500">
                            {c.paymentTermsDays} días plazo
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-neutral-400 font-medium">
                          Contado
                        </span>
                      )}
                    </td>

                    {/* Saldo Deudor */}
                    <td className="py-3 px-4 text-right">
                      <div
                        className={`font-mono font-bold text-xs ${
                          c.currentBalance > 0
                            ? "text-amber-700"
                            : "text-emerald-700"
                        }`}
                      >
                        {formatMoneyUSD(c.currentBalance)}
                      </div>
                      {c.pendingInvoicesCount > 0 && (
                        <div className="text-[10px] text-neutral-500">
                          {c.pendingInvoicesCount} factura
                          {c.pendingInvoicesCount > 1 ? "s" : ""} pendiente
                        </div>
                      )}
                      {c.totalInvoicedUSD > 0 && (
                        <div className="text-[10px] text-neutral-400 font-mono">
                          Total: {formatMoneyUSD(c.totalInvoicedUSD)}
                        </div>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="py-2 px-3 text-center">
                      <div className="flex flex-col items-center justify-center gap-1.5 py-0.5">
                        {/* Fila 1: Editar, Bloquear/Desbloquear, Calificar */}
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Botón Editar */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEditModal(c)}
                            title="Editar información del cliente"
                            aria-label="Editar cliente"
                            className=" p-0 text-sky-600 hover:text-sky-700 hover:bg-sky-50 hover:border-sky-300"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>

                          {/* Botón Bloquear / Desbloquear */}
                          {c.isBlocked ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUnblockCustomer(c)}
                              title="Desbloquear cliente"
                              aria-label="Desbloquear cliente"
                              className="p-0 text-emerald-600 border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
                            >
                              <Unlock className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenBlockModal(c)}
                              title="Bloquear cliente"
                              aria-label="Bloquear cliente"
                              className="p-0 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-300"
                            >
                              <Lock className="w-4 h-4" />
                            </Button>
                          )}

                          {/* Botón Calificar */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenRatingModal(c)}
                            title="Calificar cliente"
                            aria-label="Calificar cliente"
                            className="p-0 text-amber-500 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-300"
                          >
                            <Star className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Fila 2: Historial & Estadísticas, Estado de Cuenta */}
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Botón Historial & Estadísticas */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenHistoryModal(c)}
                            title="Ver estadísticas e historial comercial"
                            aria-label="Historial y estadísticas"
                            className="p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-300"
                          >
                            <History className="w-4 h-4" />
                          </Button>

                          {/* Botón Estado de Cuenta */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate(`/customers/${c.id}/statement`)
                            }
                            title="Ver Estado de Cuenta y CxC"
                            aria-label="Estado de cuenta"
                            className="p-0 text-neutral-600 hover:text-sky-700 hover:bg-sky-50 hover:border-sky-300"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRAR / EDITAR CLIENTE                                       */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingCustomer
            ? `Editar Cliente: ${editingCustomer.name}`
            : "Registrar Nuevo Cliente"
        }
        subtitle="Gestión de cartera, datos fiscales, crédito comercial y calificación"
        size="xl"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button size="sm" type="submit" form="customerForm">
              {editingCustomer ? "Actualizar Cliente" : "Guardar Cliente"}
            </Button>
          </div>
        }
      >
        <form
          id="customerForm"
          onSubmit={handleSaveCustomer}
          className="space-y-4 text-xs"
        >
          {/* Documento y Tipo */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-400  block mb-1">
                Tipo Doc <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.docType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    docType: e.target.value as any,
                  })
                }
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400  dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
              >
                <option value="J">J - Jurídico</option>
                <option value="V">V - Venezolano</option>
                <option value="E">E - Extranjero</option>
                <option value="G">G - Gobierno</option>
                <option value="P">P - Pasaporte</option>
              </select>
            </div>
            <div className="col-span-2">
              <Input
                label="Número de Documento / RIF"
                placeholder="Ej: 309998881"
                value={formData.docNumber}
                onChange={(e) =>
                  setFormData({ ...formData, docNumber: e.target.value })
                }
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400  dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
              />
            </div>
          </div>

          {/* Nombre */}
          <Input
            label="Nombre / Razón Social"
            placeholder="Ej: Distribuidora El Sol C.A."
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400  dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />

          {/* Teléfono y Correo */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Teléfono"
              placeholder="+58 212 999 8888"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400  dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <Input
              label="Correo Electrónico"
              type="email"
              placeholder="cliente@empresa.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400  dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Dirección Fiscal */}
          <Input
            label="Dirección Fiscal"
            placeholder="Av. Principal, Edificio, Ciudad"
            value={formData.address}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
            className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400  dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />

          {/* Parámetros Fiscales y Comerciales */}
          <div className="p-3.5 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800  space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-neutral-400  block">
                  Contribuyente Especial SENIAT
                </span>
                <span className="text-[11px] text-neutral-500">
                  Aplica retenciones fiscales de IVA
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.isSpecialTaxpayer}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    isSpecialTaxpayer: e.target.checked,
                  })
                }
                className="w-4 h-4 text-sky-600 rounded cursor-pointer"
              />
            </div>

            <div className="border-t border-neutral-200 pt-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-neutral-400  block">
                  Línea de Crédito Comercial
                </span>
                <span className="text-[11px] text-neutral-500">
                  Permite emitir cotizaciones y facturas a crédito (CxC)
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.creditEnabled}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    creditEnabled: e.target.checked,
                  })
                }
                className="w-4 h-4 text-sky-600 rounded cursor-pointer"
              />
            </div>

            {formData.creditEnabled && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Input
                  label="Límite de Crédito ($ USD)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.creditLimit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      creditLimit: Number(e.target.value),
                    })
                  }
                />
                <Input
                  label="Plazo de Pago (Días)"
                  type="number"
                  min="0"
                  value={formData.paymentTermsDays}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      paymentTermsDays: Number(e.target.value),
                    })
                  }
                />
              </div>
            )}
          </div>

          {/* Calificación y Categoría Comercial */}
          <div className="p-3.5 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800  space-y-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-neutral-400 ">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>Calificación & Nivel Comercial</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-neutral-400  block mb-1">
                  Puntuación (1 a 5 Estrellas)
                </label>
                <select
                  value={formData.ratingScore}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      ratingScore: Number(e.target.value),
                    })
                  }
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value={5.0}>5.0 - Excelente / Impecable</option>
                  <option value={4.5}>4.5 - Muy Bueno</option>
                  <option value={4.0}>4.0 - Bueno / Confiable</option>
                  <option value={3.0}>3.0 - Regular / Promedio</option>
                  <option value={2.0}>2.0 - Riesgo Moderado</option>
                  <option value={1.0}>1.0 - Crítico / Moroso</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-400  block mb-1">
                  Categoría Comercial (Tier)
                </label>
                <select
                  value={formData.ratingTier}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      ratingTier: e.target.value as CustomerTier,
                    })
                  }
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="VIP">
                    VIP - Compras Frecuentes y Pago Puntual
                  </option>
                  <option value="EXCELLENT">
                    EXCELLENT - Confiable y al día
                  </option>
                  <option value="REGULAR">REGULAR - Cliente estándar</option>
                  <option value="RISKY">RISKY - Riesgo de atraso</option>
                  <option value="MOROSO">MOROSO - Historial con mora</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400  block mb-1">
                Observaciones de Calificación
              </label>
              <textarea
                rows={2}
                placeholder="Comentarios sobre conducta de pago o volumen comercial..."
                value={formData.ratingNotes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    ratingNotes: e.target.value,
                  })
                }
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Control de Bloqueo Administrativo */}
          <div
            className={`p-3.5 ${formData.isBlocked ? "bg-rose-50/60 dark:bg-rose-950/30" : "bg-sky-50/60 dark:bg-sky-950/30"} rounded-lg border ${formData.isBlocked ? "border-rose-300 bg-rose-50/50" : "border-neutral-200 bg-neutral-50"} space-y-3 text-xs`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Lock
                  className={`w-4 h-4 ${formData.isBlocked ? "text-rose-600" : "text-neutral-500"}`}
                />
                <div>
                  <span className="font-semibold text-neutral-400  block">
                    Bloquear Cliente para Operaciones
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    Impide emitir nuevas cotizaciones, notas de entrega o
                    facturas a este cliente
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.isBlocked}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    isBlocked: e.target.checked,
                  })
                }
                className="w-4 h-4 text-rose-600 rounded cursor-pointer"
              />
            </div>

            {formData.isBlocked && (
              <div>
                <label className="text-xs font-semibold text-rose-900 block mb-1">
                  Motivo de Bloqueo <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required={formData.isBlocked}
                  placeholder="Ej: Mora excesiva mayor a 45 días / Documentación fiscal vencida"
                  value={formData.blockReason}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      blockReason: e.target.value,
                    })
                  }
                  className="w-full h-10 px-3 text-xs bg-white border border-rose-300 rounded-lg focus-visible:ring-2 focus-visible:ring-rose-500 text-neutral-400 "
                />
              </div>
            )}
          </div>

          {/* Notas Generales */}
          <div>
            <label className="text-xs font-semibold text-neutral-400  block mb-1">
              Notas Internas
            </label>
            <textarea
              rows={2}
              placeholder="Instrucciones de entrega, contactos secundarios, etc."
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="w-full p-2.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-400  dark:text-neutral-100 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500 resize-none"
            />
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: BLOQUEAR CLIENTE (CONFIRMACIÓN CON MOTIVO)                       */}
      {/* ========================================================================= */}
      {blockingCustomer && (
        <Modal
          isOpen={isBlockModalOpen}
          onClose={() => setIsBlockModalOpen(false)}
          title="Bloquear Cliente"
          subtitle={`${blockingCustomer.name} (${blockingCustomer.docType}-${blockingCustomer.docNumber})`}
          size="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setIsBlockModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                type="submit"
                variant="danger"
                disabled={isBlockingSubmit}
                form="blockCustomerForm"
              >
                <Lock className="w-3.5 h-3.5 mr-1" />
                Confirmar Bloqueo
              </Button>
            </div>
          }
        >
          <form
            id="blockCustomerForm"
            onSubmit={handleConfirmBlock}
            className="space-y-3 text-xs"
          >
            <p className="text-neutral-400  dark:text-neutral-300">
              Está a punto de{" "}
              <strong className="text-rose-600 dark:text-rose-400">
                BLOQUEAR
              </strong>{" "}
              comercialmente al cliente:
            </p>
            <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg border border-neutral-200 dark:border-neutral-700 font-medium">
              <p className="text-neutral-400  dark:text-neutral-100 font-semibold">
                {blockingCustomer.name}
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                {blockingCustomer.docType}-{blockingCustomer.docNumber}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400  dark:text-neutral-200 block mb-1">
                Motivo del Bloqueo{" "}
                <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Especifique la causa (Ej: Retraso en pagos de facturas / Suspensión de cuenta por gerencia)..."
                value={blockReasonInput}
                onChange={(e) => setBlockReasonInput(e.target.value)}
                className="w-full p-2.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-400  dark:text-neutral-100 rounded-lg focus-visible:ring-2 focus-visible:ring-rose-500 resize-none"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CALIFICACIÓN RÁPIDA DE CLIENTE                                    */}
      {/* ========================================================================= */}
      {ratingCustomer && (
        <Modal
          isOpen={isRatingModalOpen}
          onClose={() => setIsRatingModalOpen(false)}
          title="Calificar Cliente"
          subtitle={ratingCustomer.name}
          size="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setIsRatingModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button size="sm" type="submit" form="ratingCustomerForm">
                Guardar Calificación
              </Button>
            </div>
          }
        >
          <form
            id="ratingCustomerForm"
            onSubmit={handleSaveRating}
            className="space-y-3.5 text-xs"
          >
            {/* Estrellas interactivas */}
            <div>
              <label className="text-xs font-semibold text-neutral-400  dark:text-neutral-200 block mb-1">
                Puntuación de Confianza: {ratingScoreInput.toFixed(1)} / 5.0
              </label>
              <div className="flex items-center gap-1.5 p-2 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg border border-neutral-200 dark:border-neutral-700 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingScoreInput(star)}
                    className="p-1 text-amber-400 hover:scale-125 transition-transform cursor-pointer"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= ratingScoreInput
                          ? "text-amber-400 fill-amber-400"
                          : "text-neutral-200 dark:text-neutral-400  fill-neutral-200 dark:fill-neutral-700"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Categoría */}
            <div>
              <label className="text-xs font-semibold text-neutral-400  dark:text-neutral-200 block mb-1">
                Categoría Comercial (Tier)
              </label>
              <select
                value={ratingTierInput}
                onChange={(e) =>
                  setRatingTierInput(e.target.value as CustomerTier)
                }
                className="w-full h-10 px-3 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-400  dark:text-neutral-100 rounded-lg focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <option value="VIP">
                  VIP - Cliente Preferencial / Alto Volumen
                </option>
                <option value="EXCELLENT">
                  EXCELLENT - Excelente / Cumplimiento Puntual
                </option>
                <option value="REGULAR">REGULAR - Cliente Estándar</option>
                <option value="RISKY">RISKY - Riesgo de Retraso de Pago</option>
                <option value="MOROSO">
                  MOROSO - Facturas Vencidas / Morosidad
                </option>
              </select>
            </div>

            {/* Notas de Calificación */}
            <div>
              <label className="text-xs font-semibold text-neutral-400  dark:text-neutral-200 block mb-1">
                Observaciones Comerciales
              </label>
              <textarea
                rows={2}
                placeholder="Justificación de la calificación o historial relevante..."
                value={ratingNotesInput}
                onChange={(e) => setRatingNotesInput(e.target.value)}
                className="w-full p-2.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-400  dark:text-neutral-100 rounded-lg focus-visible:ring-2 focus-visible:ring-amber-500 resize-none"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: HISTORIAL COMERCIAL Y ESTADÍSTICAS DEL CLIENTE                   */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title="Historial & Estadísticas Comerciales"
        subtitle={
          historyData
            ? `${historyData.customer.name} (${historyData.customer.docType}-${historyData.customer.docNumber})`
            : "Cargando datos..."
        }
        size="4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (historyData) {
                  navigate(`/customers/${historyData.customer.id}/statement`);
                }
              }}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
              Ver Estado de Cuenta Completo
            </Button>
            <Button size="sm" onClick={() => setIsHistoryModalOpen(false)}>
              Cerrar
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {historyLoading ? (
            <div className="space-y-4 py-8">
              <div className="grid grid-cols-4 gap-3 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 bg-neutral-100 rounded-lg" />
                ))}
              </div>
              <div className="h-40 bg-neutral-100 rounded-lg animate-pulse" />
            </div>
          ) : !historyData ? (
            <div className="text-center py-10 text-neutral-400">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
              <p>No se pudo cargar la información comercial de este cliente</p>
            </div>
          ) : (
            <>
              {/* Banner de Estado & Calificación */}
              <div className="p-3 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800  flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-semibold block">
                      Calificación Asignada
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i <
                            Math.round(historyData.customer.ratingScore || 5)
                              ? "text-amber-500 fill-amber-500"
                              : "text-neutral-300 fill-neutral-300"
                          }`}
                        />
                      ))}
                      <span className="font-bold text-neutral-400  text-xs">
                        {Number(historyData.customer.ratingScore || 5).toFixed(
                          1,
                        )}
                      </span>
                      <span
                        className={`ml-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${getTierBadge(historyData.customer.ratingTier).badgeColor}`}
                      >
                        {getTierBadge(historyData.customer.ratingTier).label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-200">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold block">
                    Calificación Sugerida por Sistema
                  </span>
                  <div className="flex items-center sm:justify-end gap-1.5 mt-0.5">
                    <span className="font-bold text-neutral-400  flex items-center gap-1">
                      <span>
                        {historyData.statistics.suggestedScore.toFixed(1)}
                      </span>
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 inline" />
                      <span>({historyData.statistics.suggestedTier})</span>
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-400 block">
                    {historyData.statistics.suggestedReason}
                  </span>
                </div>
              </div>

              {/* Grid de KPIs Estadísticos */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <Card className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
                  <span className="text-[10px] font-medium text-neutral-500 block">
                    Total Facturado
                  </span>
                  <p className="text-lg font-bold text-neutral-400  font-mono mt-0.5">
                    {formatMoneyUSD(historyData.statistics.totalInvoicedUSD)}
                  </p>
                  <span className="text-[10px] text-neutral-400">
                    {historyData.statistics.invoicesCount} factura(s)
                  </span>
                </Card>

                <Card className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
                  <span className="text-[10px] font-medium text-neutral-500 block">
                    Total Pagado
                  </span>
                  <p className="text-lg font-bold text-emerald-700 font-mono mt-0.5">
                    {formatMoneyUSD(historyData.statistics.totalPaidUSD)}
                  </p>
                  <span className="text-[10px] text-neutral-400">
                    {historyData.statistics.paidInvoicesCount} cancelada(s)
                  </span>
                </Card>

                <Card className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
                  <span className="text-[10px] font-medium text-neutral-500 block">
                    Deuda Actual
                  </span>
                  <p
                    className={`text-lg font-bold font-mono mt-0.5 ${historyData.statistics.currentBalanceUSD > 0 ? "text-amber-700" : "text-neutral-400 "}`}
                  >
                    {formatMoneyUSD(historyData.statistics.currentBalanceUSD)}
                  </p>
                  <span className="text-[10px] text-neutral-400">
                    {historyData.statistics.totalOverdueUSD > 0 ? (
                      <span className="text-rose-600 font-semibold">
                        {formatMoneyUSD(historyData.statistics.totalOverdueUSD)}{" "}
                        en mora
                      </span>
                    ) : (
                      "Sin mora"
                    )}
                  </span>
                </Card>

                <Card className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
                  <span className="text-[10px] font-medium text-neutral-500 block">
                    Puntualidad
                  </span>
                  <p className="text-lg font-bold text-sky-700 font-mono mt-0.5">
                    {historyData.statistics.punctualityRate}%
                  </p>
                  <span className="text-[10px] text-neutral-400">
                    {historyData.statistics.overdueCount > 0
                      ? `${historyData.statistics.overdueCount} atraso(s)`
                      : "100% puntual"}
                  </span>
                </Card>
              </div>

              {/* Pestañas de Histórico */}
              <div className="border-b border-neutral-200 flex items-center gap-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setHistoryActiveTab("invoices")}
                  className={`pb-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    historyActiveTab === "invoices"
                      ? "border-b-2 border-neutral-900 text-neutral-400 "
                      : "text-neutral-500 hover:text-neutral-400 "
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Facturas ({historyData.invoices.length})
                </button>

                <button
                  type="button"
                  onClick={() => setHistoryActiveTab("quotations")}
                  className={`pb-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    historyActiveTab === "quotations"
                      ? "border-b-2 border-neutral-900 text-neutral-400 "
                      : "text-neutral-500 hover:text-neutral-400 "
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Cotizaciones ({historyData.quotations.length})
                </button>

                <button
                  type="button"
                  onClick={() => setHistoryActiveTab("deliveries")}
                  className={`pb-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    historyActiveTab === "deliveries"
                      ? "border-b-2 border-neutral-900 text-neutral-400 "
                      : "text-neutral-500 hover:text-neutral-400 "
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  Notas de Entrega ({historyData.deliveryNotes.length})
                </button>

                <button
                  type="button"
                  onClick={() => setHistoryActiveTab("payments")}
                  className={`pb-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    historyActiveTab === "payments"
                      ? "border-b-2 border-neutral-900 text-neutral-400 "
                      : "text-neutral-500 hover:text-neutral-400 "
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Historial de Pagos ({historyData.payments.length})
                </button>
              </div>

              {/* Contenido de Tab: Facturas */}
              {historyActiveTab === "invoices" && (
                <div className="overflow-x-auto rounded-lg border border-neutral-200">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase  tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                      <tr>
                        <th className="py-2 px-3">Factura</th>
                        <th className="py-2 px-3">Fecha</th>
                        <th className="py-2 px-3 text-right">Monto</th>
                        <th className="py-2 px-3 text-right">Saldo</th>
                        <th className="py-2 px-3 text-center">Modalidad</th>
                        <th className="py-2 px-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {historyData.invoices.length === 0 ? (
                        <tr className="border-b border-neutral-100 dark:border-neutral-800">
                          <td
                            colSpan={6}
                            className="py-6 text-center text-neutral-400"
                          >
                            Sin facturas emitidas
                          </td>
                        </tr>
                      ) : (
                        historyData.invoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-neutral-50/50">
                            <td className="py-2 px-3 font-mono font-medium text-neutral-400 ">
                              {inv.invoiceNumber}
                              {inv.controlNumber && (
                                <span className="block text-[10px] text-neutral-400">
                                  {inv.controlNumber}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-neutral-400 ">
                              {formatSafeDate(inv.invoiceDate)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-neutral-400 ">
                              {formatMoneyUSD(inv.totalAmount)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {inv.amountBalance && inv.amountBalance > 0 ? (
                                <span className="text-amber-700 font-bold">
                                  {formatMoneyUSD(inv.amountBalance)}
                                </span>
                              ) : (
                                <span className="text-neutral-400">$0.00</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <Badge
                                variant={inv.isCredit ? "warning" : "neutral"}
                                className="text-[10px]"
                              >
                                {inv.isCredit ? "Crédito" : "Contado"}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <Badge
                                variant={
                                  inv.status === "PAID"
                                    ? "success"
                                    : inv.status === "ANNULLED"
                                      ? "danger"
                                      : "warning"
                                }
                                className="text-[10px]"
                              >
                                {inv.status === "PAID"
                                  ? "Pagada"
                                  : inv.status === "ANNULLED"
                                    ? "Anulada"
                                    : "Pendiente"}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Contenido de Tab: Cotizaciones */}
              {historyActiveTab === "quotations" && (
                <div className="overflow-x-auto rounded-lg border border-neutral-200">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase  tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                      <tr>
                        <th className="py-2 px-3">Cotización</th>
                        <th className="py-2 px-3">Fecha</th>
                        <th className="py-2 px-3">Vence</th>
                        <th className="py-2 px-3 text-right">Monto Total</th>
                        <th className="py-2 px-3 text-center">Ítems</th>
                        <th className="py-2 px-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {historyData.quotations.length === 0 ? (
                        <tr className="border-b border-neutral-100 dark:border-neutral-800">
                          <td
                            colSpan={6}
                            className="py-6 text-center text-neutral-400"
                          >
                            Sin cotizaciones registradas
                          </td>
                        </tr>
                      ) : (
                        historyData.quotations.map((q) => (
                          <tr key={q.id} className="hover:bg-neutral-50/50">
                            <td className="py-2 px-3 font-mono font-medium text-neutral-400 ">
                              {q.quotationNumber}
                            </td>
                            <td className="py-2 px-3 text-neutral-400 ">
                              {formatSafeDate(q.quotationDate)}
                            </td>
                            <td className="py-2 px-3 text-neutral-500">
                              {formatSafeDate(q.validUntilDate)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-neutral-400 ">
                              {formatMoneyUSD(q.totalAmount)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {q.itemsCount}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <Badge
                                variant={
                                  q.status === "CONVERTED"
                                    ? "success"
                                    : q.status === "EXPIRED"
                                      ? "danger"
                                      : "neutral"
                                }
                                className="text-[10px]"
                              >
                                {q.status === "CONVERTED"
                                  ? "Facturada"
                                  : q.status === "EMITTED"
                                    ? "Emitida"
                                    : q.status}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Contenido de Tab: Notas de Entrega */}
              {historyActiveTab === "deliveries" && (
                <div className="overflow-x-auto rounded-lg border border-neutral-200">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase  tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                      <tr>
                        <th className="py-2 px-3">Nota de Entrega</th>
                        <th className="py-2 px-3">Fecha</th>
                        <th className="py-2 px-3">Chofer / Placa</th>
                        <th className="py-2 px-3 text-right">Total</th>
                        <th className="py-2 px-3 text-center">Ítems</th>
                        <th className="py-2 px-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {historyData.deliveryNotes.length === 0 ? (
                        <tr className="border-b border-neutral-100 dark:border-neutral-800">
                          <td
                            colSpan={6}
                            className="py-6 text-center text-neutral-400"
                          >
                            Sin notas de entrega registradas
                          </td>
                        </tr>
                      ) : (
                        historyData.deliveryNotes.map((d) => (
                          <tr key={d.id} className="hover:bg-neutral-50/50">
                            <td className="py-2 px-3 font-mono font-medium text-neutral-400 ">
                              {d.deliveryNumber}
                            </td>
                            <td className="py-2 px-3 text-neutral-400 ">
                              {formatSafeDate(d.deliveryDate)}
                            </td>
                            <td className="py-2 px-3 text-neutral-600">
                              {d.driverName
                                ? `${d.driverName} (${d.vehiclePlate || "S/P"})`
                                : "-"}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-neutral-400 ">
                              {formatMoneyUSD(d.totalAmount)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {d.itemsCount}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <Badge
                                variant={
                                  d.status === "INVOICED"
                                    ? "success"
                                    : d.status === "ANNULLED"
                                      ? "danger"
                                      : "warning"
                                }
                                className="text-[10px]"
                              >
                                {d.status === "INVOICED"
                                  ? "Facturada"
                                  : d.status === "DELIVERED"
                                    ? "Entregada"
                                    : d.status}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Contenido de Tab: Historial de Pagos */}
              {historyActiveTab === "payments" && (
                <div className="overflow-x-auto rounded-lg border border-neutral-200">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase  tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                      <tr>
                        <th className="py-2 px-3">Fecha</th>
                        <th className="py-2 px-3">Factura</th>
                        <th className="py-2 px-3">Método</th>
                        <th className="py-2 px-3 text-right">Monto (USD)</th>
                        <th className="py-2 px-3 text-right">Monto (VES)</th>
                        <th className="py-2 px-3">Cuenta / Banco</th>
                        <th className="py-2 px-3">Referencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {historyData.payments.length === 0 ? (
                        <tr className="border-b border-neutral-100 dark:border-neutral-800">
                          <td
                            colSpan={7}
                            className="py-6 text-center text-neutral-400"
                          >
                            Sin pagos registrados
                          </td>
                        </tr>
                      ) : (
                        historyData.payments.map((p) => (
                          <tr key={p.id} className="hover:bg-neutral-50/50">
                            <td className="py-2 px-3 text-neutral-400 ">
                              {formatSafeDate(p.createdAt)}
                            </td>
                            <td className="py-2 px-3 font-mono font-medium text-neutral-400 ">
                              {p.invoiceNumber}
                            </td>
                            <td className="py-2 px-3 font-medium text-neutral-400 ">
                              {p.method}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-neutral-400 ">
                              {formatMoneyUSD(p.amountUSD)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-neutral-600">
                              {formatMoneyVES(p.amountVES)}
                            </td>
                            <td className="py-2 px-3 text-neutral-600">
                              {p.bankName ? `${p.bankName}` : "Caja Efectivo"}
                              {p.bankAccountNumber &&
                                ` (...${p.bankAccountNumber.slice(-4)})`}
                            </td>
                            <td className="py-2 px-3 font-mono text-neutral-600">
                              {p.referenceNumber || "-"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
