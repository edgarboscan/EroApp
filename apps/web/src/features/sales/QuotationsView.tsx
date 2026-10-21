import React, { useState, useEffect, useMemo } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { DataTable, Column } from "../../components/ui/DataTable";
import { useEscapeKey } from "../../components/ui/Modal";
import { useExchangeRateStore } from "../../stores/exchangeRateStore";
import {
  FileText,
  Plus,
  Trash2,
  X,
  Check,
  Building2,
  Calendar,
  DollarSign,
  User,
  Eye,
  Receipt,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  ShieldAlert,
  Lock,
  Printer,
  FileCheck,
} from "lucide-react";
import {
  CustomerSearchModal,
  ProductSearchModal,
} from "../../components/search";
import { toast } from "sonner";
import { useAuthStore, isSuperAdminRole } from "../../stores/authStore";
import { showConfirmQuestion } from "../../lib/sweetalert";
import { PdfViewerModal } from "../../components/ui/PdfViewerModal";
import {
  formatNumber,
  formatCurrency,
  formatMoneyUSD,
  formatMoneyVES,
  formatExchangeRate,
} from "@ero/shared";

interface QuotationRecord {
  id: string;
  quotationNumber: string;
  quotationDate: string;
  validUntilDate: string;
  currency: "USD" | "VES";
  exchangeRate: number;
  subtotalAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  status:
    | "DRAFT"
    | "EMITTED"
    | "ACCEPTED"
    | "EXPIRED"
    | "REJECTED"
    | "CONVERTED";
  notes?: string | null;
  customerId?: string;
  customerName: string;
  customerDoc: string;
  creditEnabled?: boolean;
  creditLimit?: number;
  paymentTermsDays?: number;
  branchName: string;
  createdByUserName: string;
  itemsCount: number;
}

interface NewQuotationItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountPercent: number;
  subtotal: number;
  total: number;
  notes?: string;
}

interface InvoiceVerificationItem {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  unitOfMeasure?: string;
  quantity: number;
  availableStock: number;
  hasSufficientStock: boolean;
  stockShortage: number;
  quotedUnitPrice: number;
  currentBasePrice: number;
  hasPriceVariation: boolean;
  priceDifference: number;
  priceVariationPercent: number;
  quotedTotal: number;
  currentTotal: number;
}

interface InvoiceVerificationResult {
  quotationId: string;
  quotationNumber: string;
  warehouseId: string;
  warehouseName: string;
  canInvoice: boolean;
  hasStockIssues: boolean;
  hasPriceVariations: boolean;
  insufficientCount: number;
  priceVariationsCount: number;
  totalQuotedAmount: number;
  totalCurrentAmount: number;
  totalDifference: number;
  items: InvoiceVerificationItem[];
}

export const QuotationsView: React.FC = () => {
  const rate = useExchangeRateStore((s) => s.rate);
  const { activeBranchId, token, user } = useAuthStore();
  const isUserAdmin = isSuperAdminRole(user?.role);
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Catálogos desde BD
  const [availableProducts, setAvailableProducts] = useState<
    {
      id: string;
      sku: string;
      name: string;
      basePrice: number;
      taxRate: number;
    }[]
  >([]);
  const [availableCustomers, setAvailableCustomers] = useState<
    {
      id: string;
      name: string;
      doc: string;
      creditEnabled: boolean;
      creditLimit: number;
    }[]
  >([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [bankAccounts, setBankAccounts] = useState<
    {
      id: string;
      accountNumber: string;
      description: string;
      currency: string;
      bankName?: string;
    }[]
  >([]);

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingQuotation, setViewingQuotation] =
    useState<QuotationRecord | null>(null);
  const [invoicingQuotation, setInvoicingQuotation] =
    useState<QuotationRecord | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [productSearchRowIdx, setProductSearchRowIdx] = useState<number | null>(
    null,
  );
  const [isAddingFromSearch, setIsAddingFromSearch] = useState(false);
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    endpoint: string | null;
    title: string;
    filename?: string;
  }>({
    isOpen: false,
    endpoint: null,
    title: "",
  });

  useEscapeKey(
    () => {
      if (showCustomerSearch) setShowCustomerSearch(false);
      else if (productSearchRowIdx !== null) setProductSearchRowIdx(null);
      else if (isAddingFromSearch) setIsAddingFromSearch(false);
      else if (viewingQuotation) setViewingQuotation(null);
      else if (invoicingQuotation) setInvoicingQuotation(null);
      else if (isCreateOpen) setIsCreateOpen(false);
    },
    Boolean(
      showCustomerSearch ||
      productSearchRowIdx !== null ||
      isAddingFromSearch ||
      viewingQuotation ||
      invoicingQuotation ||
      isCreateOpen,
    ),
  );

  // Formulario Nueva Cotización
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [validUntilDate, setValidUntilDate] = useState(
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  );
  const [currency, setCurrency] = useState<"USD" | "VES">("USD");
  const [exchangeRate, setExchangeRate] = useState(rate);
  const [notes, setNotes] = useState("");
  const [quotationItems, setQuotationItems] = useState<NewQuotationItem[]>([]);

  // Formulario de Facturación de Cotización
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [controlNumber, setControlNumber] = useState("");
  const [salesInvoiceMode, setSalesInvoiceMode] = useState<"fiscal_printer" | "free_form" | "no_fiscal">("free_form");
  const [requireApprovalCreditExceeded, setRequireApprovalCreditExceeded] = useState(true);
  const [enforceCreditLimit, setEnforceCreditLimit] = useState(true);
  const [isCredit, setIsCredit] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH_USD");
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [loadingInvoiceConfig, setLoadingInvoiceConfig] = useState(false);

  // Verificación de precios y existencias para facturación
  const [verificationResult, setVerificationResult] =
    useState<InvoiceVerificationResult | null>(null);
  const [loadingVerification, setLoadingVerification] = useState(false);
  const [updatePricesToCurrent, setUpdatePricesToCurrent] = useState(false);

  // Información de crédito del cliente
  const [customerCreditInfo, setCustomerCreditInfo] = useState<{
    customerId: string;
    customerName: string;
    customerDoc: string;
    creditEnabled: boolean;
    creditLimit: number;
    paymentTermsDays: number;
    currentDebt: number;
    availableCredit: number;
  } | null>(null);

  // Aprobación de sobregiro de crédito
  const [adminAuthorized, setAdminAuthorized] = useState(false);
  const [supervisorUsername, setSupervisorUsername] = useState("");
  const [supervisorPassword, setSupervisorPassword] = useState("");
  const [supervisorNotes, setSupervisorNotes] = useState("");

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const params = new URLSearchParams();
      if (activeBranchId) params.append("branchId", activeBranchId);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      const url = `/api/sales/quotations?${params.toString()}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setQuotations(json.data);
        } else {
          setQuotations([]);
        }
      } else {
        setQuotations([]);
      }
    } catch {
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogs = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const [custRes, prodRes, branchRes, bankRes] = await Promise.all([
        fetch("/api/customers", { headers }),
        fetch("/api/inventory/products", { headers }),
        fetch("/api/auth/branches", { headers }),
        fetch("/api/sales/payment-accounts", { headers }),
      ]);

      if (custRes.ok) {
        const cJson = await custRes.json();
        if (cJson.success && Array.isArray(cJson.data)) {
          const mapped = cJson.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            doc: `${c.docType || "J"}-${c.docNumber || ""}`,
            creditEnabled: !!c.creditEnabled,
            creditLimit: Number(c.creditLimit || 0),
          }));
          setAvailableCustomers(mapped);
          if (mapped.length > 0 && !selectedCustomerId) {
            setSelectedCustomerId(mapped[0].id);
          }
        }
      }

      if (prodRes.ok) {
        const pJson = await prodRes.json();
        if (pJson.success && Array.isArray(pJson.data)) {
          const mapped = pJson.data.map((p: any) => ({
            id: p.id,
            sku: p.sku || "",
            name: p.name || "",
            basePrice: Number(p.basePrice || p.price || 0),
            taxRate: Number(p.taxRate ?? 16),
          }));
          setAvailableProducts(mapped);
        }
      }

      if (branchRes.ok) {
        const bJson = await branchRes.json();
        if (bJson.success && Array.isArray(bJson.data)) {
          const allWh: { id: string; name: string }[] = [];
          let defaultSalesWhId = "";
          bJson.data.forEach((b: any) => {
            if (Array.isArray(b.warehouses)) {
              b.warehouses.forEach((w: any) => {
                allWh.push({ id: w.id, name: `${b.name} - ${w.name}` });
                if (w.isDefaultSales && !defaultSalesWhId) {
                  defaultSalesWhId = w.id;
                }
              });
            }
          });
          setWarehouses(allWh);
          if (allWh.length > 0 && !selectedWarehouseId) {
            setSelectedWarehouseId(defaultSalesWhId || allWh[0].id);
          }
        }
      }

      if (bankRes.ok) {
        const bkJson = await bankRes.json();
        if (bkJson.success && Array.isArray(bkJson.data)) {
          const mappedBanks = bkJson.data.map((ba: any) => ({
            id: ba.id,
            accountNumber: ba.accountNumber || ba.account_number || "",
            description: ba.description || "",
            currency: ba.currency || "VES",
            bankName: ba.bankName || ba.bank_name || "",
          }));
          setBankAccounts(mappedBanks);
        }
      }
    } catch {
      // Ignorar errores de carga
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, [activeBranchId, token, startDate, endDate]);

  useEffect(() => {
    fetchCatalogs();
  }, [activeBranchId, token]);

  // Totales
  const subtotalSum = quotationItems.reduce((acc, i) => acc + i.subtotal, 0);
  const taxSum = quotationItems.reduce(
    (acc, i) => acc + (i.total - i.subtotal),
    0,
  );
  const totalUSD = subtotalSum + taxSum;
  const totalVES = totalUSD * exchangeRate;

  const handleOpenCreateModal = () => {
    if (availableProducts.length > 0 && quotationItems.length === 0) {
      const prod = availableProducts[0];
      const sub = Number((1 * prod.basePrice).toFixed(2));
      const tax = Number((sub * (prod.taxRate / 100)).toFixed(2));
      setQuotationItems([
        {
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          quantity: 1,
          unitPrice: prod.basePrice,
          taxRate: prod.taxRate,
          discountPercent: 0,
          subtotal: sub,
          total: Number((sub + tax).toFixed(2)),
        },
      ]);
    }
    setIsCreateOpen(true);
  };

  const handleAddItem = () => {
    if (availableProducts.length === 0) {
      toast.error("No hay productos disponibles en el catálogo");
      return;
    }
    const prod = availableProducts[0];
    const sub = Number((1 * prod.basePrice).toFixed(2));
    const tax = Number((sub * (prod.taxRate / 100)).toFixed(2));
    setQuotationItems([
      ...quotationItems,
      {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        quantity: 1,
        unitPrice: prod.basePrice,
        taxRate: prod.taxRate,
        discountPercent: 0,
        subtotal: sub,
        total: Number((sub + tax).toFixed(2)),
      },
    ]);
  };

  const handleAddItemWithProduct = (prod: any) => {
    const unitPrice = Number(prod.basePrice ?? prod.salePrice ?? 0);
    const taxRate = Number(prod.taxRate ?? 16);
    const sub = Number((1 * unitPrice).toFixed(2));
    const tax = Number((sub * (taxRate / 100)).toFixed(2));
    setQuotationItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        quantity: 1,
        unitPrice,
        taxRate,
        discountPercent: 0,
        subtotal: sub,
        total: Number((sub + tax).toFixed(2)),
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (quotationItems.length === 1) {
      toast.error("La cotización debe contener al menos un producto");
      return;
    }
    setQuotationItems(quotationItems.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    const updated = [...quotationItems];
    const item = updated[index];

    if (field === "productId") {
      const p = availableProducts.find((pr) => pr.id === val);
      if (p) {
        item.productId = p.id;
        item.productName = p.name;
        item.sku = p.sku;
        item.unitPrice = p.basePrice;
        item.taxRate = p.taxRate;
      }
    } else if (field === "quantity") {
      item.quantity = Number(val);
    } else if (field === "unitPrice") {
      item.unitPrice = Number(val);
    } else if (field === "taxRate") {
      item.taxRate = Number(val);
    } else if (field === "discountPercent") {
      item.discountPercent = Number(val);
    }

    const rawSubtotal = item.quantity * item.unitPrice;
    const disc = rawSubtotal * (item.discountPercent / 100);
    const sub = Number((rawSubtotal - disc).toFixed(2));
    const tax = Number((sub * (item.taxRate / 100)).toFixed(2));

    item.subtotal = sub;
    item.total = Number((sub + tax).toFixed(2));
    setQuotationItems(updated);
  };

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quotationItems.length === 0) {
      toast.error("Debe incluir al menos un producto en la cotización");
      return;
    }
    if (!selectedCustomerId) {
      toast.error("Debe seleccionar un cliente");
      return;
    }
    if (!activeBranchId) {
      toast.error("Debe seleccionar una sucursal activa");
      return;
    }

    const confirmed = await showConfirmQuestion({
      title: "¿Emitir cotización?",
      text: `Se registrará una cotización por un monto de ${formatMoneyUSD(totalUSD)}.`,
      confirmButtonText: "Sí, emitir cotización",
    });
    if (!confirmed) return;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/sales/quotations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          branchId: activeBranchId,
          customerId: selectedCustomerId,
          validUntilDate,
          currency,
          exchangeRate,
          notes: notes.trim() || undefined,
          items: quotationItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            discountPercent: item.discountPercent,
            notes: item.notes || undefined,
          })),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Cotización emitida con éxito`);
        setIsCreateOpen(false);
        setQuotationItems([]);
        setNotes("");
        fetchQuotations();

        // Abrir inmediatamente la visualización y descarga en PDF
        if (json.data?.id) {
          setPdfModal({
            isOpen: true,
            endpoint: `/api/sales/quotations/${json.data.id}/pdf`,
            title: `Cotización Comercial N° ${json.data.quotationNumber || ""}`,
            filename: `cotizacion_${json.data.quotationNumber || "doc"}.pdf`,
          });
        }
      } else {
        toast.error(json.error?.message || "Error al emitir la cotización");
      }
    } catch {
      toast.error("Error de comunicación con el servidor");
    }
  };

  const handleAcceptQuotation = async (id: string) => {
    const confirmed = await showConfirmQuestion({
      title: "¿Aceptar cotización?",
      text: "La cotización pasará a estado Aceptada y estará lista para facturar o despachar.",
      confirmButtonText: "Sí, aceptar cotización",
    });
    if (!confirmed) return;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/sales/quotations/${id}/accept`, {
        method: "PUT",
        headers,
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Cotización aceptada por el cliente.");
        fetchQuotations();
      } else {
        toast.error(json.error?.message || "Error al aceptar cotización");
      }
    } catch {
      toast.error("Error de comunicación con el servidor");
    }
  };

  const fetchInvoiceVerification = async (quotationId: string, whId?: string) => {
    if (!quotationId) {
      setVerificationResult(null);
      return;
    }
    setLoadingVerification(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const url = whId && whId.trim() !== ""
        ? `/api/sales/quotations/${quotationId}/invoice-check?warehouseId=${encodeURIComponent(whId)}`
        : `/api/sales/quotations/${quotationId}/invoice-check`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setVerificationResult(json.data);
          if (json.data.warehouseId && (!whId || !selectedWarehouseId)) {
            setSelectedWarehouseId(json.data.warehouseId);
          }
        } else {
          setVerificationResult(null);
        }
      } else {
        const errJson = await res.json().catch(() => null);
        console.error("Error al verificar cotización para facturación:", errJson);
        setVerificationResult(null);
      }
    } catch (err) {
      console.error("Error de conexión al verificar cotización:", err);
      setVerificationResult(null);
    } finally {
      setLoadingVerification(false);
    }
  };

  const handlePaymentMethodChange = (newMethod: string) => {
    setPaymentMethod(newMethod);
    const isMethodUSD = ["CASH_USD", "ZELLE"].includes(newMethod);
    const targetCurrency = isMethodUSD ? "USD" : "VES";
    const matchingAccount = bankAccounts.find((b) => b.currency === targetCurrency);
    if (matchingAccount) {
      setSelectedBankAccountId(matchingAccount.id);
    }
  };

  const handleOpenInvoiceModal = async (quotation: QuotationRecord) => {
    setInvoicingQuotation(quotation);
    const defaultWh = warehouses[0]?.id || "";
    setSelectedWarehouseId(defaultWh);
    setInvoiceNumber("");
    setControlNumber("");
    setIsCredit(false);
    const initialMethod = quotation.currency === "VES" ? "TRANSFER" : "CASH_USD";
    setPaymentMethod(initialMethod);
    const targetCurrency = initialMethod === "TRANSFER" ? "VES" : "USD";
    const matchingAccount = bankAccounts.find((b) => b.currency === targetCurrency) || bankAccounts[0];
    setSelectedBankAccountId(matchingAccount?.id || "");
    setPaymentReference("");
    setAdminAuthorized(false);
    setSupervisorUsername("");
    setSupervisorPassword("");
    setSupervisorNotes("");
    setCustomerCreditInfo(null);
    setUpdatePricesToCurrent(false);
    setVerificationResult(null);
    setLoadingInvoiceConfig(true);

    fetchInvoiceVerification(quotation.id, defaultWh);

    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // 1. Obtener próximo número de factura y modo configurado en la empresa
      const configRes = await fetch("/api/sales/next-invoice-number", { headers });
      if (configRes.ok) {
        const configJson = await configRes.json();
        if (configJson.success && configJson.data) {
          setInvoiceNumber(configJson.data.nextInvoiceNumber || "");
          setSalesInvoiceMode(configJson.data.salesInvoiceMode || "free_form");
          setRequireApprovalCreditExceeded(Boolean(configJson.data.requireApprovalCreditExceeded));
          setEnforceCreditLimit(Boolean(configJson.data.enforceCreditLimit));
        }
      }

      // 2. Obtener estado de crédito del cliente
      const customerId = quotation.customerId;
      if (customerId) {
        const creditRes = await fetch(`/api/sales/customer-credit/${customerId}`, { headers });
        if (creditRes.ok) {
          const creditJson = await creditRes.json();
          if (creditJson.success && creditJson.data) {
            setCustomerCreditInfo(creditJson.data);
            const days = creditJson.data.paymentTermsDays || quotation.paymentTermsDays || 15;
            const calcDueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
            setDueDate(calcDueDate);
          }
        }
      } else {
        const days = quotation.paymentTermsDays || 15;
        const calcDueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        setDueDate(calcDueDate);
      }
    } catch {
      toast.error("No se pudo cargar la configuración de facturación.");
    } finally {
      setLoadingInvoiceConfig(false);
    }
  };

  const handleToggleCredit = (checked: boolean) => {
    setIsCredit(checked);
    if (checked) {
      const days = customerCreditInfo?.paymentTermsDays || invoicingQuotation?.paymentTermsDays || 15;
      const calcDueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      setDueDate(calcDueDate);
    }
  };

  const currentCustomerDebt = customerCreditInfo?.currentDebt || 0;
  const currentCreditLimit = customerCreditInfo?.creditLimit || (invoicingQuotation?.creditLimit ?? 0);
  const availableCredit = customerCreditInfo?.availableCredit ?? (currentCreditLimit - currentCustomerDebt);
  const totalAmountToInvoice = updatePricesToCurrent && verificationResult
    ? verificationResult.totalCurrentAmount
    : (invoicingQuotation?.totalAmount || 0);
  const isCreditExceeded = isCredit && (currentCustomerDebt + totalAmountToInvoice > currentCreditLimit);
  const creditExceededAmount = isCreditExceeded ? (currentCustomerDebt + totalAmountToInvoice - currentCreditLimit) : 0;

  const handleInvoiceQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoicingQuotation) return;
    if (!invoiceNumber.trim()) {
      toast.error("El número de factura es obligatorio");
      return;
    }
    const targetWarehouseId = selectedWarehouseId || verificationResult?.warehouseId || warehouses[0]?.id || "";
    if (!targetWarehouseId) {
      toast.error("Debe seleccionar el depósito para la rebaja de stock");
      return;
    }

    if (verificationResult?.hasStockIssues) {
      toast.error(
        `No se puede emitir la factura: existen ${verificationResult.insufficientCount} productos con stock insuficiente en el depósito.`
      );
      return;
    }

    if (salesInvoiceMode === "free_form" && !controlNumber.trim()) {
      toast.error("El Nº de Control SENIAT es obligatorio para Facturas en Forma Libre / Talonario");
      return;
    }

    if (isCredit) {
      if (customerCreditInfo && !customerCreditInfo.creditEnabled) {
        toast.error(`El cliente ${invoicingQuotation.customerName} no tiene línea de crédito comercial autorizada`);
        return;
      }
      if (!dueDate) {
        toast.error("Debe especificar la fecha de vencimiento del crédito");
        return;
      }
      if (isCreditExceeded && enforceCreditLimit) {
        if (requireApprovalCreditExceeded) {
          if (isUserAdmin) {
            if (!adminAuthorized) {
              toast.error("Debe confirmar la casilla de autorización como Administrador para sobregirar el crédito");
              return;
            }
          } else {
            if (!supervisorUsername.trim() || !supervisorPassword.trim()) {
              toast.error("Se requiere ingresar el usuario y contraseña del supervisor para autorizar el sobregiro");
              return;
            }
          }
        } else {
          toast.error(`Límite de crédito excedido por $${creditExceededAmount.toFixed(2)}. No se permiten sobregiros.`);
          return;
        }
      }
    } else {
      if (!paymentMethod) {
        toast.error("Debe seleccionar un método de pago para ventas de contado");
        return;
      }
      if (bankAccounts.length > 0 && !selectedBankAccountId) {
        toast.error("Debe seleccionar la cuenta bancaria de destino para el ingreso y conciliación del dinero");
        return;
      }
      const isElectronic = ["TRANSFER", "PAGO_MOVIL", "ZELLE", "DEBIT_CARD"].includes(paymentMethod);
      if (isElectronic && !paymentReference.trim()) {
        toast.error("El número de referencia es obligatorio para pagos por transferencia, pago móvil o punto de venta para permitir la conciliación bancaria");
        return;
      }
    }

    let priceVariationMsg = "";
    if (verificationResult?.hasPriceVariations) {
      priceVariationMsg = updatePricesToCurrent
        ? ` Se actualizarán los precios a los vigentes del catálogo (${formatCurrency(verificationResult.totalCurrentAmount, invoicingQuotation.currency)}).`
        : ` Se respetarán los precios pactados en la cotización (${formatCurrency(verificationResult.totalQuotedAmount, invoicingQuotation.currency)}).`;
    }

    const confirmed = await showConfirmQuestion({
      title: "¿Emitir factura de venta?",
      text: (isCredit
        ? `Se convertirá la cotización en la factura a crédito ${invoiceNumber} generando una cuenta por cobrar (CxC).`
        : `Se convertirá la cotización en la factura ${invoiceNumber} registrando el cobro de contado.`) + priceVariationMsg,
      confirmButtonText: "Sí, facturar",
    });
    if (!confirmed) return;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/sales/quotations/to-invoice", {
        method: "POST",
        headers,
        body: JSON.stringify({
          quotationId: invoicingQuotation.id,
          warehouseId: targetWarehouseId,
          invoiceNumber: invoiceNumber.trim(),
          controlNumber: salesInvoiceMode === "no_fiscal" ? null : (controlNumber.trim() || null),
          invoiceMode: salesInvoiceMode,
          isCredit,
          dueDate: isCredit && dueDate ? dueDate : undefined,
          updatePricesToCurrent,
          adminAuthorized: isCredit && isCreditExceeded && isUserAdmin ? adminAuthorized : undefined,
          supervisorApproval: isCredit && isCreditExceeded && !isUserAdmin && supervisorUsername ? {
            usernameOrEmail: supervisorUsername.trim(),
            password: supervisorPassword,
            notes: supervisorNotes.trim() || undefined,
          } : undefined,
          paymentMethod: !isCredit ? paymentMethod : undefined,
          bankAccountId: !isCredit && selectedBankAccountId ? selectedBankAccountId : undefined,
          paymentReference: !isCredit && paymentReference.trim() ? paymentReference.trim() : undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          `Factura ${invoiceNumber} emitida con éxito. Stock reservado en depósito para despacho.`,
        );
        setInvoicingQuotation(null);
        setInvoiceNumber("");
        setControlNumber("");
        fetchQuotations();
      } else {
        const errMsg =
          json.error?.message ||
          (Array.isArray(json.error?.issues)
            ? json.error.issues.map((i: any) => i.message).join(", ")
            : null) ||
          "Error al emitir la factura";
        toast.error(errMsg);
      }
    } catch {
      toast.error("Error de comunicación con el servidor");
    }
  };

  const invoicedQuotations = useMemo(
    () => quotations.filter((q) => q.status === "CONVERTED"),
    [quotations],
  );

  const totalInvoicedAmount = useMemo(
    () => invoicedQuotations.reduce((acc, q) => acc + q.totalAmount, 0),
    [invoicedQuotations],
  );

  const totalQuotedAmount = useMemo(
    () => quotations.reduce((acc, q) => acc + q.totalAmount, 0),
    [quotations],
  );

  const activeQuotationsCount = useMemo(
    () =>
      quotations.filter(
        (q) => q.status !== "EXPIRED" && q.status !== "REJECTED",
      ).length,
    [quotations],
  );

  const acceptedQuotationsCount = useMemo(
    () => quotations.filter((q) => q.status === "ACCEPTED").length,
    [quotations],
  );

  const filteredQuotations = quotations.filter((q) => {
    if (statusFilter !== "ALL" && q.status !== statusFilter) return false;
    return true;
  });

  const renderStatusBadge = (status: QuotationRecord["status"]) => {
    switch (status) {
      case "DRAFT":
        return (
          <Badge variant="neutral" className="text-[10px]">
            Borrador
          </Badge>
        );
      case "EMITTED":
        return (
          <Badge variant="info" className="text-[10px]">
            Emitida
          </Badge>
        );
      case "ACCEPTED":
        return (
          <Badge variant="warning" className="text-[10px]">
            Aceptada Cliente
          </Badge>
        );
      case "CONVERTED":
        return (
          <Badge variant="success" className="text-[10px]">
            Facturada / Despachada
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge variant="danger" className="text-[10px]">
            Vencida
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="danger" className="text-[10px]">
            Rechazada
          </Badge>
        );
      default:
        return null;
    }
  };

  const columns: Column<QuotationRecord>[] = [
    {
      header: "Nº Cotización",
      accessorKey: "quotationNumber",
      cell: (item) => (
        <span className="font-mono text-xs font-semibold text-sky-700">
          {item.quotationNumber}
        </span>
      ),
    },
    {
      header: "Fecha & Validez",
      accessorKey: "quotationDate",
      cell: (item) => (
        <div className="text-xs text-neutral-700">
          <p>{new Date(item.quotationDate).toLocaleDateString("es-VE")}</p>
          <span className="text-[10px] text-neutral-500">
            Válida hasta: {item.validUntilDate}
          </span>
        </div>
      ),
    },
    {
      header: "Cliente & Doc",
      accessorKey: "customerName",
      cell: (item) => (
        <div>
          <p className="text-xs font-medium text-neutral-900">
            {item.customerName}
          </p>
          <span className="font-mono text-[10px] text-neutral-500">
            {item.customerDoc}
          </span>
        </div>
      ),
    },
    {
      header: "Sucursal",
      accessorKey: "branchName",
      cell: (item) => (
        <div className="flex items-center gap-1.5 text-xs text-neutral-600">
          <Building2 className="w-3.5 h-3.5 text-neutral-400" />
          <span>{item.branchName}</span>
        </div>
      ),
    },
    {
      header: "Total Cotizado",
      accessorKey: "totalAmount",
      cell: (item) => (
        <div className="text-right">
          <p className="text-xs font-semibold text-neutral-900 font-mono">
            {formatMoneyUSD(item.totalAmount)}
          </p>
          <p className="text-[10px] text-neutral-500 font-mono">
            {formatMoneyVES(item.totalAmount * item.exchangeRate)}
          </p>
        </div>
      ),
    },
    {
      header: "Estado",
      accessorKey: "status",
      cell: (item) => renderStatusBadge(item.status),
    },
    {
      header: "Acciones",
      accessorKey: "id",
      cell: (item) => (
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={() =>
              setPdfModal({
                isOpen: true,
                endpoint: `/api/sales/quotations/${item.id}/pdf`,
                title: `Cotización ${item.quotationNumber}`,
                filename: `cotizacion_${item.quotationNumber}.pdf`,
              })
            }
            className="p-1 text-neutral-500 hover:text-sky-600 rounded-lg hover:bg-neutral-100"
            title="Ver / Reimprimir Cotización en PDF"
          >
            <FileText className="w-4 h-4 text-sky-600" />
          </button>
          <button
            onClick={() => setViewingQuotation(item)}
            className="p-1 text-neutral-500 hover:text-sky-600 rounded-lg hover:bg-neutral-100"
            title="Ver Detalle"
          >
            <Eye className="w-4 h-4" />
          </button>
          {item.status === "EMITTED" && (
            <button
              onClick={() => handleAcceptQuotation(item.id)}
              className="p-1 text-emerald-600 hover:text-emerald-700 rounded-lg hover:bg-emerald-50"
              title="Aceptar Cotización"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {item.status === "ACCEPTED" && (
            <Button
              variant="outline"
              onClick={() => handleOpenInvoiceModal(item)}
              className="text-[11px] py-1 px-2 rounded-lg border-sky-300 text-sky-700 hover:bg-sky-50 flex items-center gap-1"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Facturar</span>
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
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
            Cotizaciones & Presupuestos
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Propuestas comerciales y presupuestos para clientes con conversión a
            facturas y notas de entrega
          </p>
        </div>
        <Button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs rounded-lg py-2 px-3 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Cotización</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">
              Cotizaciones Activas
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900 mt-2">
            {activeQuotationsCount}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">
            De {quotations.length} registradas
          </p>
        </Card>

        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">
              Monto Total Cotizado
            </span>
            <div className="w-7 h-7 rounded-lg bg-neutral-100 text-neutral-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900 mt-2 font-mono">
            {formatMoneyUSD(totalQuotedAmount)}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">
            Volumen presupuestado
          </p>
        </Card>

        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">
              Aprobadas para Facturar
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">
            {acceptedQuotationsCount}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">
            Aceptadas listas para emisión
          </p>
        </Card>

        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">
              Cotizaciones Facturadas
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-700 mt-2">
            {invoicedQuotations.length}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">
            {quotations.length > 0
              ? `${Math.round((invoicedQuotations.length / quotations.length) * 100)}% tasa de conversión`
              : "Sin cotizaciones en el ciclo"}
          </p>
        </Card>

        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">
              Monto Total Facturado
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            {formatMoneyUSD(totalInvoicedAmount)}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">
            Ventas cerradas y cobradas
          </p>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-200 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {["ALL", "EMITTED", "ACCEPTED", "CONVERTED", "EXPIRED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === st
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {st === "ALL" && "Todas"}
              {st === "EMITTED" && "Emitidas"}
              {st === "ACCEPTED" && "Aceptadas"}
              {st === "CONVERTED" && "Facturadas"}
              {st === "EXPIRED" && "Vencidas"}
            </button>
          ))}
        </div>

        {/* Filtros de Fecha */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-300">
            <Calendar className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <span className="text-[11px] text-neutral-500 font-medium">Desde:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-0 text-xs text-neutral-800 p-0 focus:ring-0 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-300">
            <span className="text-[11px] text-neutral-500 font-medium">Hasta:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-0 text-xs text-neutral-800 p-0 focus:ring-0 focus:outline-none"
            />
          </div>
          {(startDate || endDate) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              className="text-xs py-1 px-2.5 rounded-lg text-neutral-600 hover:text-neutral-900 flex items-center gap-1"
              title="Limpiar filtros de fecha"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabla de Cotizaciones */}
      <Card className="rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-sm">
        <DataTable
          columns={columns}
          data={filteredQuotations}
          isLoading={loading}
          searchPlaceholder="Buscar cotización por número, cliente o documento..."
        />
      </Card>

      {/* Modal Nueva Cotización */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-neutral-200 w-full max-w-4xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden my-auto">
            {/* Header (Pinned) */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  Nueva Cotización / Presupuesto
                </h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Propuesta comercial con precios de lista y cálculo tributario
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

            <form
              id="createQuotationForm"
              onSubmit={handleCreateQuotation}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Cliente Solicitante *
                    </label>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                      >
                        {availableCustomers.length === 0 ? (
                          <option value="">No hay clientes registrados</option>
                        ) : (
                          availableCustomers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.doc})
                            </option>
                          ))
                        )}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCustomerSearch(true)}
                        title="Buscar cliente en modal"
                        className="px-2.5 py-2 shrink-0 flex items-center gap-1 text-xs"
                      >
                        <Search className="w-3.5 h-3.5 text-neutral-500" />
                        {/* <span>Buscar</span> */}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Válida Hasta *
                    </label>
                    <input
                      type="date"
                      required
                      value={validUntilDate}
                      onChange={(e) => setValidUntilDate(e.target.value)}
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

                {/* Detalle de Productos Cotizados */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                      Productos Cotizados ({quotationItems.length})
                    </h4>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddingFromSearch(true)}
                        className="text-xs rounded-lg py-1 px-2.5 flex items-center gap-1.5"
                      >
                        <Search className="w-3.5 h-3.5 text-neutral-500" />
                        <span>Buscar en Catálogo</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
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
                          <th className="py-2.5 px-3 w-24">Cantidad</th>
                          <th className="py-2.5 px-3 w-28">Precio ($)</th>
                          <th className="py-2.5 px-3 w-24">IVA (%)</th>
                          <th className="py-2.5 px-3 w-24">Desc. (%)</th>
                          <th className="py-2.5 px-3 w-28 text-right">
                            Subtotal ($)
                          </th>
                          <th className="py-2.5 px-3 w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {quotationItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-neutral-50/50">
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={item.productId}
                                  onChange={(e) =>
                                    handleItemChange(
                                      idx,
                                      "productId",
                                      e.target.value,
                                    )
                                  }
                                  className="flex-1 text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-neutral-800 min-w-[140px]"
                                >
                                  {availableProducts.length === 0 ? (
                                    <option value="">Sin productos</option>
                                  ) : (
                                    availableProducts.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.sku} - {p.name}
                                      </option>
                                    ))
                                  )}
                                </select>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setProductSearchRowIdx(idx)}
                                  title="Buscar producto en modal"
                                  className="p-1.5 shrink-0"
                                >
                                  <Search className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    "quantity",
                                    e.target.value,
                                  )
                                }
                                className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-neutral-800"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    "unitPrice",
                                    e.target.value,
                                  )
                                }
                                className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-neutral-800"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={item.taxRate}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    "taxRate",
                                    e.target.value,
                                  )
                                }
                                className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2 py-1.5 text-neutral-800"
                              >
                                <option value="0">0%</option>
                                <option value="8">8%</option>
                                <option value="16">16%</option>
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={item.discountPercent}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    "discountPercent",
                                    e.target.value,
                                  )
                                }
                                className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2 py-1.5 text-neutral-800"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-neutral-900 font-mono">
                              {formatMoneyUSD(item.subtotal)}
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

                {/* Totales y Observaciones */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start pt-2">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Condiciones Comerciales y Observaciones
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Validez de la oferta, tiempos de entrega, forma de pago acordada..."
                      className="w-full text-xs bg-white border border-neutral-300 rounded-lg p-2.5 text-neutral-800"
                    />
                  </div>

                  <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200 space-y-2">
                    <div className="flex justify-between text-xs text-neutral-600">
                      <span>Subtotal Base Imponible:</span>
                      <span className="font-semibold font-mono">
                        {formatMoneyUSD(subtotalSum)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-neutral-600">
                      <span>IVA Estimado:</span>
                      <span className="font-semibold font-mono">
                        {formatMoneyUSD(taxSum)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-neutral-200 flex justify-between items-baseline">
                      <span className="text-sm font-bold text-neutral-900">
                        Total Presupuesto (USD):
                      </span>
                      <span className="text-base font-bold text-sky-700 font-mono">
                        {formatMoneyUSD(totalUSD)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-neutral-500">
                      <span>Equivalente en Bolívares (BCV):</span>
                      <span className="font-medium font-mono">
                        {formatMoneyVES(totalVES)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer (Pinned) */}
              <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2 shrink-0">
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
                  className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs rounded-lg py-2 px-4 shadow-sm"
                >
                  Emitir Cotización
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Facturar Cotización */}
      {invoicingQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-neutral-200 w-full max-w-3xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden my-auto">
            {/* Header (Pinned) */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-50 text-sky-700 rounded-lg border border-sky-200">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Facturar Cotización Directa
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Genera la factura oficial de venta con rebaja inmediata de stock
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInvoicingQuotation(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 cursor-pointer"
                title="Cerrar modal (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="invoiceQuotationForm"
              onSubmit={handleInvoiceQuotation}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                {/* Resumen de Cotización */}
                <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-neutral-900">
                        {invoicingQuotation.customerName}
                      </p>
                      <p className="text-neutral-500 font-mono text-[11px]">
                        {invoicingQuotation.customerDoc}
                      </p>
                    </div>
                    <Badge variant="neutral" className="text-[10px]">
                      {invoicingQuotation.quotationNumber}
                    </Badge>
                  </div>
                  <div className="mt-2 pt-2 border-t border-neutral-200 flex justify-between items-center">
                    <span className="text-neutral-600">Total a Facturar:</span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-neutral-900 font-mono">
                        {formatMoneyUSD(invoicingQuotation.totalAmount)}
                      </span>
                      <span className="text-[11px] text-neutral-500 block font-mono">
                        {formatMoneyVES(
                          invoicingQuotation.totalAmount * invoicingQuotation.exchangeRate
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {loadingInvoiceConfig ? (
                  <div className="space-y-3 py-4">
                    <div className="h-4 bg-neutral-200 rounded-lg animate-pulse w-3/4"></div>
                    <div className="h-8 bg-neutral-100 rounded-lg animate-pulse w-full"></div>
                    <div className="h-8 bg-neutral-100 rounded-lg animate-pulse w-full"></div>
                  </div>
                ) : (
                  <>
                    {/* Depósito de Despacho (Reserva de Stock) */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Depósito de Despacho (Reserva de Stock) <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={selectedWarehouseId || verificationResult?.warehouseId || (warehouses[0]?.id ?? "")}
                        onChange={(e) => {
                          const wh = e.target.value;
                          setSelectedWarehouseId(wh);
                          if (invoicingQuotation && wh) {
                            fetchInvoiceVerification(invoicingQuotation.id, wh);
                          }
                        }}
                        className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="">Seleccione un depósito...</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Verificación de Precios & Existencias en Depósito */}
                    <div className="bg-neutral-50 rounded-lg p-3.5 border border-neutral-200 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200/80 pb-2">
                        <div>
                          <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                            <FileCheck className="w-4 h-4 text-sky-600" />
                            <span>Verificación de Precios & Existencias</span>
                          </h4>
                          <p className="text-[11px] text-neutral-500">
                            Disponibilidad en almacén y comparación con precios de catálogo vigentes
                          </p>
                        </div>

                        {/* Badges de estado */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {loadingVerification ? (
                            <span className="text-[11px] text-neutral-400">Verificando...</span>
                          ) : verificationResult ? (
                            <>
                              {verificationResult.hasStockIssues ? (
                                <Badge variant="danger" className="text-[10px]">
                                  Stock Insuficiente ({verificationResult.insufficientCount})
                                </Badge>
                              ) : (
                                <Badge variant="success" className="text-[10px]">
                                  Stock Disponible
                                </Badge>
                              )}

                              {verificationResult.hasPriceVariations ? (
                                <Badge variant="warning" className="text-[10px]">
                                  Variación de Precios ({verificationResult.priceVariationsCount})
                                </Badge>
                              ) : (
                                <Badge variant="neutral" className="text-[10px]">
                                  Precios Sin Cambio
                                </Badge>
                              )}
                            </>
                          ) : null}
                        </div>
                      </div>

                      {loadingVerification ? (
                        <div className="py-4 text-center text-xs text-neutral-400">
                          Consultando existencias y precios en depósito...
                        </div>
                      ) : verificationResult ? (
                        <div className="space-y-3">
                          {/* Alerta de Stock Insuficiente */}
                          {verificationResult.hasStockIssues && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-semibold text-red-900">
                                  Inventario Insuficiente para Facturar
                                </p>
                                <p className="text-[11px] text-red-700 mt-0.5">
                                  Se detectaron {verificationResult.insufficientCount} productos sin existencias suficientes en el depósito seleccionado. No se podrá emitir la factura hasta que haya stock o se seleccione otro depósito.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Alerta de Variación de Precios & Selección de Política */}
                          {verificationResult.hasPriceVariations && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2">
                              <div className="flex items-start gap-2 text-amber-900">
                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-semibold">
                                    Variación de Precios con el Catálogo Actual
                                  </p>
                                  <p className="text-[11px] text-amber-800 mt-0.5">
                                    Existen {verificationResult.priceVariationsCount} productos cuyos precios vigentes difieren de lo cotizado originalmente.
                                    Diferencia total neta:{" "}
                                    <strong className="font-mono">
                                      {verificationResult.totalDifference > 0 ? "+" : ""}
                                      {formatCurrency(verificationResult.totalDifference, invoicingQuotation.currency)}
                                    </strong>
                                    .
                                  </p>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-800">
                                  <input
                                    type="radio"
                                    name="pricePolicy"
                                    checked={!updatePricesToCurrent}
                                    onChange={() => setUpdatePricesToCurrent(false)}
                                    className="text-sky-600 focus:ring-sky-500"
                                  />
                                  <span className="font-medium">
                                    Mantener Precios Cotizados ({formatCurrency(verificationResult.totalQuotedAmount, invoicingQuotation.currency)})
                                  </span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-800">
                                  <input
                                    type="radio"
                                    name="pricePolicy"
                                    checked={updatePricesToCurrent}
                                    onChange={() => setUpdatePricesToCurrent(true)}
                                    className="text-sky-600 focus:ring-sky-500"
                                  />
                                  <span className="font-medium">
                                    Actualizar a Precios Vigentes ({formatCurrency(verificationResult.totalCurrentAmount, invoicingQuotation.currency)})
                                  </span>
                                </label>
                              </div>
                            </div>
                          )}

                          {/* Tabla Resumen de Ítems */}
                          <div className="overflow-x-auto border border-neutral-200 rounded-lg bg-white">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-medium">
                                <tr>
                                  <th className="py-2 px-2.5">Producto</th>
                                  <th className="py-2 px-2 text-right">Cant.</th>
                                  <th className="py-2 px-2 text-center">Stock Depósito</th>
                                  <th className="py-2 px-2 text-right">P. Cotizado</th>
                                  <th className="py-2 px-2 text-right">P. Actual</th>
                                  <th className="py-2 px-2 text-right">Variación</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-100">
                                {verificationResult.items.map((item) => (
                                  <tr
                                    key={item.id}
                                    className={`hover:bg-neutral-50/50 ${
                                      !item.hasSufficientStock ? "bg-red-50/30" : ""
                                    }`}
                                  >
                                    <td className="py-2 px-2.5">
                                      <p className="font-medium text-neutral-900 leading-tight">
                                        {item.productName}
                                      </p>
                                      <span className="font-mono text-[10px] text-neutral-400">
                                        {item.productSku}
                                      </span>
                                    </td>
                                    <td className="py-2 px-2 text-right font-mono font-medium text-neutral-800">
                                      {item.quantity}
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                      {item.hasSufficientStock ? (
                                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                          <Check className="w-3 h-3 text-emerald-600" />
                                          {item.availableStock} disp.
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-lg border border-red-200">
                                          <AlertCircle className="w-3 h-3 text-red-600" />
                                          {item.availableStock} / {item.quantity} (Faltan {item.stockShortage})
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 px-2 text-right font-mono text-neutral-700">
                                      {formatCurrency(item.quotedUnitPrice, invoicingQuotation.currency)}
                                    </td>
                                    <td className="py-2 px-2 text-right font-mono text-neutral-700">
                                      {formatCurrency(item.currentBasePrice, invoicingQuotation.currency)}
                                    </td>
                                    <td className="py-2 px-2 text-right font-mono">
                                      {item.hasPriceVariation ? (
                                        <span
                                          className={`text-[11px] font-semibold ${
                                            item.priceDifference > 0
                                              ? "text-amber-700"
                                              : "text-sky-700"
                                          }`}
                                        >
                                          {item.priceDifference > 0 ? "+" : ""}
                                          {formatCurrency(item.priceDifference, invoicingQuotation.currency)} ({item.priceVariationPercent > 0 ? "+" : ""}{item.priceVariationPercent}%)
                                        </span>
                                      ) : (
                                        <span className="text-[11px] text-neutral-400">
                                          Sin cambio
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-400 italic">
                          Seleccione un depósito para verificar existencias y precios.
                        </p>
                      )}
                    </div>

                    {/* Modo de Facturación Administrativa */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Tipo / Modo de Facturación
                      </label>
                      <select
                        value={salesInvoiceMode}
                        onChange={(e) => setSalesInvoiceMode(e.target.value as any)}
                        className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="free_form">
                          Factura Fiscal Forma Libre / Talonario (Requiere Nº Control SENIAT)
                        </option>
                        <option value="fiscal_printer">
                          Impresora Fiscal (Control por máquina fiscal)
                        </option>
                        <option value="no_fiscal">
                          No Fiscal / Nota Interna (Sin Nº Control SENIAT)
                        </option>
                      </select>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        {salesInvoiceMode === "free_form" &&
                          "Modo Forma Libre: requiere número de control pre-impreso autorizado por el SENIAT."}
                        {salesInvoiceMode === "fiscal_printer" &&
                          "Modo Impresora Fiscal: el número de control es administrado automáticamente por el dispositivo fiscal."}
                        {salesInvoiceMode === "no_fiscal" &&
                          "Modo No Fiscal: no solicita número de control SENIAT."}
                      </p>
                    </div>

                    {/* Nº Factura de Venta */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Nº Factura de Venta <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. FACT-2026-00001"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        className="w-full text-xs font-mono bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Autogenerado por el correlativo de ventas. Puede modificarse si usa talonario físico.
                      </p>
                    </div>

                    {/* Nº Control SENIAT (condicional según modo) */}
                    {salesInvoiceMode === "free_form" && (
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Nº Control SENIAT <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. 00-009482"
                          value={controlNumber}
                          onChange={(e) => setControlNumber(e.target.value)}
                          className="w-full text-xs font-mono bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          Obligatorio según normativa SENIAT para facturas en forma libre pre-impresas.
                        </p>
                      </div>
                    )}

                    {salesInvoiceMode === "fiscal_printer" && (
                      <div className="bg-sky-50/60 p-2.5 rounded-lg border border-sky-200/80 flex items-center gap-2 text-sky-800 text-xs">
                        <Printer className="w-4 h-4 text-sky-600 shrink-0" />
                        <span>
                          Nº de Control emitido y gestionado automáticamente por la impresora fiscal.
                        </span>
                      </div>
                    )}

                    {/* Venta a Crédito Toggle */}
                    <div className="pt-2 border-t border-neutral-200">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="creditToggle"
                          checked={isCredit}
                          onChange={(e) => handleToggleCredit(e.target.checked)}
                          className="rounded-lg text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                        <label
                          htmlFor="creditToggle"
                          className="text-xs text-neutral-800 font-medium cursor-pointer"
                        >
                          Venta a Crédito (Registrar obligación pendiente en CxC)
                        </label>
                      </div>

                      {/* Cobro de Contado (cuando isCredit es false) */}
                      {!isCredit && (
                        <div className="mt-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
                          <div className="flex items-center justify-between border-b border-neutral-200/80 pb-2">
                            <span className="text-xs font-semibold text-neutral-900 flex items-center gap-1.5">
                              <DollarSign className="w-4 h-4 text-emerald-600" />
                              Registro de Cobro de Contado
                            </span>
                            <div className="text-right">
                              <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                {formatMoneyUSD(totalAmountToInvoice)}
                              </span>
                              <span className="text-[10px] text-neutral-500 block">
                                ≈ {formatMoneyVES(totalAmountToInvoice * (invoicingQuotation.exchangeRate || rate))}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Método de Pago */}
                            <div>
                              <label className="block text-xs font-medium text-neutral-700 mb-1">
                                Método de Pago <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={paymentMethod}
                                onChange={(e) => handlePaymentMethodChange(e.target.value)}
                                className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                              >
                                <option value="CASH_USD">Efectivo Dólares (USD)</option>
                                <option value="CASH_VES">Efectivo Bolívares (VES)</option>
                                <option value="TRANSFER">Transferencia Bancaria</option>
                                <option value="PAGO_MOVIL">Pago Móvil</option>
                                <option value="DEBIT_CARD">Tarjeta de Débito (Punto de Venta)</option>
                                <option value="CREDIT_CARD">Tarjeta de Crédito</option>
                                <option value="ZELLE">Zelle (USD)</option>
                                <option value="OTHER">Otro Medio</option>
                              </select>
                            </div>

                            {/* Cuenta Bancaria de Destino */}
                            <div>
                              <label className="block text-xs font-medium text-neutral-700 mb-1">
                                Cuenta Bancaria Receptora <span className="text-red-500">*</span>
                              </label>
                              <select
                                required
                                value={selectedBankAccountId}
                                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                                className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                              >
                                {bankAccounts.length === 0 ? (
                                  <option value="">No hay cuentas bancarias configuradas</option>
                                ) : (
                                  <>
                                    <option value="">Seleccione cuenta bancaria...</option>
                                    {bankAccounts.map((b) => (
                                      <option key={b.id} value={b.id}>
                                        {b.bankName ? `${b.bankName} - ` : ""}{b.description} ({b.currency}) ...{b.accountNumber.slice(-4)}
                                      </option>
                                    ))}
                                  </>
                                )}
                              </select>
                              <p className="text-[10px] text-neutral-500 mt-0.5">
                                Acredita el saldo en Tesorería y genera el movimiento bancario para conciliar.
                              </p>
                            </div>
                          </div>

                          {/* Referencia o Comprobante */}
                          <div>
                            <label className="block text-xs font-medium text-neutral-700 mb-1">
                              Nº de Referencia / Comprobante{" "}
                              {["TRANSFER", "PAGO_MOVIL", "ZELLE", "DEBIT_CARD"].includes(paymentMethod) && (
                                <span className="text-red-500">* (Requerido para conciliación)</span>
                              )}
                            </label>
                            <input
                              type="text"
                              placeholder="Ej. Ref. 192842 / Lote POS / Depósito"
                              value={paymentReference}
                              onChange={(e) => setPaymentReference(e.target.value)}
                              className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-1.5 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                            <p className="text-[10px] text-neutral-500 mt-0.5">
                              Este número se utiliza en el módulo de Tesorería para el cotejo con el extracto bancario.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Venta a Crédito (cuando isCredit es true) */}
                      {isCredit && (
                        <div className="mt-3 space-y-3 pl-6 border-l-2 border-sky-200">
                          {/* Alerta si el cliente no tiene crédito autorizado */}
                          {customerCreditInfo && !customerCreditInfo.creditEnabled && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-semibold">Línea de Crédito No Autorizada</p>
                                <p className="text-[11px] text-red-600 mt-0.5">
                                  El cliente {invoicingQuotation.customerName} no tiene crédito comercial habilitado. Debe registrarse como venta de contado o habilitar el crédito comercial en la ficha del cliente.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Información de Crédito del Cliente */}
                          <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 space-y-1.5 text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-neutral-500">Crédito Habilitado:</span>
                              <span
                                className={`font-semibold ${
                                  customerCreditInfo?.creditEnabled
                                    ? "text-emerald-700"
                                    : "text-red-600"
                                }`}
                              >
                                {customerCreditInfo?.creditEnabled ? "Sí (Autorizado)" : "No Autorizado"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-500">Límite de Crédito:</span>
                              <span className="font-mono font-medium text-neutral-800">
                                {formatMoneyUSD(currentCreditLimit)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-500">Deuda Actual CxC:</span>
                              <span className="font-mono font-medium text-amber-700">
                                {formatMoneyUSD(currentCustomerDebt)}
                              </span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-neutral-200">
                              <span className="text-neutral-700 font-medium">Crédito Disponible:</span>
                              <span
                                className={`font-mono font-bold ${
                                  availableCredit >= totalAmountToInvoice
                                    ? "text-emerald-700"
                                    : "text-red-600"
                                }`}
                              >
                                {formatMoneyUSD(availableCredit)}
                              </span>
                            </div>
                          </div>

                          {/* Fecha de Vencimiento Calculada */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-medium text-neutral-700">
                                Fecha de Vencimiento <span className="text-red-500">*</span>
                              </label>
                              <span className="text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded-lg font-medium border border-sky-200">
                                Plazo acordado: {customerCreditInfo?.paymentTermsDays || invoicingQuotation.paymentTermsDays || 15} días
                              </span>
                            </div>
                            <input
                              type="date"
                              required
                              value={dueDate}
                              onChange={(e) => setDueDate(e.target.value)}
                              className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                            <p className="text-[11px] text-neutral-500 mt-0.5">
                              Calculada automáticamente a partir del plazo comercial establecido para el cliente.
                            </p>
                          </div>

                          {/* Alerta de Límite de Crédito Excedido */}
                          {isCreditExceeded && (
                            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-2">
                              <div className="flex items-start gap-2">
                                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-semibold text-amber-900 text-xs">
                                    Límite de Crédito Excedido
                                  </p>
                                  <p className="text-[11px] text-amber-800 mt-0.5">
                                    El monto de la venta ({formatMoneyUSD(totalAmountToInvoice)}) supera el crédito disponible ({formatMoneyUSD(availableCredit)}) en{" "}
                                    <strong>{formatMoneyUSD(creditExceededAmount)}</strong>.
                                  </p>
                                </div>
                              </div>

                              {requireApprovalCreditExceeded ? (
                                <div className="mt-2 pt-2 border-t border-amber-200/80">
                                  {isUserAdmin ? (
                                    /* Administrador autoriza directamente */
                                    <div className="space-y-2">
                                      <label className="flex items-start gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={adminAuthorized}
                                          onChange={(e) => setAdminAuthorized(e.target.checked)}
                                          className="rounded-lg text-sky-600 focus:ring-sky-500 mt-0.5"
                                        />
                                        <span className="text-xs font-semibold text-neutral-900">
                                          Autorizo este sobregiro con mis credenciales de Administrador ({user?.fullName || "Administrador"})
                                        </span>
                                      </label>
                                      {adminAuthorized && (
                                        <input
                                          type="text"
                                          placeholder="Motivo o justificación de la autorización (opcional)"
                                          value={supervisorNotes}
                                          onChange={(e) => setSupervisorNotes(e.target.value)}
                                          className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-1.5 text-neutral-800"
                                        />
                                      )}
                                    </div>
                                  ) : (
                                    /* Usuario regular requiere credenciales de supervisor */
                                    <div className="space-y-2.5">
                                      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
                                        <Lock className="w-3.5 h-3.5 text-amber-700" />
                                        <span>Autorización de Supervisor / Administrador</span>
                                      </div>
                                      <div>
                                        <label className="block text-[11px] font-medium text-neutral-700 mb-0.5">
                                          Usuario o Correo del Supervisor <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                          type="text"
                                          required={isCredit && isCreditExceeded}
                                          placeholder="supervisor@empresa.com"
                                          value={supervisorUsername}
                                          onChange={(e) => setSupervisorUsername(e.target.value)}
                                          className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-1.5 text-neutral-800"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[11px] font-medium text-neutral-700 mb-0.5">
                                          Contraseña del Supervisor <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                          type="password"
                                          required={isCredit && isCreditExceeded}
                                          placeholder="••••••••"
                                          value={supervisorPassword}
                                          onChange={(e) => setSupervisorPassword(e.target.value)}
                                          className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-1.5 text-neutral-800"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[11px] font-medium text-neutral-700 mb-0.5">
                                          Justificación de la autorización
                                        </label>
                                        <input
                                          type="text"
                                          placeholder="Ej. Aprobado según acuerdo comercial telefónico"
                                          value={supervisorNotes}
                                          onChange={(e) => setSupervisorNotes(e.target.value)}
                                          className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-1.5 text-neutral-800"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-red-600 font-medium">
                                  La configuración de la empresa no admite sobregiros de crédito para clientes.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Footer (Pinned) */}
              <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInvoicingQuotation(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    loadingInvoiceConfig ||
                    loadingVerification ||
                    Boolean(verificationResult?.hasStockIssues) ||
                    (isCredit && customerCreditInfo !== null && !customerCreditInfo.creditEnabled) ||
                    (isCredit && isCreditExceeded && enforceCreditLimit && !requireApprovalCreditExceeded)
                  }
                  className={`text-white font-medium text-xs rounded-lg py-2 px-4 shadow-sm ${
                    verificationResult?.hasStockIssues
                      ? "bg-neutral-400 cursor-not-allowed hover:bg-neutral-400"
                      : "bg-sky-600 hover:bg-sky-700"
                  }`}
                >
                  {verificationResult?.hasStockIssues
                    ? "Bloqueado (Stock Insuficiente)"
                    : "Emitir Factura y Rebajar Stock"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver Detalle */}
      {viewingQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-neutral-200 w-full max-w-xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden my-auto">
            {/* Header (Pinned) */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-neutral-900">
                  {viewingQuotation.quotationNumber}
                </h3>
                {renderStatusBadge(viewingQuotation.status)}
              </div>
              <button
                type="button"
                onClick={() => setViewingQuotation(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 cursor-pointer"
                title="Cerrar modal (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                <div>
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">
                    Cliente
                  </span>
                  <p className="font-semibold text-neutral-900">
                    {viewingQuotation.customerName}
                  </p>
                  <p className="font-mono text-neutral-500">
                    {viewingQuotation.customerDoc}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">
                    Emisión / Validez
                  </span>
                  <p className="text-neutral-800">
                    {new Date(
                      viewingQuotation.quotationDate,
                    ).toLocaleDateString("es-VE")}
                  </p>
                  <p className="text-neutral-500">
                    Hasta: {viewingQuotation.validUntilDate}
                  </p>
                </div>
              </div>

              {viewingQuotation.notes && (
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">
                    Observaciones
                  </span>
                  <p className="text-neutral-700 mt-0.5">
                    {viewingQuotation.notes}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-neutral-200 flex justify-between items-baseline">
                <span className="text-xs text-neutral-500">
                  Tasa: Bs.{" "}
                  {formatExchangeRate(viewingQuotation.exchangeRate, 2)}/USD
                </span>
                <div className="text-right">
                  <p className="text-lg font-bold text-neutral-900 font-mono">
                    Total: {formatMoneyUSD(viewingQuotation.totalAmount)}
                  </p>
                  <p className="text-xs text-neutral-500 font-mono">
                    {formatMoneyVES(
                      viewingQuotation.totalAmount *
                        viewingQuotation.exchangeRate,
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer (Pinned) */}
            <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => {
                  setPdfModal({
                    isOpen: true,
                    endpoint: `/api/sales/quotations/${viewingQuotation.id}/pdf`,
                    title: `Cotización Comercial ${viewingQuotation.quotationNumber}`,
                    filename: `cotizacion_${viewingQuotation.quotationNumber}.pdf`,
                  });
                }}
              >
                <FileText className="w-4 h-4 mr-1.5" />
                Descargar / Ver PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingQuotation(null)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Buscador de Clientes */}
      <CustomerSearchModal
        isOpen={showCustomerSearch}
        onClose={() => setShowCustomerSearch(false)}
        onSelect={(c) => setSelectedCustomerId(c.id)}
        customers={availableCustomers}
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
            handleItemChange(productSearchRowIdx, "productId", prod.id);
          }
        }}
        products={availableProducts}
        mode="sale"
      />

      {/* Modal Visor / Descarga PDF de Cotización */}
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
