import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { toast } from "sonner";
import { formatMoneyUSD } from "../../utils/formatters";
import {
  Truck,
  Search,
  Plus,
  FileSpreadsheet,
  X,
  Building2,
  Phone,
  Mail,
  Receipt,
  DollarSign,
  Clock,
  Edit2,
  Package,
  History,
  LayoutGrid,
  Table as TableIcon,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Star,
  Trash2,
  User,
  ShoppingBag,
  ExternalLink,
  Sparkles,
  Loader2,
  Landmark,
  CreditCard,
  Smartphone,
  Copy,
  Check,
} from "lucide-react";

interface Supplier {
  id: string;
  rif: string;
  name: string;
  commercialName?: string;
  contactName?: string;
  fiscalAddress?: string;
  phone?: string;
  email?: string;
  isPersonNatural: boolean;
  isResident: boolean;
  islrConceptCode?: string;
  creditLimit: number;
  paymentTermsDays: number;
  isActive: boolean;
  createdAt?: string;
  currentBalance: number;
  pendingPayablesCount: number;
  totalPurchasesAmount?: number;
  totalPurchasesCount?: number;
  lastPurchaseDate?: string;
  productsCount?: number;
  bankName?: string | null;
  accountNumber?: string | null;
  accountType?: string | null;
  accountHolderName?: string | null;
  accountHolderId?: string | null;
  pagoMovilBank?: string | null;
  pagoMovilPhone?: string | null;
  pagoMovilId?: string | null;
  zelleEmail?: string | null;
  zelleHolderName?: string | null;
  bankNotes?: string | null;
}

interface SupplierProduct {
  id: string;
  supplierId: string;
  productId: string;
  productName: string;
  sku: string;
  barcode?: string;
  brandName?: string | null;
  unitSymbol?: string | null;
  departmentName?: string | null;
  supplierProductCode?: string | null;
  costPriceUsd: number;
  deliveryLeadTimeDays: number;
  isPreferred: boolean;
  notes?: string | null;
}

interface HistoryItem {
  id: string;
  type: "PURCHASE_ORDER" | "GOODS_RECEIPT" | "PURCHASE_INVOICE" | "PAYMENT";
  reference: string;
  date: string;
  totalAmount: number;
  currency: string;
  status: string;
  notes?: string | null;
  branchName?: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  lastCostUsd?: number;
  costPriceUsd?: number;
}

export const VENEZUELAN_BANKS = [
  { code: '0102', name: 'Banco de Venezuela S.A.C.A.' },
  { code: '0134', name: 'Banesco Banco Universal' },
  { code: '0105', name: 'Banco Mercantil C.A.' },
  { code: '0108', name: 'BBVA Banco Provincial' },
  { code: '0172', name: 'Bancamiga Banco Universal' },
  { code: '0191', name: 'Banco Nacional de Crédito (BNC)' },
  { code: '0114', name: 'Bancaribe C.A.' },
  { code: '0115', name: 'Banco Exterior C.A.' },
  { code: '0171', name: 'Banco Activo Banco Universal' },
  { code: '0166', name: 'Banco Agrícola de Venezuela' },
  { code: '0175', name: 'Banco Bicentenario del Pueblo' },
  { code: '0128', name: 'Banco Caroní C.A.' },
  { code: '0163', name: 'Banco del Tesoro' },
  { code: '0174', name: 'Banplus Banco Universal' },
  { code: '0151', name: 'BFC Banco Fondo Común' },
  { code: '0156', name: '100% Banco' },
  { code: '0138', name: 'Banco Plaza' },
  { code: '0137', name: 'Banco Sofitasa' },
  { code: '0169', name: 'Mi Banco' },
  { code: '0177', name: 'BANFANB' },
  { code: 'OTHER', name: 'Otro Banco / Internacional' },
];

export const SuppliersView: React.FC = () => {
  const navigate = useNavigate();
  const { token, hasPermission } = useAuthStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & View Mode
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [debtFilter, setDebtFilter] = useState<"all" | "with_debt" | "solvent">("all");
  const [creditFilter, setCreditFilter] = useState<"all" | "credit" | "cash">("all");
  const [viewMode, setViewMode] = useState<"detailed" | "summary">("detailed");

  // Supplier Form Modal (Create / Edit)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [formActiveTab, setFormActiveTab] = useState<"fiscal" | "banking">("fiscal");
  const [formData, setFormData] = useState({
    rif: "",
    name: "",
    commercialName: "",
    contactName: "",
    fiscalAddress: "",
    phone: "",
    email: "",
    isPersonNatural: false,
    isResident: true,
    islrConceptCode: "SERV_IND",
    creditLimit: 0,
    paymentTermsDays: 15,
    isActive: true,
    bankName: "",
    accountNumber: "",
    accountType: "CURRENT",
    accountHolderName: "",
    accountHolderId: "",
    pagoMovilBank: "",
    pagoMovilPhone: "",
    pagoMovilId: "",
    zelleEmail: "",
    zelleHolderName: "",
    bankNotes: "",
  });

  // Modal Ficha Bancaria Rápida
  const [selectedSupplierForBankInfo, setSelectedSupplierForBankInfo] = useState<Supplier | null>(null);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyText = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Diagnóstico y Autocompletado de RIF SENIAT
  const [isLookingUpRif, setIsLookingUpRif] = useState(false);
  const [rifDiagnostic, setRifDiagnostic] = useState<{
    isValidChecksum?: boolean;
    source?: string;
    seniatPortalUrl?: string;
    message?: string;
  } | null>(null);

  const handleLookupRif = async (targetRif?: string) => {
    const queryRif = (targetRif || formData.rif || '').trim();
    if (!queryRif || queryRif.length < 3) return;

    setIsLookingUpRif(true);
    try {
      const res = await fetch(`/api/suppliers/lookup-rif/${encodeURIComponent(queryRif)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          setFormData((prev) => ({
            ...prev,
            rif: d.formattedRif || prev.rif,
            name: d.supplier?.name || prev.name,
            commercialName: d.supplier?.commercialName || prev.commercialName,
            fiscalAddress: d.supplier?.fiscalAddress || prev.fiscalAddress,
            contactName: d.supplier?.contactName || prev.contactName,
            phone: d.supplier?.phone || prev.phone,
            email: d.supplier?.email || prev.email,
            isPersonNatural: d.supplier?.isPersonNatural ?? d.isPersonNatural ?? prev.isPersonNatural,
            isResident: d.supplier?.isResident ?? d.isResident ?? prev.isResident,
            islrConceptCode: d.supplier?.islrConceptCode || prev.islrConceptCode,
          }));

          let sourceLabel = 'Algoritmo SENIAT (Módulo 11)';
          if (d.source === 'existing_supplier') sourceLabel = 'Registro previo de proveedor';
          else if (d.source === 'existing_customer') sourceLabel = 'Directorio de clientes (cruce fiscal)';
          else if (d.source === 'external_api') sourceLabel = 'API SENIAT Externa';

          setRifDiagnostic({
            isValidChecksum: d.isValidChecksum,
            source: d.source,
            seniatPortalUrl: d.seniatPortalUrl,
            message: d.foundInDatabase
              ? `Datos autocompletados desde: ${sourceLabel}`
              : d.isValidChecksum
                ? `Formato y Módulo 11 válidos (${d.personType}). Corrobore en SENIAT para verificar razón social.`
                : `Atención: El dígito verificador no coincide con la fórmula matemática del SENIAT.`,
          });

          if (d.foundInDatabase) {
            toast.success(`Datos fiscales autocompletados desde ${sourceLabel}`);
          }
        }
      }
    } catch (err: any) {
      console.warn('Error en lookup RIF:', err);
    } finally {
      setIsLookingUpRif(false);
    }
  };

  // Supplier Products Modal
  const [isProductsModalOpen, setIsProductsModalOpen] = useState(false);
  const [selectedSupplierForProducts, setSelectedSupplierForProducts] = useState<Supplier | null>(null);
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productCodeInput, setProductCodeInput] = useState("");
  const [costPriceInput, setCostPriceInput] = useState<number>(0);
  const [leadTimeInput, setLeadTimeInput] = useState<number>(0);
  const [isPreferredInput, setIsPreferredInput] = useState(false);
  const [productNotesInput, setProductNotesInput] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);

  // Supplier History Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedSupplierForHistory, setSelectedSupplierForHistory] = useState<Supplier | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>("ALL");

  const canCreate = hasPermission("suppliers", "create");
  const canUpdate = hasPermission("suppliers", "update");

  // Fetch Suppliers with active filters
  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append("q", search.trim());
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (debtFilter !== "all") params.append("debtStatus", debtFilter);
      if (creditFilter !== "all") params.append("creditTerms", creditFilter);

      const res = await fetch(`/api/suppliers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setSuppliers(json.data || []);
      } else {
        setSuppliers([]);
      }
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuppliers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter, debtFilter, creditFilter]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingSupplierId(null);
    setRifDiagnostic(null);
    setFormActiveTab("fiscal");
    setFormData({
      rif: "",
      name: "",
      commercialName: "",
      contactName: "",
      fiscalAddress: "",
      phone: "",
      email: "",
      isPersonNatural: false,
      isResident: true,
      islrConceptCode: "SERV_IND",
      creditLimit: 0,
      paymentTermsDays: 15,
      isActive: true,
      bankName: "",
      accountNumber: "",
      accountType: "CURRENT",
      accountHolderName: "",
      accountHolderId: "",
      pagoMovilBank: "",
      pagoMovilPhone: "",
      pagoMovilId: "",
      zelleEmail: "",
      zelleHolderName: "",
      bankNotes: "",
    });
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (sup: Supplier) => {
    setEditingSupplierId(sup.id);
    setRifDiagnostic(null);
    setFormActiveTab("fiscal");
    setFormData({
      rif: sup.rif || "",
      name: sup.name || "",
      commercialName: sup.commercialName || "",
      contactName: sup.contactName || "",
      fiscalAddress: sup.fiscalAddress || "",
      phone: sup.phone || "",
      email: sup.email || "",
      isPersonNatural: Boolean(sup.isPersonNatural),
      isResident: Boolean(sup.isResident),
      islrConceptCode: sup.islrConceptCode || "SERV_IND",
      creditLimit: sup.creditLimit || 0,
      paymentTermsDays: sup.paymentTermsDays || 0,
      isActive: Boolean(sup.isActive),
      bankName: sup.bankName || "",
      accountNumber: sup.accountNumber || "",
      accountType: sup.accountType || "CURRENT",
      accountHolderName: sup.accountHolderName || "",
      accountHolderId: sup.accountHolderId || "",
      pagoMovilBank: sup.pagoMovilBank || "",
      pagoMovilPhone: sup.pagoMovilPhone || "",
      pagoMovilId: sup.pagoMovilId || "",
      zelleEmail: sup.zelleEmail || "",
      zelleHolderName: sup.zelleHolderName || "",
      bankNotes: sup.bankNotes || "",
    });
    setIsFormModalOpen(true);
  };

  // Submit Supplier (Create or Edit)
  const handleSubmitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.rif.trim() || !formData.name.trim()) {
      toast.error("El RIF y la Razón Social son campos requeridos");
      return;
    }

    try {
      const url = editingSupplierId ? `/api/suppliers/${editingSupplierId}` : "/api/suppliers";
      const method = editingSupplierId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success(
          editingSupplierId
            ? "Proveedor actualizado correctamente"
            : "Proveedor registrado correctamente"
        );
        setIsFormModalOpen(false);
        fetchSuppliers();
      } else {
        const err = await res.json();
        toast.error(err.error?.message || "Error al procesar el proveedor");
      }
    } catch (err: any) {
      toast.error(err.message || "Error de conexión al guardar el proveedor");
    }
  };

  // --- SUPPLIER PRODUCTS MODAL HANDLERS ---
  const handleOpenProductsModal = async (sup: Supplier) => {
    setSelectedSupplierForProducts(sup);
    setIsProductsModalOpen(true);
    setLoadingProducts(true);
    setSelectedProductId("");
    setProductCodeInput("");
    setCostPriceInput(0);
    setLeadTimeInput(0);
    setIsPreferredInput(false);
    setProductNotesInput("");

    try {
      // 1. Fetch supplier products
      const pRes = await fetch(`/api/suppliers/${sup.id}/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (pRes.ok) {
        const json = await pRes.json();
        setSupplierProducts(json.data || []);
      }

      // 2. Fetch catalog products for selector
      const catRes = await fetch(`/api/inventory/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (catRes.ok) {
        const catJson = await catRes.json();
        setCatalogProducts(catJson.data || []);
      }
    } catch (error) {
      toast.error("Error al cargar los productos del proveedor");
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleSelectCatalogProduct = (productId: string) => {
    setSelectedProductId(productId);
    const prod = catalogProducts.find((p) => p.id === productId);
    if (prod) {
      const cost = prod.lastCostUsd ?? prod.costPriceUsd ?? 0;
      setCostPriceInput(cost);
    }
  };

  const handleSaveSupplierProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierForProducts || !selectedProductId) {
      toast.error("Debe seleccionar un producto del catálogo");
      return;
    }

    setSavingProduct(true);
    try {
      const payload = {
        productId: selectedProductId,
        supplierProductCode: productCodeInput.trim() || undefined,
        costPriceUsd: Number(costPriceInput || 0),
        deliveryLeadTimeDays: Number(leadTimeInput || 0),
        isPreferred: isPreferredInput,
        notes: productNotesInput.trim() || undefined,
      };

      const res = await fetch(`/api/suppliers/${selectedSupplierForProducts.id}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        setSupplierProducts(json.data || []);
        toast.success("Producto vinculado al proveedor");
        setSelectedProductId("");
        setProductCodeInput("");
        setCostPriceInput(0);
        setLeadTimeInput(0);
        setIsPreferredInput(false);
        setProductNotesInput("");
        fetchSuppliers();
      } else {
        const err = await res.json();
        toast.error(err.error?.message || "Error al asociar el producto");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al asociar producto");
    } finally {
      setSavingProduct(false);
    }
  };

  const handleRemoveSupplierProduct = async (productId: string) => {
    if (!selectedSupplierForProducts) return;
    try {
      const res = await fetch(`/api/suppliers/${selectedSupplierForProducts.id}/products/${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Producto desvinculado");
        setSupplierProducts((prev) => prev.filter((p) => p.productId !== productId));
        fetchSuppliers();
      } else {
        toast.error("Error al desvincular producto");
      }
    } catch {
      toast.error("Error de conexión al desvincular producto");
    }
  };

  // --- SUPPLIER HISTORY MODAL HANDLERS ---
  const handleOpenHistoryModal = async (sup: Supplier) => {
    setSelectedSupplierForHistory(sup);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    setHistoryTypeFilter("ALL");

    try {
      const res = await fetch(`/api/suppliers/${sup.id}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setHistoryItems(json.data?.history || []);
      } else {
        setHistoryItems([]);
      }
    } catch {
      setHistoryItems([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Filtered catalog products for dropdown search
  const filteredCatalogProducts = useMemo(() => {
    if (!catalogSearch.trim()) return catalogProducts.slice(0, 50);
    const q = catalogSearch.toLowerCase();
    return catalogProducts
      .filter((p) => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)))
      .slice(0, 50);
  }, [catalogProducts, catalogSearch]);

  // Filtered history items
  const filteredHistory = useMemo(() => {
    if (historyTypeFilter === "ALL") return historyItems;
    return historyItems.filter((item) => item.type === historyTypeFilter);
  }, [historyItems, historyTypeFilter]);

  // Aggregated KPIs
  const totalBalance = suppliers.reduce((sum, s) => sum + s.currentBalance, 0);
  const withDebtCount = suppliers.filter((s) => s.currentBalance > 0).length;
  const activeSuppliersCount = suppliers.filter((s) => s.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-800 dark:text-neutral-100 tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-sky-600" />
            Directorio de Proveedores
          </h1>
          <p className="text-sm text-neutral-500">
            Administración de acreedores comerciales, catálogo de productos por proveedor y cuentas por pagar
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/supplier-notes")}
            className="flex-1 sm:flex-none rounded-lg"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1 text-emerald-600" />
            Notas Crédito / Débito
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/payables")}
            className="flex-1 sm:flex-none rounded-lg"
          >
            <Clock className="w-4 h-4 mr-1 text-neutral-600" />
            Ver CxP
          </Button>
          {canCreate && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 border-[#007BFF] dark:border-[#3D91FF] rounded-lg bg-blue-50 dark:bg-blue-600/30 hover:bg-border-blue-600 dark:hover:border-blue-500 flex-1 sm:flex-none"
              title="Nuevo Proveedor"
            >
              <Plus className="w-4 h-4 text-blue-600 dark:blue-500 mr-1" />
              Nuevo Proveedor
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Total Proveedores
              </p>
              <p className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mt-1">
                {suppliers.length}
              </p>
              <span className="text-xs text-neutral-500">{activeSuppliersCount} activos</span>
            </div>
            <div className="p-2 bg-[#007BFF]/10 text-[#007BFF] dark:bg-[#3D91FF]/15 dark:text-[#3D91FF] rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#FFC107] dark:border-l-[#FBBF24] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Con Saldo Pendiente
              </p>
              <p className="text-2xl font-bold text-[#b28500] dark:text-[#FBBF24] mt-1 font-mono">
                {withDebtCount}
              </p>
              <span className="text-xs text-neutral-500">
                {suppliers.length - withDebtCount} solventes
              </span>
            </div>
            <div className="p-2 bg-[#FFC107]/15 text-[#b28500] dark:bg-[#FBBF24]/15 dark:text-[#FBBF24] rounded-lg">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-red-500 dark:border-l-red-400 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Deuda Total CxP
              </p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {formatMoneyUSD(totalBalance)}
              </p>
              <span className="text-xs text-neutral-500">Saldo pendiente de pago</span>
            </div>
            <div className="p-2 bg-red-50 dark:bg-red-950/40 rounded-lg text-red-600 dark:text-red-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#17A2B8] dark:border-l-[#38C9DD] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Plazo Promedio
              </p>
              <p className="text-2xl font-bold text-[#17A2B8] dark:text-[#38C9DD] mt-1 font-mono">
                {suppliers.length > 0
                  ? Math.round(
                      suppliers.reduce((a, b) => a + (b.paymentTermsDays || 0), 0) /
                        suppliers.length
                    )
                  : 0}{" "}
                días
              </p>
              <span className="text-xs text-neutral-500">Término de pago comercial</span>
            </div>
            <div className="p-2 bg-[#17A2B8]/10 text-[#17A2B8] dark:bg-[#38C9DD]/15 dark:text-[#38C9DD] rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Control Bar: Filters & View Switcher */}
      <Card className="p-4 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-lg">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar por RIF, razón social, comercial, contacto, teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 bg-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="py-2 px-3 text-xs border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-neutral-800 dark:text-neutral-200"
            >
              <option value="all">Todos los Estados</option>
              <option value="active">Solo Activos</option>
              <option value="inactive">Solo Inactivos</option>
            </select>

            {/* Debt Filter */}
            <select
              value={debtFilter}
              onChange={(e) => setDebtFilter(e.target.value as any)}
              className="py-2 px-3 text-xs border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-neutral-800 dark:text-neutral-200"
            >
              <option value="all">Todas las Deudas</option>
              <option value="with_debt">Con Saldo Pendiente</option>
              <option value="solvent">Solventes ($0)</option>
            </select>

            {/* Credit Filter */}
            <select
              value={creditFilter}
              onChange={(e) => setCreditFilter(e.target.value as any)}
              className="py-2 px-3 text-xs border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-neutral-800 dark:text-neutral-200"
            >
              <option value="all">Todos los Términos</option>
              <option value="credit">A Crédito (&gt; 0 días)</option>
              <option value="cash">Contado (0 días)</option>
            </select>

            {/* View Mode Switcher */}
            <div className="flex items-center border border-neutral-300 dark:border-neutral-700 rounded-lg overflow-hidden p-0.5 bg-neutral-100 dark:bg-neutral-800 ml-auto sm:ml-0">
              <button
                type="button"
                onClick={() => setViewMode("detailed")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === "detailed"
                    ? "bg-white dark:bg-neutral-900 text-sky-600 dark:text-sky-400 shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
                }`}
                title="Vista Detallada (Tabla)"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Detallado</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("summary")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === "summary"
                    ? "bg-white dark:bg-neutral-900 text-sky-600 dark:text-sky-400 shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
                }`}
                title="Vista Resumida (Tarjetas)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Resumido</span>
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* VIEW: RESUMIDO (Summary Cards Grid) */}
      {viewMode === "summary" && (
        <div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 animate-pulse">
                  <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-48 mb-2" />
                  <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded w-24 mb-4" />
                  <div className="space-y-2">
                    <div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-full" />
                    <div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-3/4" />
                  </div>
                </Card>
              ))}
            </div>
          ) : suppliers.length === 0 ? (
            <Card className="p-12 text-center rounded-lg border border-neutral-200 dark:border-neutral-800">
              <Truck className="w-10 h-10 mx-auto mb-2 text-neutral-400" />
              <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                No se encontraron proveedores
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Ajusta los filtros de búsqueda o agrega un nuevo proveedor.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suppliers.map((sup) => (
                <Card
                  key={sup.id}
                  className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col justify-between hover:border-neutral-300 dark:hover:border-neutral-700 transition-all"
                >
                  <div>
                    {/* Top Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 leading-snug">
                          {sup.name}
                        </h3>
                        {sup.commercialName && (
                          <p className="text-xs text-neutral-500 font-medium">
                            {sup.commercialName}
                          </p>
                        )}
                        <span className="text-xs font-mono font-medium text-sky-600 dark:text-sky-400">
                          {sup.rif}
                        </span>
                      </div>
                      <Badge variant={sup.isActive ? "success" : "neutral"}>
                        {sup.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>

                    {/* Contact & Fiscal Details */}
                    <div className="mt-3 space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                      {sup.contactName && (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          <span className="truncate">{sup.contactName}</span>
                        </div>
                      )}
                      {sup.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          <span>{sup.phone}</span>
                        </div>
                      )}
                      {sup.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          <span className="truncate">{sup.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Banking Details Preview */}
                    {Boolean(sup.bankName || sup.accountNumber || sup.pagoMovilPhone || sup.zelleEmail) && (
                      <div className="mt-2.5 p-2 rounded-lg bg-sky-50/70 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 text-[11px]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sky-800 dark:text-sky-300 flex items-center gap-1 text-[11px]">
                            <Landmark className="w-3 h-3 text-sky-600" />
                            Datos Bancarios
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSupplierForBankInfo(sup);
                              setIsBankModalOpen(true);
                            }}
                            className="text-[10px] text-sky-600 dark:text-sky-400 font-medium hover:underline cursor-pointer"
                          >
                            Ver Ficha
                          </button>
                        </div>
                        {sup.accountNumber && (
                          <div className="font-mono text-neutral-700 dark:text-neutral-300 truncate" title={`${sup.bankName || 'Banco'}: ${sup.accountNumber}`}>
                            {sup.bankName ? `${sup.bankName}: ` : ''}{sup.accountNumber}
                          </div>
                        )}
                        {sup.pagoMovilPhone && !sup.accountNumber && (
                          <div className="text-neutral-700 dark:text-neutral-300 truncate">
                            Pago Móvil: {sup.pagoMovilPhone} ({sup.pagoMovilBank || 'Banco'})
                          </div>
                        )}
                        {sup.zelleEmail && !sup.accountNumber && !sup.pagoMovilPhone && (
                          <div className="text-neutral-700 dark:text-neutral-300 truncate">
                            Zelle: {sup.zelleEmail}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Financial & Catalog Stats */}
                    <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-neutral-500 block">Saldo CxP:</span>
                        {sup.currentBalance > 0 ? (
                          <span className="font-bold text-red-600 font-mono">
                            {formatMoneyUSD(sup.currentBalance)}
                          </span>
                        ) : (
                          <span className="font-semibold text-emerald-600 font-mono">
                            Solvente ($0.00)
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Término de Pago:</span>
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          {sup.paymentTermsDays > 0 ? `${sup.paymentTermsDays} días` : "Contado"}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Productos:</span>
                        <span className="font-semibold text-sky-600 dark:text-sky-400">
                          {sup.productsCount ?? 0} registrados
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Compras:</span>
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          {sup.totalPurchasesCount ?? 0} facturas
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Footer */}
                  <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenProductsModal(sup)}
                        className="h-7 text-xs px-2 rounded-lg"
                        title="Ver productos asociados"
                      >
                        <Package className="w-3.5 h-3.5 mr-1 text-sky-600" />
                        Productos
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenHistoryModal(sup)}
                        className="h-7 text-xs px-2 rounded-lg"
                        title="Ver historial de operaciones"
                      >
                        <History className="w-3.5 h-3.5 mr-1 text-amber-600" />
                        Histórico
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedSupplierForBankInfo(sup);
                          setIsBankModalOpen(true);
                        }}
                        className="h-7 text-xs px-2 rounded-lg"
                        title="Ver ficha bancaria del proveedor"
                      >
                        <Landmark className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        Bancos
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      {canUpdate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditModal(sup)}
                          className="h-7 text-xs px-2 rounded-lg"
                          title="Editar información"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" />
                          Editar
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/suppliers/${sup.id}/statement`)}
                        className="h-7 text-xs px-2 rounded-lg text-neutral-700 dark:text-neutral-300"
                        title="Estado de Cuenta"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: DETALLADO (Data Table) */}
      {viewMode === "detailed" && (
        <Card className="border-gray-200 dark:border-gray-800 overflow-hidden rounded-lg bg-white dark:bg-[#1E1F21] shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-[#F4F6F9] dark:bg-[#18191A] text-neutral-700 dark:text-neutral-300 uppercase font-semibold text-[10px] tracking-wider border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4">RIF / Proveedor</th>
                  <th className="py-3 px-4">Contacto</th>
                  <th className="py-3 px-4">Condición Fiscal</th>
                  <th className="py-3 px-4 text-center">Términos Crédito</th>
                  <th className="py-3 px-4 text-right">Saldo Deudor</th>
                  <th className="py-3 px-4 text-center">Catálogo</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-4">
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-36 mb-1.5" />
                        <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded w-20" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-28" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-20" />
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-16 mx-auto" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-20 ml-auto" />
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-12 mx-auto" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-36 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-neutral-400">
                      <Truck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="font-medium text-neutral-600 dark:text-neutral-400">
                        No se encontraron proveedores
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Intenta con otro término de búsqueda o ajusta los filtros.
                      </p>
                    </td>
                  </tr>
                ) : (
                  suppliers.map((sup) => (
                    <tr
                      key={sup.id}
                      className="hover:bg-[#F4F6F9]/80 dark:hover:bg-neutral-800/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {sup.name}
                        </div>
                        {sup.commercialName && (
                          <div className="text-xs text-neutral-500 font-medium">
                            {sup.commercialName}
                          </div>
                        )}
                        <div className="text-xs font-mono font-bold text-[#007BFF] dark:text-[#3D91FF] mt-0.5">
                          {sup.rif}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {sup.contactName && (
                          <div className="font-medium text-neutral-800 dark:text-neutral-200">
                            {sup.contactName}
                          </div>
                        )}
                        {sup.phone && (
                          <div className="flex items-center gap-1 text-neutral-600 dark:text-neutral-400 mt-0.5">
                            <Phone className="w-3.5 h-3.5 text-neutral-400" />
                            {sup.phone}
                          </div>
                        )}
                        {sup.email && (
                          <div className="flex items-center gap-1 text-neutral-500 mt-0.5">
                            <Mail className="w-3.5 h-3.5 text-neutral-400" />
                            <span className="truncate max-w-[180px]">{sup.email}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="neutral">
                            {sup.isPersonNatural ? "Natural" : "Jurídica"}
                          </Badge>
                          <Badge variant={sup.isResident ? "success" : "warning"}>
                            {sup.isResident ? "Domiciliado" : "No Dom."}
                          </Badge>
                          <Badge variant={sup.isActive ? "success" : "neutral"}>
                            {sup.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="font-medium text-neutral-800 dark:text-neutral-200 text-xs">
                          {sup.paymentTermsDays > 0 ? `${sup.paymentTermsDays} días` : "Contado"}
                        </div>
                        {sup.creditLimit > 0 && (
                          <div className="text-[11px] text-neutral-500">
                            Límite: {formatMoneyUSD(sup.creditLimit)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {sup.currentBalance > 0 ? (
                          <div>
                            <span className="font-bold text-red-600 font-mono text-xs">
                              {formatMoneyUSD(sup.currentBalance)}
                            </span>
                            {sup.pendingPayablesCount > 0 && (
                              <div className="text-[11px] text-amber-600">
                                {sup.pendingPayablesCount} facturas pend.
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-emerald-600 font-mono text-xs font-semibold">
                            Solvente ($0)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenProductsModal(sup)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors"
                        >
                          <Package className="w-3.5 h-3.5" />
                          <span>{sup.productsCount ?? 0}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenHistoryModal(sup)}
                            className="h-8 text-xs px-2 rounded-lg"
                            title="Historial de compras y pagos"
                          >
                            <History className="w-3.5 h-3.5 text-amber-600 mr-1" />
                            Histórico
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSupplierForBankInfo(sup);
                              setIsBankModalOpen(true);
                            }}
                            className="h-8 text-xs px-2 rounded-lg"
                            title="Ver ficha bancaria del proveedor"
                          >
                            <Landmark className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                            Bancos
                          </Button>

                          {canUpdate && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditModal(sup)}
                              className="h-8 text-xs px-2 rounded-lg"
                              title="Editar proveedor"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/suppliers/${sup.id}/statement`)}
                            className="h-8 text-xs px-2 rounded-lg text-neutral-700 dark:text-neutral-300"
                            title="Estado de Cuenta"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL: REGISTRAR / EDITAR PROVEEDOR */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingSupplierId ? "Editar Proveedor" : "Registrar Nuevo Proveedor"}
        subtitle="Gestión de compras, datos fiscales SENIAT y condiciones comerciales"
        size="2xl"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="rounded-lg"
            >
              Cancelar
            </Button>
            <Button size="sm" type="submit" form="supplierForm" className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white">
              {editingSupplierId ? "Actualizar Proveedor" : "Guardar Proveedor"}
            </Button>
          </div>
        }
      >
        <form
          id="supplierForm"
          onSubmit={handleSubmitSupplier}
          className="space-y-4 text-xs"
        >
          {/* Navegación por Pestañas: Fiscal/Comercial vs Información Bancaria */}
          <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2">
            <button
              type="button"
              onClick={() => setFormActiveTab("fiscal")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                formActiveTab === "fiscal"
                  ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Datos Fiscales y Comerciales</span>
            </button>
            <button
              type="button"
              onClick={() => setFormActiveTab("banking")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                formActiveTab === "banking"
                  ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>Información Bancaria para Pagos</span>
              {Boolean(formData.accountNumber || formData.pagoMovilPhone || formData.zelleEmail) && (
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              )}
            </button>
          </div>

          {formActiveTab === "fiscal" ? (
            <div className="space-y-4">
              {/* RIF y Datos Fiscales SENIAT */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    RIF (Fiscal SENIAT) *
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleLookupRif()}
                      disabled={isLookingUpRif || !formData.rif.trim()}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors disabled:opacity-50 cursor-pointer"
                      title="Validar formato Módulo 11 y autocompletar desde el directorio interno"
                    >
                      {isLookingUpRif ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      <span>Autocompletar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const clean = formData.rif.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
                        window.open(
                          `https://contribuyente.seniat.gob.ve/BuscaRif/BuscaRif.jsp?p_rif=${clean}`,
                          "_blank",
                          "width=780,height=580,scrollbars=yes"
                        );
                      }}
                      disabled={!formData.rif.trim()}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors disabled:opacity-50 cursor-pointer"
                      title="Abrir portal oficial del SENIAT para corroborar razón social y condición de contribuyente"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Portal SENIAT</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    placeholder="Ej. J-12345678-9"
                    value={formData.rif}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setFormData({ ...formData, rif: val });
                    }}
                    onBlur={() => {
                      const clean = formData.rif.replace(/[^A-Za-z0-9]/g, "");
                      if (clean.length >= 8 && !formData.name.trim()) {
                        handleLookupRif(clean);
                      }
                    }}
                    required
                  />
                  <Input
                    placeholder="Nombre Comercial (ej. Distribuidora Polar C.A.)"
                    value={formData.commercialName}
                    onChange={(e) => setFormData({ ...formData, commercialName: e.target.value })}
                  />
                </div>

                {/* Banner de diagnóstico y validación tributaria SENIAT */}
                {rifDiagnostic && (
                  <div
                    className={`p-2.5 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${
                      rifDiagnostic.source === "existing_supplier" ||
                      rifDiagnostic.source === "existing_customer" ||
                      rifDiagnostic.source === "external_api"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
                        : rifDiagnostic.isValidChecksum
                          ? "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60 text-sky-800 dark:text-sky-300"
                          : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {rifDiagnostic.isValidChecksum ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      )}
                      <span className="truncate">{rifDiagnostic.message}</span>
                    </div>
                    {rifDiagnostic.seniatPortalUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            rifDiagnostic.seniatPortalUrl,
                            "_blank",
                            "width=780,height=580,scrollbars=yes"
                          )
                        }
                        className="shrink-0 text-[10px] font-semibold underline hover:no-underline cursor-pointer"
                      >
                        Ver en SENIAT
                      </button>
                    )}
                  </div>
                )}
              </div>

              <Input
                label="Razón Social Completa *"
                placeholder="Razón social registrada ante el SENIAT"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Persona de Contacto"
                  placeholder="Nombre del asesor o vendedor"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                />
                <Input
                  label="Teléfono de Contacto"
                  placeholder="+58 412 1234567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                <Input
                  label="Correo Electrónico"
                  type="email"
                  placeholder="ventas@proveedor.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <Input
                label="Dirección Fiscal"
                placeholder="Dirección fiscal completa, ciudad, estado"
                value={formData.fiscalAddress}
                onChange={(e) => setFormData({ ...formData, fiscalAddress: e.target.value })}
              />

              {/* Tax Conditions & Active Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
                <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPersonNatural}
                    onChange={(e) =>
                      setFormData({ ...formData, isPersonNatural: e.target.checked })
                    }
                    className="w-4 h-4 text-sky-600 rounded accent-sky-600"
                  />
                  Persona Natural
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isResident}
                    onChange={(e) =>
                      setFormData({ ...formData, isResident: e.target.checked })
                    }
                    className="w-4 h-4 text-sky-600 rounded accent-sky-600"
                  />
                  Domiciliado en Vzla
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="w-4 h-4 text-sky-600 rounded accent-sky-600"
                  />
                  Proveedor Activo
                </label>
              </div>

              {/* Commercial & Payment Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Límite de Crédito ($ USD)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.creditLimit}
                  onChange={(e) =>
                    setFormData({ ...formData, creditLimit: Number(e.target.value) })
                  }
                />
                <Input
                  label="Plazo de Crédito (Días)"
                  type="number"
                  min="0"
                  value={formData.paymentTermsDays}
                  onChange={(e) =>
                    setFormData({ ...formData, paymentTermsDays: Number(e.target.value) })
                  }
                />
                <Input
                  label="Concepto Retención ISLR"
                  placeholder="SERV_IND, BIENES, etc."
                  value={formData.islrConceptCode}
                  onChange={(e) =>
                    setFormData({ ...formData, islrConceptCode: e.target.value })
                  }
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Sección 1: Transferencia Bancaria Nacional */}
              <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700/60 pb-2">
                  <div className="flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200">
                    <CreditCard className="w-4 h-4 text-sky-600" />
                    <span>Transferencia Bancaria (VES / USD)</span>
                  </div>
                  <span className="text-[11px] text-neutral-500">Cuenta de recepción</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Banco Receptor
                    </label>
                    <select
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2.5 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="">-- Seleccionar Banco --</option>
                      {VENEZUELAN_BANKS.map((b) => (
                        <option key={b.code} value={b.name}>
                          {b.code !== 'OTHER' ? `${b.code} - ` : ''}{b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Tipo de Cuenta
                    </label>
                    <select
                      value={formData.accountType}
                      onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                      className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2.5 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="CURRENT">Cuenta Corriente</option>
                      <option value="SAVINGS">Cuenta de Ahorros</option>
                      <option value="CUSTODY_USD">Custodia Moneda Extranjera (USD)</option>
                      <option value="INTERNATIONAL">Cuenta Internacional (SWIFT / ABA)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Número de Cuenta (20 Dígitos)
                    </label>
                    <span className="text-[10px] font-mono text-neutral-400">
                      {formData.accountNumber.replace(/\D/g, '').length} / 20 dígitos
                    </span>
                  </div>
                  <Input
                    placeholder="Ej. 01340001234567890123"
                    value={formData.accountNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 20);
                      let newBank = formData.bankName;
                      if (val.length >= 4) {
                        const code = val.slice(0, 4);
                        const matched = VENEZUELAN_BANKS.find((b) => b.code === code);
                        if (matched && !formData.bankName) {
                          newBank = matched.name;
                        }
                      }
                      setFormData({ ...formData, accountNumber: val, bankName: newBank });
                    }}
                    className="font-mono"
                  />
                  {formData.accountNumber.length > 0 && formData.accountNumber.length !== 20 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 block">
                      Atención: El estándar bancario venezolano consta de 20 dígitos numéricos.
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Titular de la Cuenta
                      </label>
                      {formData.name.trim() && (
                        <button
                          type="button"
                          onClick={() => setFormData((p) => ({ ...p, accountHolderName: p.name }))}
                          className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          Usar Razón Social
                        </button>
                      )}
                    </div>
                    <Input
                      placeholder="Nombre o Razón Social del titular"
                      value={formData.accountHolderName}
                      onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        C.I. / RIF del Titular
                      </label>
                      {formData.rif.trim() && (
                        <button
                          type="button"
                          onClick={() => setFormData((p) => ({ ...p, accountHolderId: p.rif }))}
                          className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          Usar RIF
                        </button>
                      )}
                    </div>
                    <Input
                      placeholder="Ej. J-12345678-9 o V-12345678"
                      value={formData.accountHolderId}
                      onChange={(e) => setFormData({ ...formData, accountHolderId: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Pago Móvil Interbancario */}
              <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700/60 pb-2">
                  <div className="flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span>Pago Móvil Interbancario</span>
                  </div>
                  <span className="text-[11px] text-neutral-500">Pagos al instante en VES</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Banco Pago Móvil
                    </label>
                    <select
                      value={formData.pagoMovilBank}
                      onChange={(e) => setFormData({ ...formData, pagoMovilBank: e.target.value })}
                      className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2.5 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="">-- Seleccionar Banco --</option>
                      {VENEZUELAN_BANKS.filter((b) => b.code !== 'OTHER').map((b) => (
                        <option key={b.code} value={b.name}>
                          {b.code} - {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Teléfono Celular
                      </label>
                      {formData.phone.trim() && (
                        <button
                          type="button"
                          onClick={() => setFormData((p) => ({ ...p, pagoMovilPhone: p.phone }))}
                          className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          Usar Teléfono
                        </button>
                      )}
                    </div>
                    <Input
                      placeholder="04141234567"
                      value={formData.pagoMovilPhone}
                      onChange={(e) => setFormData({ ...formData, pagoMovilPhone: e.target.value })}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Cédula / RIF Pago Móvil
                      </label>
                      {formData.rif.trim() && (
                        <button
                          type="button"
                          onClick={() => setFormData((p) => ({ ...p, pagoMovilId: p.rif }))}
                          className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          Usar RIF
                        </button>
                      )}
                    </div>
                    <Input
                      placeholder="Ej. J-12345678-9 o V-12345678"
                      value={formData.pagoMovilId}
                      onChange={(e) => setFormData({ ...formData, pagoMovilId: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Pagos en Divisas / Zelle / Internacional */}
              <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700/60 pb-2">
                  <div className="flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200">
                    <DollarSign className="w-4 h-4 text-amber-600" />
                    <span>Zelle / Cuentas en Divisas</span>
                  </div>
                  <span className="text-[11px] text-neutral-500">Transferencias en USD</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Correo o Identificador Zelle
                      </label>
                      {formData.email.trim() && (
                        <button
                          type="button"
                          onClick={() => setFormData((p) => ({ ...p, zelleEmail: p.email }))}
                          className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          Usar Correo
                        </button>
                      )}
                    </div>
                    <Input
                      placeholder="pagos@proveedor.com o teléfono"
                      value={formData.zelleEmail}
                      onChange={(e) => setFormData({ ...formData, zelleEmail: e.target.value })}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Titular de la Cuenta Zelle
                      </label>
                      {formData.name.trim() && (
                        <button
                          type="button"
                          onClick={() => setFormData((p) => ({ ...p, zelleHolderName: p.name }))}
                          className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          Usar Razón Social
                        </button>
                      )}
                    </div>
                    <Input
                      placeholder="Nombre registrado en Zelle"
                      value={formData.zelleHolderName}
                      onChange={(e) => setFormData({ ...formData, zelleHolderName: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Sección 4: Instrucciones Bancarias Adicionales */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Instrucciones Especiales de Pago
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Enviar comprobante al correo pagos@polar.com indicando número de factura. Cuenta bancaria de tercero autorizada según poder."
                  value={formData.bankNotes}
                  onChange={(e) => setFormData({ ...formData, bankNotes: e.target.value })}
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2.5 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* MODAL: PRODUCTOS ASOCIADOS AL PROVEEDOR */}
      <Modal
        isOpen={isProductsModalOpen}
        onClose={() => setIsProductsModalOpen(false)}
        title={`Productos de ${selectedSupplierForProducts?.name || "Proveedor"}`}
        subtitle={`RIF: ${selectedSupplierForProducts?.rif || ""} - Catálogo de insumos y precios pactados`}
        size="2xl"
        footer={
          <div className="flex items-center justify-end w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsProductsModalOpen(false)}
              className="rounded-lg"
            >
              Cerrar
            </Button>
          </div>
        }
      >
        <div className="space-y-6 text-xs">
          {/* Add / Link Product Form */}
          {canUpdate && (
            <Card className="p-4 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-lg">
              <h4 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-sky-600" />
                Vincular Nuevo Producto del Catálogo
              </h4>

              <form onSubmit={handleSaveSupplierProduct} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Buscar en Catálogo General *
                    </label>
                    <input
                      type="text"
                      placeholder="Filtrar por nombre o SKU..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg mb-1.5 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                    />
                    <select
                      value={selectedProductId}
                      onChange={(e) => handleSelectCatalogProduct(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                    >
                      <option value="">-- Seleccione un Producto --</option>
                      {filteredCatalogProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku ? `[${p.sku}] ` : ""}
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Código del Proveedor (Opcional)
                    </label>
                    <Input
                      placeholder="Ej. CÓDIGO-FABRICA-450"
                      value={productCodeInput}
                      onChange={(e) => setProductCodeInput(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Costo Unitario Pactado ($ USD)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={costPriceInput}
                      onChange={(e) => setCostPriceInput(Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Tiempo de Entrega (Días)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={leadTimeInput}
                      onChange={(e) => setLeadTimeInput(Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Notas u Observaciones
                    </label>
                    <Input
                      placeholder="Presentación de bulto, etc."
                      value={productNotesInput}
                      onChange={(e) => setProductNotesInput(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPreferredInput}
                      onChange={(e) => setIsPreferredInput(e.target.checked)}
                      className="w-4 h-4 text-sky-600 rounded accent-sky-600"
                    />
                    Proveedor Preferido para este Producto
                  </label>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={savingProduct || !selectedProductId}
                    className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white"
                  >
                    {savingProduct ? "Guardando..." : "Asociar Producto"}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Linked Products Table */}
          <div>
            <h4 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2 flex items-center justify-between">
              <span>Productos Vinculados ({supplierProducts.length})</span>
            </h4>

            <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Producto / SKU</th>
                    <th className="py-2.5 px-3">Cód. Proveedor</th>
                    <th className="py-2.5 px-3 text-right">Costo Pactado</th>
                    <th className="py-2.5 px-3 text-center">Entrega</th>
                    <th className="py-2.5 px-3 text-center">Preferido</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {loadingProducts ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-neutral-500">
                        Cargando catálogo del proveedor...
                      </td>
                    </tr>
                  ) : supplierProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-neutral-400">
                        <Package className="w-6 h-6 mx-auto mb-1 opacity-50" />
                        <p className="font-medium">No hay productos vinculados a este proveedor.</p>
                        <p className="text-[11px] text-neutral-500">
                          Utiliza el formulario superior para registrar productos suministrados.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    supplierProducts.map((sp) => (
                      <tr key={sp.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {sp.productName}
                          </div>
                          <div className="text-[11px] text-neutral-500 font-mono">
                            SKU: {sp.sku || "N/A"}
                            {sp.unitSymbol ? ` | Unidad: ${sp.unitSymbol}` : ""}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-neutral-700 dark:text-neutral-300">
                          {sp.supplierProductCode || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-neutral-800 dark:text-neutral-200 font-mono">
                          {formatMoneyUSD(sp.costPriceUsd)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-neutral-600 dark:text-neutral-400">
                          {sp.deliveryLeadTimeDays > 0 ? `${sp.deliveryLeadTimeDays} d` : "Inmediato"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {sp.isPreferred ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                              Sí
                            </span>
                          ) : (
                            <span className="text-neutral-400">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {canUpdate && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveSupplierProduct(sp.productId)}
                              className="h-7 px-2 text-red-600 hover:text-red-700 border-red-200 dark:border-red-900 rounded-lg"
                              title="Desvincular producto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL: HISTÓRICO DE PROVEEDOR */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Histórico de ${selectedSupplierForHistory?.name || "Proveedor"}`}
        subtitle={`RIF: ${selectedSupplierForHistory?.rif || ""} - Cronología de compras, recepciones y pagos`}
        size="3xl"
        footer={
          <div className="flex items-center justify-end w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHistoryModalOpen(false)}
              className="rounded-lg"
            >
              Cerrar
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Summary Badges in Modal */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <div>
              <span className="text-neutral-500 block">Saldo Pendiente CxP:</span>
              <span className="text-base font-bold text-red-600 font-mono">
                {formatMoneyUSD(selectedSupplierForHistory?.currentBalance || 0)}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block">Total Compras Históricas:</span>
              <span className="text-base font-bold text-neutral-800 dark:text-neutral-100 font-mono">
                {formatMoneyUSD(selectedSupplierForHistory?.totalPurchasesAmount || 0)}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block">Facturas Totales:</span>
              <span className="text-base font-bold text-sky-600 dark:text-sky-400">
                {selectedSupplierForHistory?.totalPurchasesCount || 0}
              </span>
            </div>
          </div>

          {/* History Type Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-200 dark:border-neutral-700 pb-2">
            {[
              { id: "ALL", label: "Todas las Operaciones" },
              { id: "PURCHASE_ORDER", label: "Órdenes de Compra" },
              { id: "GOODS_RECEIPT", label: "Recepciones de Mercancía" },
              { id: "PURCHASE_INVOICE", label: "Facturas de Compra" },
              { id: "PAYMENT", label: "Pagos y Abonos" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHistoryTypeFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  historyTypeFilter === tab.id
                    ? "bg-sky-600 text-white"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* History Timeline Table */}
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-x-auto max-h-[420px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 uppercase sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3">Tipo / Referencia</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Sucursal / Detalle</th>
                  <th className="py-2.5 px-3 text-right">Monto</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-neutral-500">
                      Cargando histórico del proveedor...
                    </td>
                  </tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-neutral-400">
                      <History className="w-6 h-6 mx-auto mb-1 opacity-50" />
                      <p className="font-medium">No se registraron movimientos en este filtro.</p>
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item) => {
                    const isInvoice = item.type === "PURCHASE_INVOICE";
                    const isPayment = item.type === "PAYMENT";
                    const isReceipt = item.type === "GOODS_RECEIPT";
                    const isOrder = item.type === "PURCHASE_ORDER";

                    return (
                      <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            {isInvoice && <FileSpreadsheet className="w-4 h-4 text-sky-600 flex-shrink-0" />}
                            {isPayment && <DollarSign className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                            {isReceipt && <ShoppingBag className="w-4 h-4 text-purple-600 flex-shrink-0" />}
                            {isOrder && <Receipt className="w-4 h-4 text-amber-600 flex-shrink-0" />}
                            <div>
                              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                                {isInvoice && `Factura: ${item.reference}`}
                                {isPayment && `Pago Ref: ${item.reference || "S/Ref"}`}
                                {isReceipt && `Recepción: ${item.reference}`}
                                {isOrder && `Orden: ${item.reference}`}
                              </div>
                              <div className="text-[11px] text-neutral-500">
                                {isInvoice && "Factura de Compra"}
                                {isPayment && "Abono / Pago Realizado"}
                                {isReceipt && "Entrada de Almacén"}
                                {isOrder && "Orden de Compra"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 font-mono text-neutral-600 dark:text-neutral-400">
                          {item.date ? new Date(item.date).toLocaleDateString() : "-"}
                        </td>

                        <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                          <div className="font-medium text-neutral-800 dark:text-neutral-200">
                            {item.branchName || "Principal"}
                          </div>
                          {item.notes && (
                            <div className="text-[11px] text-neutral-500 truncate max-w-[200px]">
                              {item.notes}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          <span
                            className={
                              isPayment
                                ? "text-emerald-600"
                                : isInvoice
                                ? "text-sky-600"
                                : "text-neutral-800 dark:text-neutral-200"
                            }
                          >
                            {formatMoneyUSD(item.totalAmount)}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <Badge
                            variant={
                              item.status === "PAID" || item.status === "RECEIVED" || item.status === "APPROVED"
                                ? "success"
                                : item.status === "PENDING"
                                ? "warning"
                                : item.status === "ANNULLED"
                                ? "danger"
                                : "neutral"
                            }
                          >
                            {item.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* MODAL: FICHA BANCARIA DEL PROVEEDOR */}
      <Modal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        title={`Ficha Bancaria: ${selectedSupplierForBankInfo?.name || "Proveedor"}`}
        subtitle={`RIF: ${selectedSupplierForBankInfo?.rif || ""} - Datos registrados para pagos y transferencias`}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (selectedSupplierForBankInfo) {
                  setIsBankModalOpen(false);
                  handleOpenEditModal(selectedSupplierForBankInfo);
                  setFormActiveTab("banking");
                }
              }}
              className="text-xs"
            >
              <Edit2 className="w-3.5 h-3.5 mr-1" />
              Editar Datos Bancarios
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBankModalOpen(false)}
              className="rounded-lg"
            >
              Cerrar
            </Button>
          </div>
        }
      >
        {selectedSupplierForBankInfo && (
          <div className="space-y-4 text-xs">
            {/* Header con Razón Social y RIF */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                  {selectedSupplierForBankInfo.name}
                </h4>
                {selectedSupplierForBankInfo.commercialName && (
                  <p className="text-neutral-500 font-medium">
                    {selectedSupplierForBankInfo.commercialName}
                  </p>
                )}
                <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                  {selectedSupplierForBankInfo.rif}
                </span>
              </div>
              <Badge variant={selectedSupplierForBankInfo.isActive ? "success" : "neutral"}>
                {selectedSupplierForBankInfo.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </div>

            {/* Verificación si no tiene datos bancarios */}
            {!selectedSupplierForBankInfo.bankName &&
             !selectedSupplierForBankInfo.accountNumber &&
             !selectedSupplierForBankInfo.pagoMovilPhone &&
             !selectedSupplierForBankInfo.zelleEmail ? (
              <div className="p-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg space-y-2">
                <Landmark className="w-8 h-8 text-neutral-400 mx-auto opacity-60" />
                <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Sin información bancaria registrada
                </p>
                <p className="text-neutral-500 text-[11px] max-w-sm mx-auto">
                  Este proveedor aún no posee cuentas bancarias, datos de Pago Móvil o Zelle configurados en su ficha.
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setIsBankModalOpen(false);
                    handleOpenEditModal(selectedSupplierForBankInfo);
                    setFormActiveTab("banking");
                  }}
                  className="mt-2 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Registrar Datos Bancarios
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 1. Transferencia Bancaria */}
                {(selectedSupplierForBankInfo.accountNumber || selectedSupplierForBankInfo.bankName) && (
                  <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                      <div className="flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200">
                        <CreditCard className="w-4 h-4 text-sky-600" />
                        <span>Transferencia Bancaria Nacional</span>
                      </div>
                      <Badge variant="neutral" className="text-[10px]">
                        {selectedSupplierForBankInfo.accountType === "SAVINGS"
                          ? "Ahorro"
                          : selectedSupplierForBankInfo.accountType === "CUSTODY_USD"
                          ? "Custodia USD"
                          : selectedSupplierForBankInfo.accountType === "INTERNATIONAL"
                          ? "Internacional"
                          : "Corriente"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <span className="text-neutral-500 block">Banco:</span>
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {selectedSupplierForBankInfo.bankName || "No especificado"}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Titular:</span>
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          {selectedSupplierForBankInfo.accountHolderName || selectedSupplierForBankInfo.name}
                        </span>
                      </div>
                    </div>

                    {selectedSupplierForBankInfo.accountNumber && (
                      <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] text-neutral-500 block uppercase font-medium">
                            Número de Cuenta (20 Dígitos)
                          </span>
                          <span className="font-mono text-xs font-bold text-neutral-900 dark:text-neutral-100 tracking-wider">
                            {selectedSupplierForBankInfo.accountNumber}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyText(selectedSupplierForBankInfo.accountNumber!, "account")}
                          className="h-7 px-2.5 text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === "account" ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-neutral-500" />
                          )}
                          <span>{copiedKey === "account" ? "Copiado" : "Copiar"}</span>
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <div>
                        <span className="text-neutral-500">C.I. / RIF Titular: </span>
                        <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                          {selectedSupplierForBankInfo.accountHolderId || selectedSupplierForBankInfo.rif}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const fullDetails = `Banco: ${selectedSupplierForBankInfo.bankName || ""}\nCuenta: ${selectedSupplierForBankInfo.accountNumber || ""}\nTipo: ${selectedSupplierForBankInfo.accountType || "Corriente"}\nTitular: ${selectedSupplierForBankInfo.accountHolderName || selectedSupplierForBankInfo.name}\nRIF: ${selectedSupplierForBankInfo.accountHolderId || selectedSupplierForBankInfo.rif}`;
                          handleCopyText(fullDetails, "full_transfer");
                        }}
                        className="h-6 text-[11px] text-sky-600 dark:text-sky-400 p-1 cursor-pointer"
                      >
                        {copiedKey === "full_transfer" ? "Copiado todo" : "Copiar todo el bloque"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* 2. Pago Móvil */}
                {(selectedSupplierForBankInfo.pagoMovilPhone || selectedSupplierForBankInfo.pagoMovilBank) && (
                  <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                      <div className="flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200">
                        <Smartphone className="w-4 h-4 text-emerald-600" />
                        <span>Pago Móvil Interbancario</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const pmData = `Banco: ${selectedSupplierForBankInfo.pagoMovilBank || selectedSupplierForBankInfo.bankName || ""}\nTeléfono: ${selectedSupplierForBankInfo.pagoMovilPhone || ""}\nC.I./RIF: ${selectedSupplierForBankInfo.pagoMovilId || selectedSupplierForBankInfo.rif}`;
                          handleCopyText(pmData, "pm_all");
                        }}
                        className="h-6 px-2 text-[11px] rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === "pm_all" ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-neutral-500" />
                        )}
                        <span>{copiedKey === "pm_all" ? "Copiado" : "Copiar Datos"}</span>
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                      <div>
                        <span className="text-neutral-500 block">Banco:</span>
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {selectedSupplierForBankInfo.pagoMovilBank || selectedSupplierForBankInfo.bankName || "No especificado"}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Teléfono:</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                            {selectedSupplierForBankInfo.pagoMovilPhone || "-"}
                          </span>
                          {selectedSupplierForBankInfo.pagoMovilPhone && (
                            <button
                              type="button"
                              onClick={() => handleCopyText(selectedSupplierForBankInfo.pagoMovilPhone!, "pm_phone")}
                              className="text-neutral-400 hover:text-sky-600 cursor-pointer"
                              title="Copiar teléfono"
                            >
                              {copiedKey === "pm_phone" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Cédula / RIF:</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                            {selectedSupplierForBankInfo.pagoMovilId || selectedSupplierForBankInfo.rif}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(selectedSupplierForBankInfo.pagoMovilId || selectedSupplierForBankInfo.rif, "pm_id")}
                            className="text-neutral-400 hover:text-sky-600 cursor-pointer"
                            title="Copiar RIF/C.I."
                          >
                            {copiedKey === "pm_id" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Zelle / Moneda Extranjera */}
                {selectedSupplierForBankInfo.zelleEmail && (
                  <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                      <div className="flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200">
                        <DollarSign className="w-4 h-4 text-amber-600" />
                        <span>Zelle / Transferencias USD</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyText(selectedSupplierForBankInfo.zelleEmail!, "zelle_email")}
                        className="h-6 px-2 text-[11px] rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === "zelle_email" ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-neutral-500" />
                        )}
                        <span>{copiedKey === "zelle_email" ? "Copiado" : "Copiar Zelle"}</span>
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <span className="text-neutral-500 block">Correo / Identificador:</span>
                        <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                          {selectedSupplierForBankInfo.zelleEmail}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Titular:</span>
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          {selectedSupplierForBankInfo.zelleHolderName || selectedSupplierForBankInfo.accountHolderName || selectedSupplierForBankInfo.name}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Instrucciones Adicionales */}
                {selectedSupplierForBankInfo.bankNotes && (
                  <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 space-y-1">
                    <span className="font-semibold text-neutral-700 dark:text-neutral-300 block text-[11px]">
                      Instrucciones Especiales de Pago:
                    </span>
                    <p className="text-neutral-600 dark:text-neutral-400 text-[11px] whitespace-pre-wrap leading-relaxed">
                      {selectedSupplierForBankInfo.bankNotes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
