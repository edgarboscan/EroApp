import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Building2,
  GitBranch,
  Warehouse,
  SlidersHorizontal,
  CheckCircle2,
  Save,
  Plus,
  ShieldCheck,
  Percent,
  Coins,
  Lock,
  Edit2,
  History,
  Printer,
  CreditCard,
  Trash2,
  Image as ImageIcon,
  UploadCloud,
  FileImage,
  RefreshCw,
  X,
  Eye,
  Database,
  Download,
  Server,
  AlertTriangle,
  Key,
  Copy,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { useAuthStore, isSuperAdminRole } from "../../stores/authStore";
import { LicenseInfo } from "@ero/shared";
import { useExchangeRateStore } from "../../stores/exchangeRateStore";
import {
  UpdateCompanyInput,
  BranchInput,
  WarehouseInput,
  UpdateBusinessRulesInput,
  formatExchangeRate,
  formatMoneyUSD,
  formatMoneyVES,
} from "@ero/shared";
import { showConfirmQuestion } from "../../lib/sweetalert";
import { PaymentMethodsConfigView } from "./PaymentMethodsConfigView";

export interface CashRegisterConfigItem {
  id: string;
  branchId: string;
  branchName?: string;
  warehouseId?: string | null;
  warehouseName?: string | null;
  code: string;
  name: string;
  fiscalPrinterSerial?: string | null;
  invoiceMode: "fiscal_printer" | "normal_printer";
  ticketPrinterType?: "thermal_80mm" | "thermal_58mm" | "generic_esc_pos" | "windows_spooler" | "pdf_virtual";
  ticketPrinterName?: string | null;
  ticketPrintMode?: "direct" | "prompt";
  defaultBankAccountIdVES?: string | null;
  defaultBankAccountIdUSD?: string | null;
  allowedDepartmentIds?: string[];
  acceptsOrders?: boolean;
  isActive: boolean;
}

export const CompanyConfigView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as any) || "company";
  const [activeTab, setActiveTab] = useState<
    "company" | "branches" | "registers" | "rules" | "payment-methods" | "maintenance"
  >(
    [
      "company",
      "branches",
      "registers",
      "rules",
      "payment-methods",
      "maintenance",
    ].includes(initialTab)
      ? initialTab
      : "company",
  );
  const [loading, setLoading] = useState(false);

  // Estados de Mantenimiento de BD y Nueva Empresa (Superadmin)
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [showInitCompanyModal, setShowInitCompanyModal] = useState(false);
  const [isInitializingCompany, setIsInitializingCompany] = useState(false);
  const [initResult, setInitResult] = useState<any>(null);
  const [showInitResultModal, setShowInitResultModal] = useState(false);

  const [initCompanyForm, setInitCompanyForm] = useState({
    legalName: "",
    tradeName: "",
    rif: "",
    fiscalAddress: "",
    phone: "",
    email: "",
    isSpecialTaxpayer: false,
    ivaRetentionRate: 75,
    currencyBase: "USD",
    currencySecondary: "VES",
    adminFullName: "",
    adminUsername: "",
    adminEmail: "",
    adminPassword: "",
    securityConfirmation: "",
    activateLicenseMode: "trial" as "trial" | "custom",
    licenseKey: "",
  });

  // Permisos y Tasa Oficial de Cambio
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canEditRate =
    isSuperAdminRole(user?.role) ||
    hasPermission("pricing", "exchange_rate") ||
    hasPermission("pricing", "bulk_update") ||
    hasPermission("config", "write");

  const {
    rate,
    source,
    updatedBy,
    updatedAt,
    history,
    isHistoryLoading,
    updateRate,
    fetchRate,
    fetchHistory,
  } = useExchangeRateStore();
  const [showRateModal, setShowRateModal] = useState(false);
  const [showRateHistoryModal, setShowRateHistoryModal] = useState(false);
  const [formRate, setFormRate] = useState(rate.toString());
  const [formSource, setFormSource] = useState(source);
  const [formNotes, setFormNotes] = useState("");
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);

  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  useEffect(() => {
    setFormRate(rate.toString());
    setFormSource(source);
  }, [rate, source]);

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(formRate);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Ingrese una tasa de cambio válida mayor a 0");
      return;
    }
    setIsUpdatingRate(true);
    try {
      await updateRate(parsed, formSource, formNotes);
      toast.success(
        `Tasa oficial actualizada a Bs. ${formatExchangeRate(parsed, 4)} por USD`,
      );
      setShowRateModal(false);
      setFormNotes("");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al actualizar la tasa";
      toast.error(msg);
    } finally {
      setIsUpdatingRate(false);
    }
  };

  const handleDownloadBackup = async () => {
    if (!token) return;
    setIsDownloadingBackup(true);
    try {
      const response = await fetch("/api/config/database/backup", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message ||
            "Error al generar el respaldo de la base de datos",
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-");
      a.download = `ero_erp_backup_${timestamp}.sql`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(
        "Respaldo completo de base de datos generado y descargado (.sql)",
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al descargar el respaldo";
      toast.error(msg);
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  const handleInitializeCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (initCompanyForm.securityConfirmation !== "INICIALIZAR_EMPRESA") {
      toast.error(
        'Debe escribir exactamente "INICIALIZAR_EMPRESA" en la confirmación de seguridad.',
      );
      return;
    }

    if (
      !initCompanyForm.legalName.trim() ||
      !initCompanyForm.rif.trim() ||
      !initCompanyForm.fiscalAddress.trim()
    ) {
      toast.error(
        "Complete los campos obligatorios de la empresa (Razón Social, RIF y Dirección Fiscal).",
      );
      return;
    }

    if (
      initCompanyForm.activateLicenseMode === "custom" &&
      !initCompanyForm.licenseKey.trim()
    ) {
      toast.error(
        "Ingrese la clave o paquete de licencia a activar para la nueva empresa.",
      );
      return;
    }

    const confirmed = await showConfirmQuestion({
      title: "¿Inicializar y Aprovisionar Nueva Empresa?",
      text: `Se creará la empresa ${initCompanyForm.legalName} (${initCompanyForm.rif}) con sucursal principal, almacén central, caja registradora, métodos de pago y usuario administrador.`,
      confirmButtonText: "Sí, inicializar empresa",
      cancelButtonText: "Cancelar",
      icon: "warning",
    });

    if (!confirmed) return;

    setIsInitializingCompany(true);
    try {
      const res = await fetch("/api/config/database/initialize-company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          securityConfirmation: "INICIALIZAR_EMPRESA",
          companyData: {
            legalName: initCompanyForm.legalName.trim(),
            tradeName: initCompanyForm.tradeName.trim() || undefined,
            rif: initCompanyForm.rif.trim().toUpperCase(),
            fiscalAddress: initCompanyForm.fiscalAddress.trim(),
            phone: initCompanyForm.phone.trim() || undefined,
            email: initCompanyForm.email.trim() || undefined,
            isSpecialTaxpayer: initCompanyForm.isSpecialTaxpayer,
            ivaRetentionRate: initCompanyForm.isSpecialTaxpayer
              ? initCompanyForm.ivaRetentionRate
              : 0,
            currencyBase: initCompanyForm.currencyBase,
            currencySecondary: initCompanyForm.currencySecondary,
            adminFullName: initCompanyForm.adminFullName.trim() || undefined,
            adminUsername: initCompanyForm.adminUsername.trim() || undefined,
            adminEmail: initCompanyForm.adminEmail.trim() || undefined,
            adminPassword: initCompanyForm.adminPassword.trim() || undefined,
            activateTrialLicense:
              initCompanyForm.activateLicenseMode === "trial",
            licenseKey:
              initCompanyForm.activateLicenseMode === "custom"
                ? initCompanyForm.licenseKey.trim()
                : undefined,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          json?.error?.message || "Error al inicializar la nueva empresa",
        );
      }

      toast.success(
        "¡Nueva empresa inicializada y aprovisionada exitosamente!",
      );
      setInitResult(json.data);
      setShowInitCompanyModal(false);
      setShowInitResultModal(true);

      // Limpiar formulario
      setInitCompanyForm({
        legalName: "",
        tradeName: "",
        rif: "",
        fiscalAddress: "",
        phone: "",
        email: "",
        isSpecialTaxpayer: false,
        ivaRetentionRate: 75,
        currencyBase: "USD",
        currencySecondary: "VES",
        adminFullName: "",
        adminUsername: "",
        adminEmail: "",
        adminPassword: "",
        securityConfirmation: "",
        activateLicenseMode: "trial",
        licenseKey: "",
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al inicializar la empresa";
      toast.error(msg);
    } finally {
      setIsInitializingCompany(false);
    }
  };

  // Estados de datos
  const [company, setCompany] = useState<UpdateCompanyInput>({
    legalName: "CORPORACION VENEZOLANA ERO C.A.",
    tradeName: "ERO DISTRIBUCION",
    rif: "J-12345678-9",
    fiscalAddress:
      "Av. Francisco de Miranda, Torre Cavendes, Piso 8, Chacao, Caracas, Venezuela",
    phone: "+58 212 555-0199",
    email: "administracion@erove.com",
    isSpecialTaxpayer: true,
    ivaRetentionRate: 75.0,
    currencyBase: "USD",
    currencySecondary: "VES",
    reportCurrency: "BOTH",
    showLogoInReports: true,
    reportLogoType: "default",
    customLogoUrl: null,
  });

  // Procesamiento y compresión mandatoria a WebP de logos para reportes
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [logoStats, setLogoStats] = useState<{
    originalSize: string;
    compressedSize: string;
    dimensions: string;
  } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleLogoUpload = (file: File) => {
    const validMimes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/svg+xml",
    ];
    if (!validMimes.includes(file.type)) {
      toast.error(
        "Formato no admitido. Seleccione un archivo PNG, JPG, JPEG o WebP.",
      );
      return;
    }

    const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
    if (file.size > MAX_SIZE) {
      toast.error("El archivo seleccionado excede el límite máximo de 2 MB.");
      return;
    }

    setIsProcessingLogo(true);
    const origSizeKb = (file.size / 1024).toFixed(1) + " KB";

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const origWidth = img.naturalWidth || img.width;
        const origHeight = img.naturalHeight || img.height;

        // Limitar a máximo 800px para densidad óptima en PDFs sin sobrepeso
        let targetWidth = origWidth;
        let targetHeight = origHeight;
        const MAX_DIM = 800;

        if (targetWidth > MAX_DIM || targetHeight > MAX_DIM) {
          if (targetWidth > targetHeight) {
            targetHeight = Math.round((targetHeight * MAX_DIM) / targetWidth);
            targetWidth = MAX_DIM;
          } else {
            targetWidth = Math.round((targetWidth * MAX_DIM) / targetHeight);
            targetHeight = MAX_DIM;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          toast.error("No se pudo inicializar el procesador de imágenes.");
          setIsProcessingLogo(false);
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Compresión y conversión obligatoria a formato WebP
        const webpDataUrl = canvas.toDataURL("image/webp", 0.85);

        // Medir tamaño resultante
        const base64Body = webpDataUrl.split(",")[1] || "";
        const compressedBytes = Math.round((base64Body.length * 3) / 4);
        const compSizeKb = (compressedBytes / 1024).toFixed(1) + " KB";

        setCompany((prev) => ({
          ...prev,
          customLogoUrl: webpDataUrl,
          reportLogoType: "custom",
          showLogoInReports: true,
        }));

        setLogoStats({
          originalSize: origSizeKb,
          compressedSize: compSizeKb,
          dimensions: `${targetWidth} × ${targetHeight} px`,
        });

        setIsProcessingLogo(false);
        toast.success("Logo convertido a WebP y comprimido correctamente.");
      };

      img.onerror = () => {
        toast.error("Error al decodificar la imagen.");
        setIsProcessingLogo(false);
      };

      if (typeof e.target?.result === "string") {
        img.src = e.target.result;
      }
    };

    reader.onerror = () => {
      toast.error("Error al leer el archivo.");
      setIsProcessingLogo(false);
    };

    reader.readAsDataURL(file);
  };

  const [branches, setBranches] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [rules, setRules] = useState<UpdateBusinessRulesInput>({
    allowCreditSales: true,
    requireApprovalDiscount: true,
    maxDiscountAllowed: 10.0,
    posInvoiceMode: "normal_printer",
    salesInvoiceMode: "free_form",
    taxAffectsFinalPrice: true,
    enforceCreditLimit: true,
    requireApprovalCreditExceeded: true,
    allowNegativeStock: true,
    requireApprovalNegativeStock: true,
    retentionPeriodYears: 5,
  });

  // Modales
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);

  // Cajas registradoras (POS)
  const [registers, setRegisters] = useState<CashRegisterConfigItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editingRegisterId, setEditingRegisterId] = useState<string | null>(
    null,
  );
  const [registerForm, setRegisterForm] = useState({
    branchId: "",
    warehouseId: "",
    code: "",
    name: "",
    isFiscal: false,
    fiscalPrinterSerial: "",
    ticketPrinterType: "thermal_80mm" as "thermal_80mm" | "thermal_58mm" | "generic_esc_pos" | "windows_spooler" | "pdf_virtual",
    ticketPrinterName: "",
    ticketPrintMode: "prompt" as "direct" | "prompt",
    defaultBankAccountIdVES: "",
    defaultBankAccountIdUSD: "",
    allowedDepartmentIds: [] as string[],
    acceptsOrders: true,
    isActive: true,
  });
  const [availableDepartments, setAvailableDepartments] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [isSavingRegister, setIsSavingRegister] = useState(false);

  // Formularios de modales
  const [branchForm, setBranchForm] = useState<BranchInput>({
    code: "",
    name: "",
    address: "",
    phone: "",
    isMain: false,
    isActive: true,
  });

  const [warehouseForm, setWarehouseForm] = useState<WarehouseInput>({
    branchId: "",
    code: "",
    name: "",
    isDefault: false,
    isDefaultSales: false,
    isDefaultPurchases: false,
    isActive: true,
  });

  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(
    null,
  );

  const fetchConfigData = async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const [compRes, branchRes, whRes, rulesRes, regRes, deptsRes, licRes] =
        await Promise.all([
          fetch("/api/config/company", { headers }),
          fetch("/api/config/branches", { headers }),
          fetch("/api/config/warehouses", { headers }),
          fetch("/api/config/business-rules", { headers }),
          fetch("/api/pos/registers", { headers }),
          fetch("/api/inventory/departments", { headers }),
          fetch("/api/licenses/status", { headers }),
        ]);

      if (deptsRes && deptsRes.ok) {
        const d = await deptsRes.json();
        if (d.success && Array.isArray(d.data)) {
          setAvailableDepartments(d.data);
        }
      }
      if (licRes && licRes.ok) {
        const d = await licRes.json();
        if (d.success && d.data) {
          setLicense(d.data);
        }
      }

      if (compRes.ok) {
        const d = await compRes.json();
        if (d.success && d.data) {
          setCompany({
            ...d.data,
            reportCurrency: d.data.reportCurrency || "BOTH",
            showLogoInReports:
              d.data.showLogoInReports !== undefined
                ? d.data.showLogoInReports
                : true,
            reportLogoType: d.data.reportLogoType || "default",
            customLogoUrl: d.data.customLogoUrl || null,
          });
        }
      }
      if (branchRes.ok) {
        const d = await branchRes.json();
        if (d.success && d.data) {
          setBranches(d.data);
          if (d.data.length > 0 && !warehouseForm.branchId) {
            setWarehouseForm((prev) => ({ ...prev, branchId: d.data[0].id }));
          }
          if (d.data.length > 0 && !registerForm.branchId) {
            setRegisterForm((prev) => ({ ...prev, branchId: d.data[0].id }));
          }
        }
      }
      if (whRes.ok) {
        const d = await whRes.json();
        if (d.success && d.data) {
          setWarehouses(d.data);
          if (d.data.length > 0 && !registerForm.warehouseId) {
            const defWh =
              d.data.find((w: any) => w.isDefaultSales)?.id ||
              d.data.find((w: any) => w.isDefault)?.id ||
              d.data[0].id;
            setRegisterForm((prev) => ({
              ...prev,
              warehouseId: prev.warehouseId || defWh,
            }));
          }
        }
      }
      if (rulesRes.ok) {
        const d = await rulesRes.json();
        if (d.success && d.data) setRules(d.data);
      }
      if (regRes.ok) {
        const d = await regRes.json();
        if (d.success && Array.isArray(d.data)) setRegisters(d.data);
      }
      try {
        const bankRes = await fetch("/api/treasury/accounts", { headers });
        if (bankRes.ok) {
          const d = await bankRes.json();
          if (d.success && Array.isArray(d.data)) setBankAccounts(d.data);
        }
      } catch {
        // Ignorar si tesorería no responde
      }
    } catch {
      toast.error("Error al sincronizar configuración con el servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateRegister = () => {
    const firstBranch = branches[0]?.id || "";
    const availableWh = warehouses.filter(
      (w) => !w.branchId || w.branchId === firstBranch,
    );
    const defaultWh =
      availableWh.find((w) => w.isDefault)?.id ||
      availableWh[0]?.id ||
      warehouses[0]?.id ||
      "";
    setEditingRegisterId(null);
    setRegisterForm({
      branchId: firstBranch,
      warehouseId: defaultWh,
      code: "",
      name: "",
      isFiscal: false,
      fiscalPrinterSerial: "",
      ticketPrinterType: "thermal_80mm",
      ticketPrinterName: "",
      ticketPrintMode: "prompt",
      defaultBankAccountIdVES: "",
      defaultBankAccountIdUSD: "",
      allowedDepartmentIds: [],
      acceptsOrders: true,
      isActive: true,
    });
    setShowRegisterModal(true);
  };

  const handleOpenEditRegister = (reg: CashRegisterConfigItem) => {
    setEditingRegisterId(reg.id);
    setRegisterForm({
      branchId: reg.branchId,
      warehouseId: reg.warehouseId || "",
      code: reg.code,
      name: reg.name,
      isFiscal: reg.invoiceMode === "fiscal_printer",
      fiscalPrinterSerial: reg.fiscalPrinterSerial || "",
      ticketPrinterType: reg.ticketPrinterType || "thermal_80mm",
      ticketPrinterName: reg.ticketPrinterName || "",
      ticketPrintMode: reg.ticketPrintMode || "prompt",
      defaultBankAccountIdVES: reg.defaultBankAccountIdVES || "",
      defaultBankAccountIdUSD: reg.defaultBankAccountIdUSD || "",
      allowedDepartmentIds: reg.allowedDepartmentIds || [],
      acceptsOrders: reg.acceptsOrders !== false,
      isActive: reg.isActive,
    });
    setShowRegisterModal(true);
  };

  const handleSaveRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !registerForm.branchId ||
      !registerForm.code.trim() ||
      !registerForm.name.trim()
    ) {
      toast.error("Sucursal, código y nombre de caja son obligatorios");
      return;
    }
    if (registerForm.isFiscal && !registerForm.fiscalPrinterSerial.trim()) {
      toast.error(
        "El serial de la impresora fiscal es obligatorio si la caja es fiscal",
      );
      return;
    }

    setIsSavingRegister(true);
    try {
      const payload = {
        branchId: registerForm.branchId,
        warehouseId: registerForm.warehouseId || null,
        code: registerForm.code.trim().toUpperCase(),
        name: registerForm.name.trim(),
        invoiceMode: registerForm.isFiscal
          ? "fiscal_printer"
          : "normal_printer",
        fiscalPrinterSerial: registerForm.isFiscal
          ? registerForm.fiscalPrinterSerial.trim().toUpperCase()
          : null,
        ticketPrinterType: !registerForm.isFiscal
          ? registerForm.ticketPrinterType
          : "thermal_80mm",
        ticketPrinterName: !registerForm.isFiscal
          ? registerForm.ticketPrinterName.trim() || null
          : null,
        ticketPrintMode: !registerForm.isFiscal
          ? registerForm.ticketPrintMode
          : "prompt",
        defaultBankAccountIdVES: registerForm.defaultBankAccountIdVES || null,
        defaultBankAccountIdUSD: registerForm.defaultBankAccountIdUSD || null,
        allowedDepartmentIds: registerForm.allowedDepartmentIds,
        acceptsOrders: registerForm.acceptsOrders,
        isActive: registerForm.isActive,
      };

      const url = editingRegisterId
        ? `/api/pos/registers/${editingRegisterId}`
        : "/api/pos/registers";
      const method = editingRegisterId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          data.error?.message || "Error al guardar caja registradora",
        );
      }

      toast.success(
        editingRegisterId
          ? "Caja registradora actualizada"
          : "Caja registradora creada con éxito",
      );
      setShowRegisterModal(false);
      fetchConfigData();
    } catch (err: any) {
      toast.error(err.message || "Error de red al guardar caja");
    } finally {
      setIsSavingRegister(false);
    }
  };

  const handleToggleRegisterActive = async (reg: CashRegisterConfigItem) => {
    try {
      const res = await fetch(`/api/pos/registers/${reg.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ isActive: !reg.isActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          data.error?.message || "Error al cambiar estado de la caja",
        );
      }
      toast.success(
        `Caja ${reg.code} ${!reg.isActive ? "activada" : "desactivada"} exitosamente`,
      );
      fetchConfigData();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar estado de la caja");
    }
  };

  useEffect(() => {
    fetchConfigData();
  }, []);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: UpdateCompanyInput = {
        legalName: company.legalName.trim(),
        tradeName: company.tradeName?.trim() || null,
        rif: company.rif.trim().toUpperCase(),
        fiscalAddress: company.fiscalAddress.trim(),
        phone: company.phone?.trim() || null,
        email: company.email?.trim() || null,
        isSpecialTaxpayer: Boolean(company.isSpecialTaxpayer),
        ivaRetentionRate: Number(company.ivaRetentionRate || 0),
        currencyBase: company.currencyBase,
        currencySecondary: company.currencySecondary,
        reportCurrency: company.reportCurrency || "BOTH",
        showLogoInReports: company.showLogoInReports !== false,
        reportLogoType: company.reportLogoType || "default",
        customLogoUrl: company.customLogoUrl || null,
      };

      const res = await fetch("/api/config/company", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Perfil fiscal y datos de empresa actualizados");
        fetchConfigData();
      } else {
        const errorMsg =
          data.error?.message ||
          (data.error?.issues && data.error.issues[0]?.message) ||
          "Error al guardar empresa";
        toast.error(errorMsg);
      }
    } catch {
      toast.error("Error de red al actualizar perfil de empresa");
    }
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/config/business-rules", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(rules),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Reglas de negocio empresariales actualizadas");
      } else {
        toast.error(data.error?.message || "Error al guardar reglas");
      }
    } catch {
      toast.error("Error de red al actualizar reglas de negocio");
    }
  };

  const handleOpenCreateBranch = () => {
    setEditingBranchId(null);
    setBranchForm({
      code: "",
      name: "",
      address: "",
      phone: "",
      isMain: false,
      isActive: true,
    });
    setShowBranchModal(true);
  };

  const handleOpenEditBranch = (b: any) => {
    setEditingBranchId(b.id);
    setBranchForm({
      code: b.code,
      name: b.name,
      address: b.address || "",
      phone: b.phone || "",
      isMain: Boolean(b.isMain),
      isActive: b.isActive ?? true,
    });
    setShowBranchModal(true);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.code || !branchForm.name) {
      toast.error("Código y nombre de sucursal obligatorios");
      return;
    }
    try {
      const url = editingBranchId
        ? `/api/config/branches/${editingBranchId}`
        : "/api/config/branches";
      const method = editingBranchId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(branchForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          editingBranchId
            ? `Sucursal ${branchForm.code} actualizada con éxito`
            : `Sucursal ${branchForm.code} creada con éxito`,
        );
        setShowBranchModal(false);
        setEditingBranchId(null);
        setBranchForm({
          code: "",
          name: "",
          address: "",
          phone: "",
          isMain: false,
          isActive: true,
        });
        fetchConfigData();
      } else {
        toast.error(data.error?.message || "Error al guardar sucursal");
      }
    } catch {
      toast.error("Error de red al guardar sucursal");
    }
  };

  const handleDeleteBranch = async (id: string, name: string) => {
    const confirmDelete = await showConfirmQuestion({
      title: "¿Eliminar sucursal?",
      text: `¿Está seguro de que desea eliminar o desactivar la sucursal "${name}"?\n\nSi posee almacenes, cajas o ventas asociadas, será desactivada lógicamente para preservar el historial.`,
      confirmButtonText: "Sí, Eliminar",
      cancelButtonText: "Cancelar",
      icon: "question",
    });
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/config/branches/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Sucursal procesada exitosamente");
        fetchConfigData();
      } else {
        toast.error(data.error?.message || "Error al eliminar sucursal");
      }
    } catch {
      toast.error("Error de red al eliminar sucursal");
    }
  };

  const handleOpenCreateWarehouse = () => {
    setEditingWarehouseId(null);
    setWarehouseForm({
      branchId: branches[0]?.id || "",
      code: "",
      name: "",
      isDefault: false,
      isDefaultSales: false,
      isDefaultPurchases: false,
      isActive: true,
    });
    setShowWarehouseModal(true);
  };

  const handleOpenEditWarehouse = (w: any) => {
    setEditingWarehouseId(w.id);
    setWarehouseForm({
      branchId: w.branchId || branches[0]?.id || "",
      code: w.code,
      name: w.name,
      isDefault: Boolean(w.isDefault),
      isDefaultSales: Boolean(w.isDefaultSales),
      isDefaultPurchases: Boolean(w.isDefaultPurchases),
      isActive: w.isActive ?? true,
    });
    setShowWarehouseModal(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseForm.code || !warehouseForm.name || !warehouseForm.branchId) {
      toast.error("Sucursal, código y nombre de depósito son obligatorios");
      return;
    }
    try {
      const url = editingWarehouseId
        ? `/api/config/warehouses/${editingWarehouseId}`
        : "/api/config/warehouses";
      const method = editingWarehouseId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(warehouseForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          editingWarehouseId
            ? `Depósito ${warehouseForm.code} actualizado con éxito`
            : `Depósito ${warehouseForm.code} creado con éxito`,
        );
        setShowWarehouseModal(false);
        setEditingWarehouseId(null);
        setWarehouseForm((prev) => ({
          ...prev,
          code: "",
          name: "",
          isDefault: false,
          isDefaultSales: false,
          isDefaultPurchases: false,
        }));
        fetchConfigData();
      } else {
        toast.error(data.error?.message || "Error al guardar depósito");
      }
    } catch {
      toast.error("Error de red al guardar depósito");
    }
  };

  const handleDeleteWarehouse = async (id: string, name: string) => {
    const confirmDelete = await showConfirmQuestion({
      title: "¿Eliminar depósito?",
      text: `¿Está seguro de que desea eliminar o desactivar el depósito "${name}"?\n\nSi posee existencias o movimientos registrados, será desactivado lógicamente para preservar el inventario.`,
      confirmButtonText: "Sí, Eliminar",
      cancelButtonText: "Cancelar",
      icon: "question",
    });
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/config/warehouses/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Depósito procesado exitosamente");
        fetchConfigData();
      } else {
        toast.error(data.error?.message || "Error al eliminar depósito");
      }
    } catch {
      toast.error("Error de red al eliminar depósito");
    }
  };

  const handleDeleteRegister = async (reg: CashRegisterConfigItem) => {
    const confirmDelete = await showConfirmQuestion({
      title: "¿Eliminar caja?",
      text: `¿Está seguro de que desea eliminar o desactivar la caja registradora "${reg.code} - ${reg.name}"?\n\nSi posee turnos de caja o facturación fiscal asociada, será desactivada para proteger los registros contables.`,
      confirmButtonText: "Sí, Eliminar",
      cancelButtonText: "Cancelar",
      icon: "question",
    });
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/pos/registers/${reg.id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          data.message || "Caja registradora eliminada/desactivada con éxito",
        );
        fetchConfigData();
      } else {
        toast.error(data.error?.message || "Error al eliminar caja");
      }
    } catch {
      toast.error("Error de red al eliminar caja");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Configuración Empresarial & Operativa
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Gestión de perfil fiscal SENIAT, sucursales, almacenes y reglas de
            control comercial
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <button
            onClick={() => setActiveTab("company")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === "company"
                ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Perfil Empresa</span>
          </button>

          <button
            onClick={() => setActiveTab("branches")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === "branches"
                ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>Sucursales & Almacenes</span>
          </button>

          <button
            onClick={() => setActiveTab("registers")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === "registers"
                ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Cajas / POS</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("rules");
              setSearchParams({ tab: "rules" });
            }}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === "rules"
                ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Reglas de Negocio</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("payment-methods");
              setSearchParams({ tab: "payment-methods" });
            }}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === "payment-methods"
                ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Medios de Pago</span>
          </button>

          {isSuperAdminRole(user?.role) && (
            <button
              onClick={() => {
                setActiveTab("maintenance");
                setSearchParams({ tab: "maintenance" });
              }}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === "maintenance"
                  ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Mantenimiento & BD</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-32 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-lg" />
          <div className="h-64 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-lg" />
        </div>
      ) : activeTab === "company" ? (
        /* TAB 1: PERFIL EMPRESA */
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 shadow-sm">
          <form onSubmit={handleSaveCompany} className="space-y-6">
            <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4">
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Identificación Fiscal & SENIAT
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Datos emitidos en facturación, libros tributarios y comprobantes
                de retención
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Razón Social *
                </label>
                <Input
                  value={company.legalName}
                  onChange={(e) =>
                    setCompany({ ...company, legalName: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Nombre Comercial
                </label>
                <Input
                  value={company.tradeName || ""}
                  onChange={(e) =>
                    setCompany({ ...company, tradeName: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  RIF (Registro de Información Fiscal) *
                </label>
                <Input
                  value={company.rif}
                  onChange={(e) =>
                    setCompany({
                      ...company,
                      rif: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="J-12345678-9"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Dirección Fiscal Legal *
                </label>
                <Input
                  value={company.fiscalAddress}
                  onChange={(e) =>
                    setCompany({ ...company, fiscalAddress: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Teléfono Principal
                </label>
                <Input
                  value={company.phone || ""}
                  onChange={(e) =>
                    setCompany({ ...company, phone: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Correo Electrónico
                </label>
                <Input
                  type="email"
                  value={company.email || ""}
                  onChange={(e) =>
                    setCompany({ ...company, email: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Moneda Base de Registro
                </label>
                <select
                  value={company.currencyBase}
                  onChange={(e) =>
                    setCompany({
                      ...company,
                      currencyBase: e.target.value as "USD" | "VES",
                    })
                  }
                  className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <option value="USD">USD - Dólares Americanos</option>
                  <option value="VES">VES - Bolívares Digitales</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Moneda Secundaria de Referencia
                </label>
                <select
                  value={company.currencySecondary}
                  onChange={(e) =>
                    setCompany({
                      ...company,
                      currencySecondary: e.target.value as "USD" | "VES",
                    })
                  }
                  className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <option value="VES">VES - Bolívares Digitales</option>
                  <option value="USD">USD - Dólares Americanos</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Moneda Predeterminada para Reportes
                </label>
                <select
                  value={company.reportCurrency || "BOTH"}
                  onChange={(e) =>
                    setCompany({
                      ...company,
                      reportCurrency: e.target.value as "BOTH" | "VES" | "USD",
                    })
                  }
                  className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <option value="BOTH">Bimonetario (VES y USD simultáneos)</option>
                  <option value="VES">Bolívares (VES - Moneda Fiscal)</option>
                  <option value="USD">Dólares Americanos (USD)</option>
                </select>
              </div>
            </div>

            {/* Tasa Oficial de Cambio (BCV) */}
            <div className="bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-sky-100 dark:bg-sky-900/50 rounded-lg text-sky-700 dark:text-sky-300 mt-0.5">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                      Tasa de Cambio Oficial (BCV)
                    </h3>
                    <Badge variant="info">Sincronización Centralizada</Badge>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                    Valor actual del dólar estadounidense aplicado para
                    presupuestos, facturación y POS:
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="font-mono text-base font-extrabold text-neutral-900 dark:text-neutral-100">
                      Bs. {formatExchangeRate(rate, 4)}{" "}
                      <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">
                        / USD
                      </span>
                    </span>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Fuente: {source}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
                    Última actualización: {new Date(updatedAt).toLocaleString()}{" "}
                    por {updatedBy}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    fetchHistory();
                    setShowRateHistoryModal(true);
                  }}
                  className="flex items-center gap-1.5 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 shadow-xs"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Ver Historial</span>
                </Button>
                {canEditRate ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRateModal(true)}
                    className="flex items-center gap-1.5 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 shadow-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Actualizar Tasa</span>
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Solo lectura (No autorizado)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Configuración SENIAT */}
            <div className="bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h3 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Régimen Impositivo SENIAT
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                  <input
                    type="checkbox"
                    id="isSpecialTaxpayer"
                    checked={company.isSpecialTaxpayer}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setCompany({
                        ...company,
                        isSpecialTaxpayer: checked,
                        ivaRetentionRate: checked
                          ? company.ivaRetentionRate || 75
                          : 0,
                      });
                    }}
                    className="w-4 h-4 mt-0.5 rounded text-sky-600 focus:ring-sky-500 border-neutral-300"
                  />
                  <label
                    htmlFor="isSpecialTaxpayer"
                    className="text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer"
                  >
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                      Contribuyente Especial SENIAT (Agente de Retención)
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400 mt-0.5 block leading-relaxed">
                      {company.isSpecialTaxpayer
                        ? "Designado oficialmente como Sujeto Pasivo Especial. Autorizado y obligado a retener IVA e ISLR a proveedores."
                        : "Contribuyente Ordinario. No actúa como Agente de Retención ante proveedores según Providencia SNAT/2015/0049."}
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Porcentaje de Retención de IVA a Proveedores
                  </label>
                  <select
                    disabled={!company.isSpecialTaxpayer}
                    value={
                      company.isSpecialTaxpayer ? company.ivaRetentionRate : 0
                    }
                    onChange={(e) =>
                      setCompany({
                        ...company,
                        ivaRetentionRate: Number(e.target.value),
                      })
                    }
                    className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 disabled:bg-neutral-100 dark:disabled:bg-neutral-900 disabled:text-neutral-400 disabled:cursor-not-allowed px-3 text-xs text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    {company.isSpecialTaxpayer ? (
                      <>
                        <option value={75}>
                          75% (General Contribuyentes Especiales)
                        </option>
                        <option value={100}>
                          100% (Casos Especiales / Proveedores sin RIF formal)
                        </option>
                      </>
                    ) : (
                      <option value={0}>
                        0% (No aplica retención - Contribuyente Ordinario)
                      </option>
                    )}
                  </select>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                    {company.isSpecialTaxpayer
                      ? "Porcentaje predeterminado en emisión de comprobantes de IVA a compras."
                      : "La empresa debe estar notificada por el SENIAT como Contribuyente Especial para habilitar retenciones."}
                  </p>
                </div>
              </div>
            </div>

            {/* Identidad Visual & Configuración de Logo en Reportes */}
            <div className="bg-white dark:bg-neutral-900 p-5 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-sky-100 dark:bg-sky-950/60 rounded-lg text-sky-600 dark:text-sky-400">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                      Identidad & Logo para Reportes Oficiales
                    </h3>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Personalice la apariencia visual del encabezado en
                      reportes PDF, libros fiscales y comprobantes.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={company.showLogoInReports ? "info" : "neutral"}
                  >
                    {company.showLogoInReports
                      ? "Logo Habilitado"
                      : "Solo Texto Fiscal"}
                  </Badge>
                </div>
              </div>

              {/* Toggle Principal: Mostrar Logo en Reportes */}
              <div className="flex items-start gap-3 bg-neutral-50 dark:bg-neutral-800/40 p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-700/60">
                <input
                  type="checkbox"
                  id="show_logo_in_reports"
                  checked={company.showLogoInReports}
                  onChange={(e) =>
                    setCompany({
                      ...company,
                      showLogoInReports: e.target.checked,
                    })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 dark:border-neutral-700 text-sky-600 focus-visible:ring-2 focus-visible:ring-sky-500 cursor-pointer"
                />
                <label
                  htmlFor="show_logo_in_reports"
                  className="text-xs cursor-pointer select-none"
                >
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                    Mostrar logo institucional en los reportes del sistema
                  </span>
                  <span className="text-neutral-500 dark:text-neutral-400 text-[11px] mt-0.5 block leading-relaxed">
                    Si se desmarca, los reportes se generarán en formato de
                    impresión compacto legal, sin logotipo y alineando el texto
                    fiscal al margen izquierdo.
                  </span>
                </label>
              </div>

              {company.showLogoInReports && (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Selección del Logo a Utilizar en Reportes
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Opción 1: Logo Oficial del Sistema */}
                      <label
                        className={`relative flex items-center gap-3.5 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                          company.reportLogoType !== "custom"
                            ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 ring-1 ring-sky-500/20"
                            : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700"
                        }`}
                      >
                        <input
                          type="radio"
                          name="reportLogoType"
                          value="default"
                          checked={company.reportLogoType !== "custom"}
                          onChange={() =>
                            setCompany({
                              ...company,
                              reportLogoType: "default",
                            })
                          }
                          className="h-4 w-4 text-sky-600 border-neutral-300 dark:border-neutral-700 focus-visible:ring-2 focus-visible:ring-sky-500"
                        />
                        <div className="w-12 h-12 rounded-lg bg-neutral-900 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-1.5 flex items-center justify-center shrink-0 shadow-xs">
                          <img
                            src="/logo.webp"
                            alt="Logo Predeterminado ERO"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                            Logo Predeterminado del Sistema
                          </span>
                          <span className="block text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                            Insignia oficial ERO en formato WebP de alta
                            fidelidad y máxima compresión.
                          </span>
                        </div>
                      </label>

                      {/* Opción 2: Logo Personalizado de la Empresa */}
                      <label
                        className={`relative flex items-center gap-3.5 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                          company.reportLogoType === "custom"
                            ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 ring-1 ring-sky-500/20"
                            : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700"
                        }`}
                      >
                        <input
                          type="radio"
                          name="reportLogoType"
                          value="custom"
                          checked={company.reportLogoType === "custom"}
                          onChange={() =>
                            setCompany({ ...company, reportLogoType: "custom" })
                          }
                          className="h-4 w-4 text-sky-600 border-neutral-300 dark:border-neutral-700 focus-visible:ring-2 focus-visible:ring-sky-500"
                        />
                        <div className="w-12 h-12 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-1.5 flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                          {company.customLogoUrl ? (
                            <img
                              src={company.customLogoUrl}
                              alt="Logo Personalizado"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <FileImage className="w-6 h-6 text-neutral-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="block text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                            Logo Personalizado de la Empresa
                          </span>
                          <span className="block text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                            {company.customLogoUrl
                              ? "Logo personalizado configurado en formato WebP."
                              : "Cargue su propia imagen corporativa (se convertirá a WebP)."}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Subsección de Carga y Validación para Logo Personalizado */}
                  {company.reportLogoType === "custom" && (
                    <div className="bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800  space-y-3.5">
                      {/* Ficha técnica y especificaciones obligatorias */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-blue-900 dark:text-blue-300 font-semibold text-[11px] uppercase tracking-wider">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>Especificaciones Técnicas Requeridas</span>
                          </div>
                          <ul className="text-[11px] text-neutral-800 dark:text-neutral-300/80 space-y-0.5 list-disc list-inside">
                            <li>
                              Formatos admitidos:{" "}
                              <strong>PNG, JPG, JPEG, WebP</strong>
                            </li>
                            <li>
                              Tamaño máximo permitido: <strong>2 MB</strong>
                            </li>
                            <li>
                              Resolución recomendada:{" "}
                              <strong>
                                Horizontal o 1:1 (hasta 800 × 600 px)
                              </strong>
                            </li>
                            <li>
                              Compresión automática:{" "}
                              <strong>
                                Toda imagen subida se convertirá estrictamente a
                                formato WebP optimizado
                              </strong>
                            </li>
                          </ul>
                        </div>
                      </div>

                      {/* File input oculto */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleLogoUpload(file);
                          e.target.value = "";
                        }}
                      />

                      {/* Vista previa o Dropzone */}
                      {company.customLogoUrl ? (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
                          <div className="flex items-center gap-4">
                            <div className="w-24 h-16 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-2 flex items-center justify-center shrink-0">
                              <img
                                src={company.customLogoUrl}
                                alt="Logo Personalizado"
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                                  Logo Corporativo en WebP Activo
                                </span>
                                <Badge variant="success">WebP Comprimido</Badge>
                              </div>
                              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                                {logoStats
                                  ? `Original: ${logoStats.originalSize} → Comprimido: ${logoStats.compressedSize} (${logoStats.dimensions})`
                                  : "Optimizado para renderizado ultra nítido y liviano en PDFs."}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isProcessingLogo}
                              onClick={() => fileInputRef.current?.click()}
                              className="flex items-center gap-1.5"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${isProcessingLogo ? "animate-spin" : ""}`}
                              />
                              <span>Reemplazar</span>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCompany({
                                  ...company,
                                  customLogoUrl: null,
                                  reportLogoType: "default",
                                });
                                setLogoStats(null);
                                toast.info(
                                  "Logo personalizado removido. Se usará el logo predeterminado.",
                                );
                              }}
                              className="flex items-center gap-1.5 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Restablecer</span>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleLogoUpload(file);
                          }}
                          className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-sky-500 dark:hover:border-sky-400 rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-white/60 dark:bg-neutral-900/60"
                        >
                          <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-full text-sky-600 dark:text-sky-400">
                            <UploadCloud className="w-6 h-6" />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                              {isProcessingLogo
                                ? "Procesando y convirtiendo imagen a WebP..."
                                : "Haga clic aquí o arrastre su imagen"}
                            </p>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                              PNG, JPG o WebP hasta 2 MB. Compresión y
                              conversión inmediata a WebP.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </Button>
            </div>
          </form>
        </div>
      ) : activeTab === "branches" ? (
        /* TAB 2: SUCURSALES & ALMACENES */
        <div className="space-y-6">
          {/* Sucursales */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  Sucursales Habilitadas
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Establecimientos comerciales y centros de operación
                  multi-sucursal
                </p>
              </div>
              <div className="flex items-center gap-2">
                {license && (
                  <span
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold ${
                      license.maxBranches > 0 &&
                      branches.filter((b) => b.isActive !== false).length >=
                        license.maxBranches
                        ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                        : "bg-neutral-50 text-neutral-600 border-neutral-200 dark:bg-neutral-850 dark:text-neutral-400 dark:border-neutral-700"
                    }`}
                  >
                    Cupo: {branches.filter((b) => b.isActive !== false).length}{" "}
                    /{" "}
                    {license.maxBranches <= 0
                      ? "∞ Ilimitadas"
                      : license.maxBranches}
                  </span>
                )}
                <Button
                  variant="outline"
                  onClick={handleOpenCreateBranch}
                  disabled={Boolean(
                    license &&
                    license.maxBranches > 0 &&
                    branches.filter((b) => b.isActive !== false).length >=
                      license.maxBranches,
                  )}
                  className={`flex items-center gap-2 border-[#007BFF] dark:border-[#3D91FF] rounded-lg text-xs ${
                    license &&
                    license.maxBranches > 0 &&
                    branches.filter((b) => b.isActive !== false).length >=
                      license.maxBranches
                      ? "opacity-50 cursor-not-allowed bg-neutral-100 dark:bg-neutral-800"
                      : "bg-blue-50 dark:bg-blue-600/30 hover:bg-border-blue-600 dark:hover:border-blue-500"
                  }`}
                  title={
                    license &&
                    license.maxBranches > 0 &&
                    branches.filter((b) => b.isActive !== false).length >=
                      license.maxBranches
                      ? `Límite de ${license.maxBranches} sucursales alcanzado por su licencia`
                      : "Nueva Sucursal"
                  }
                >
                  <Plus className="w-4 h-4 text-blue-600 dark:blue-500" />
                  <span>Nueva Sucursal</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((b) => (
                <div
                  key={b.id}
                  className="bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800  items-start sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400">
                          {b.code}
                        </span>
                        <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                          {b.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {b.isMain && (
                          <Badge variant="info">Sede Principal</Badge>
                        )}
                        <Badge variant={b.isActive ? "neutral" : "danger"}>
                          {b.isActive ? "Activa" : "Inactiva"}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 line-clamp-2">
                      {b.address || "Sin dirección fiscal registrada"}
                    </p>
                    <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center text-[11px] text-neutral-600 dark:text-neutral-400">
                      <span>{b.phone || "Sin teléfono"}</span>
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                        {b.warehousesCount || 0} Almacenes
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditBranch(b)}
                      className="h-7 px-2 text-xs"
                      title="Editar sucursal"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteBranch(b.id, b.name)}
                      className="h-7 px-2 text-xs text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30"
                      title="Eliminar o desactivar sucursal"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Almacenes */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  Depósitos & Almacenes Físicos
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Ubicaciones de control de existencias, piso de venta y
                  traslados
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleOpenCreateWarehouse}
                className="flex items-center gap-2 border-[#007BFF] dark:border-[#3D91FF] rounded-lg bg-blue-50 dark:bg-blue-600/30 hover:bg-border-blue-600 dark:hover:border-blue-500 text-xs"
                title="Nuevo Depósito"
              >
                <Plus className="w-4 h-4 text-blue-600 dark:blue-500" />
                <span>Nuevo Depósito</span>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Nombre del Depósito</th>
                    <th className="py-2.5 px-3">Sucursal Asignada</th>
                    <th className="py-2.5 px-3">Condición</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {warehouses.map((w) => (
                    <tr
                      key={w.id}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    >
                      <td className="py-2 px-3 font-mono font-bold text-neutral-900 dark:text-neutral-100">
                        {w.code}
                      </td>
                      <td className="py-2 px-3 text-neutral-900 dark:text-neutral-100 font-medium">
                        {w.name}
                      </td>
                      <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400">
                        {w.branchName || w.branchCode}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {w.isDefaultSales && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              Ventas (POS)
                            </span>
                          )}
                          {w.isDefaultPurchases && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                              Compras (Recepción)
                            </span>
                          )}
                          {!w.isDefaultSales && !w.isDefaultPurchases && (
                            <span className="text-neutral-400 dark:text-neutral-500 text-xs">
                              Secundario
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={w.isActive ? "neutral" : "danger"}>
                          {w.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditWarehouse(w)}
                            className="h-7 px-2 text-xs"
                            title="Editar depósito"
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteWarehouse(w.id, w.name)}
                            className="h-7 px-2 text-xs text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Eliminar o desactivar depósito"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === "registers" ? (
        /* TAB 3: CAJAS / PUNTOS DE VENTA */
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  Cajas Registradoras y Puntos de Venta (POS)
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Configure cada caja registradora, estableciendo si cuenta con
                  impresora fiscal homologada conectada (SENIAT) o si opera en
                  modalidad no fiscal con ticket de entrega.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleOpenCreateRegister}
                className="flex items-center gap-2 border-[#007BFF] dark:border-[#3D91FF] rounded-lg bg-blue-50 dark:bg-blue-600/30 hover:bg-border-blue-600 dark:hover:border-blue-500 text-xs"
                title="Nueva Caja Registradora"
              >
                <Plus className="w-4 h-4 text-blue-600 dark:blue-500" />
                <span>Nueva Caja Registradora</span>
              </Button>
            </div>

            {registers.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 dark:text-neutral-500 flex flex-col items-center">
                <CreditCard className="w-10 h-10 mb-2 stroke-1 text-neutral-300 dark:text-neutral-600" />
                <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                  No hay cajas registradoras configuradas
                </p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 max-w-sm">
                  Cree una caja para habilitar el cobro en el Punto de Venta y
                  defina si posee impresora fiscal conectada.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOpenCreateRegister}
                  className="mt-4"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Crear Primera Caja
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Nombre de la Caja</th>
                      <th className="py-2.5 px-3">Sucursal Asignada</th>
                      <th className="py-2.5 px-3">Almacén de Inventario</th>
                      <th className="py-2.5 px-3">
                        Impresora Fiscal / Modalidad
                      </th>
                      <th className="py-2.5 px-3">
                        Cuentas Bancarias Predeterminadas
                      </th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {registers.map((r) => {
                      const isFiscal = r.invoiceMode === "fiscal_printer";
                      const accVES = bankAccounts.find(
                        (a) => a.id === r.defaultBankAccountIdVES,
                      );
                      const accUSD = bankAccounts.find(
                        (a) => a.id === r.defaultBankAccountIdUSD,
                      );
                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-neutral-900 dark:text-neutral-100">
                            {r.code}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                                {r.name}
                              </span>
                              {r.acceptsOrders !== false ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 w-fit">
                                  ● Acepta Comandas
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 w-fit">
                                  Solo POS
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                            {r.branchName || "Sucursal Principal"}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                                {r.warehouseName || "Almacén Principal"}
                              </span>
                              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                                Descarga y consulta de stock
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {isFiscal ? (
                              <div className="flex flex-col gap-0.5">
                                <Badge
                                  variant="success"
                                  className="font-mono text-[10px] w-fit flex items-center gap-1"
                                >
                                  <Printer className="w-3 h-3" />
                                  Fiscal: {r.fiscalPrinterSerial || "Conectada"}
                                </Badge>
                                <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                                  Factura Fiscal Homologada SENIAT
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge
                                    variant="neutral"
                                    className="text-[10px] w-fit flex items-center gap-1"
                                  >
                                    <Printer className="w-3 h-3" />
                                    {r.ticketPrinterType === "thermal_58mm"
                                      ? "Térmica 58mm"
                                      : r.ticketPrinterType === "generic_esc_pos"
                                      ? "ESC/POS Genérica"
                                      : r.ticketPrinterType === "windows_spooler"
                                      ? "Spooler Windows"
                                      : r.ticketPrinterType === "pdf_virtual"
                                      ? "PDF Virtual"
                                      : "Térmica 80mm"}
                                  </Badge>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                                    r.ticketPrintMode === "direct"
                                      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                                      : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                                  }`}>
                                    {r.ticketPrintMode === "direct" ? "Impresión Directa" : "Preguntar Ticket"}
                                  </span>
                                </div>
                                {r.ticketPrinterName && (
                                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                                    Dispositivo: {r.ticketPrinterName}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-col gap-1 text-[11px]">
                              <span className="text-neutral-700 dark:text-neutral-300">
                                <strong className="font-semibold text-neutral-500 dark:text-neutral-400">
                                  VES:
                                </strong>{" "}
                                {accVES ? (
                                  `${accVES.bankName} (${accVES.accountNumber.slice(-4)})`
                                ) : (
                                  <span className="text-neutral-400 dark:text-neutral-500 italic">
                                    No configurada
                                  </span>
                                )}
                              </span>
                              <span className="text-neutral-700 dark:text-neutral-300">
                                <strong className="font-semibold text-neutral-500 dark:text-neutral-400">
                                  USD:
                                </strong>{" "}
                                {accUSD ? (
                                  `${accUSD.bankName} (${accUSD.accountNumber.slice(-4)})`
                                ) : (
                                  <span className="text-neutral-400 dark:text-neutral-500 italic">
                                    No configurada
                                  </span>
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant={r.isActive ? "neutral" : "danger"}>
                              {r.isActive ? "Activa" : "Inactiva"}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditRegister(r)}
                                title="Editar configuración de caja"
                                className="h-7 px-2 text-xs"
                              >
                                <Edit2 className="w-3 h-3 mr-1" />
                                Editar
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleRegisterActive(r)}
                                title={
                                  r.isActive
                                    ? "Desactivar caja"
                                    : "Activar caja"
                                }
                                className={`h-7 px-2 text-xs ${r.isActive ? "text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30" : "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"}`}
                              >
                                {r.isActive ? "Desactivar" : "Activar"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteRegister(r)}
                                title="Eliminar o desactivar caja"
                                className="h-7 px-2 text-xs text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Eliminar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "rules" ? (
        /* TAB 4: REGLAS DE NEGOCIO */
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 shadow-sm">
          <form onSubmit={handleSaveRules} className="space-y-6">
            <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4">
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Políticas de Control Comercial y Facturación
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Restricciones de crédito, autorizaciones de descuento y modo de
                impresión fiscal
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ventas a Crédito */}
              <div className="p-4 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800 space-y-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="allowCreditSales"
                    checked={rules.allowCreditSales}
                    onChange={(e) =>
                      setRules({ ...rules, allowCreditSales: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 dark:border-neutral-700 mt-0.5"
                  />
                  <label
                    htmlFor="allowCreditSales"
                    className="text-xs cursor-pointer"
                  >
                    <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                      Habilitar Facturación a Crédito
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      Permite generar facturas comerciales con fecha de
                      vencimiento y registro en cuentas por cobrar
                    </span>
                  </label>
                </div>

                <div className="flex items-start gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                  <input
                    type="checkbox"
                    id="enforceCreditLimit"
                    checked={rules.enforceCreditLimit}
                    onChange={(e) =>
                      setRules({
                        ...rules,
                        enforceCreditLimit: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 dark:border-neutral-700 mt-0.5"
                  />
                  <label
                    htmlFor="enforceCreditLimit"
                    className="text-xs cursor-pointer"
                  >
                    <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                      Validación Estricta de Límite de Crédito
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      Bloquea automáticamente la venta si la deuda acumulada del
                      cliente excede su límite
                    </span>
                  </label>
                </div>

                <div className="flex items-start gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                  <input
                    type="checkbox"
                    id="requireApprovalCreditExceeded"
                    checked={rules.requireApprovalCreditExceeded}
                    onChange={(e) =>
                      setRules({
                        ...rules,
                        requireApprovalCreditExceeded: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 dark:border-neutral-700 mt-0.5"
                  />
                  <label
                    htmlFor="requireApprovalCreditExceeded"
                    className="text-xs cursor-pointer"
                  >
                    <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                      Autorización por Exceso de Crédito
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      Permite emitir la venta a crédito si un usuario de mayor
                      nivel (Administrador / Supervisor) autoriza el monto
                      excedente
                    </span>
                  </label>
                </div>
              </div>

              {/* Descuentos & Aprobaciones */}
              <div className="p-4 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800 space-y-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="requireApprovalDiscount"
                    checked={rules.requireApprovalDiscount}
                    onChange={(e) =>
                      setRules({
                        ...rules,
                        requireApprovalDiscount: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 dark:border-neutral-700 mt-0.5"
                  />
                  <label
                    htmlFor="requireApprovalDiscount"
                    className="text-xs cursor-pointer"
                  >
                    <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                      Exigir Aprobación de Descuento
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      Requiere confirmación de supervisor cuando el descuento
                      comercial sobrepase el límite máximo
                    </span>
                  </label>
                </div>

                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Descuento Máximo Permitido sin Aprobación (%)
                  </label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={rules.maxDiscountAllowed}
                    onChange={(e) =>
                      setRules({
                        ...rules,
                        maxDiscountAllowed: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              {/* Control de Inventario y Stock en Negativo */}
              <div className="p-4 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800 space-y-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="allowNegativeStock"
                    checked={rules.allowNegativeStock}
                    onChange={(e) =>
                      setRules({
                        ...rules,
                        allowNegativeStock: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 dark:border-neutral-700 mt-0.5"
                  />
                  <label
                    htmlFor="allowNegativeStock"
                    className="text-xs cursor-pointer"
                  >
                    <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                      Permitir Ventas con Existencia en Negativo
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      Habilita la facturación y venta en el Punto de Venta (POS)
                      aun cuando el producto no posea inventario suficiente en
                      el almacén de la caja.
                    </span>
                  </label>
                </div>

                <div className="flex items-start gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                  <input
                    type="checkbox"
                    id="requireApprovalNegativeStock"
                    disabled={!rules.allowNegativeStock}
                    checked={
                      rules.requireApprovalNegativeStock &&
                      rules.allowNegativeStock
                    }
                    onChange={(e) =>
                      setRules({
                        ...rules,
                        requireApprovalNegativeStock: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 dark:border-neutral-700 mt-0.5 disabled:opacity-50"
                  />
                  <label
                    htmlFor="requireApprovalNegativeStock"
                    className={`text-xs ${!rules.allowNegativeStock ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                      Exigir Autorización de Supervisor para Stock en Negativo
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      Si está activo, al seleccionar un producto sin existencia
                      o al modificar la cantidad dejándola en negativo, el POS
                      notificará al cajero y solicitará credenciales de
                      autorización de un supervisor o administrador para
                      continuar.
                    </span>
                  </label>
                </div>
              </div>

              {/* Modo de Facturación POS */}
              <div className="p-4 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800 space-y-3">
                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  Modo de Facturación de Caja / POS
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Mecanismo de expedición de tickets y facturas en los puntos de
                  venta
                </p>

                <select
                  value={rules.posInvoiceMode}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      posInvoiceMode: e.target.value as any,
                    })
                  }
                  className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <option value="normal_printer">
                    Impresora Estándar / Formato Digital PDF
                  </option>
                  <option value="fiscal_printer">
                    Impresora Fiscal Homologada SENIAT
                  </option>
                  <option value="electronic">
                    Facturación Electrónica en Línea
                  </option>
                </select>
              </div>

              {/* Modo de Facturación Administrativa (Ventas / Cotizaciones Fuera de POS) */}
              <div className="p-4 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800 space-y-3">
                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  Modo de Facturación Administrativa (Ventas y Cotizaciones)
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Modalidad fiscal por defecto para la emisión directa de
                  facturas fuera del punto de venta
                </p>

                <select
                  value={rules.salesInvoiceMode || "free_form"}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      salesInvoiceMode: e.target.value as any,
                    })
                  }
                  className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <option value="free_form">
                    Factura Fiscal Forma Libre / Talonario Preimpreso (Exige N°
                    Control SENIAT)
                  </option>
                  <option value="fiscal_printer">
                    Impresora Fiscal Homologada SENIAT
                  </option>
                  <option value="no_fiscal">
                    Factura / Documento No Fiscal (Control Interno - No pide N°
                    Control)
                  </option>
                </select>
              </div>

              {/* Auditoría y Retención */}
              <div className="p-4 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800 space-y-3">
                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  Período de Retención Fiscal de Auditoría
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Lapso legal de conservación inmutable de bitácoras de
                  auditoría y libros SENIAT
                </p>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="5"
                    max="15"
                    value={rules.retentionPeriodYears}
                    onChange={(e) =>
                      setRules({
                        ...rules,
                        retentionPeriodYears: Number(e.target.value),
                      })
                    }
                    className="w-24"
                  />
                  <span className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                    Años (Mínimo legal: 5 años)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Reglas de Negocio</span>
              </Button>
            </div>
          </form>
        </div>
      ) : activeTab === "maintenance" && isSuperAdminRole(user?.role) ? (
        /* TAB 6: MANTENIMIENTO & BASE DE DATOS (SUPERADMIN ONLY) */
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Mantenimiento de Infraestructura & Base de Datos
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Operaciones avanzadas reservadas estrictamente para la cuenta Superadministrador del sistema
                </p>
              </div>
              <Badge variant="info">Modo Superadministrador</Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Opción 1: Respaldo Completo de Base de Datos */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-5 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-lg">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        Copia de Seguridad Completa (SQL Dump)
                      </h3>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Estructura DDL y volcado de datos transaccionales
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    Genera una descarga directa en formato SQL compatible con MySQL 8.0+ y MariaDB. Incluye la definición completa de todas las tablas, vistas, catálogos, operaciones de venta, libros SENIAT, asientos contables, inventario y registros de auditoría.
                  </p>

                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 space-y-1">
                    <div className="font-semibold text-neutral-700 dark:text-neutral-300">
                      Detalles del volcado:
                    </div>
                    <div>• Cabeceras con deshabilitación temporal de llaves foráneas</div>
                    <div>• Lotes de inserción optimizados para restauración rápida</div>
                    <div>• Compatibilidad con herramientas como phpMyAdmin, DBeaver o CLI</div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={isDownloadingBackup}
                    onClick={handleDownloadBackup}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {isDownloadingBackup
                        ? "Generando archivo SQL..."
                        : "Generar y Descargar Respaldo Completo (.sql)"}
                    </span>
                  </Button>
                </div>
              </div>

              {/* Opción 2: Aprovisionamiento de Nueva Empresa */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-5 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 rounded-lg">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        Inicializar Nueva Empresa (Tenant Limpio)
                      </h3>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Aprovisionamiento corporativo automatizado
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    Crea un nuevo tenant empresarial en la base de datos sin afectar a las empresas existentes. Genera de forma automatizada las sucursales iniciales, almacén central, caja registradora, 7 medios de pago estándar, reglas de control comercial y la cuenta del Administrador.
                  </p>

                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 space-y-1">
                    <div className="font-semibold text-neutral-700 dark:text-neutral-300">
                      Recursos creados por defecto:
                    </div>
                    <div>• Sede Principal (<span className="font-mono">SEDE-01</span>) y Almacén General (<span className="font-mono">ALM-01</span>)</div>
                    <div>• Caja Mostrador (<span className="font-mono">CAJA-01</span>) y 7 Métodos de Pago</div>
                    <div>• Roles base (Administrador, Cajero, Inventario, Mesero, Contador)</div>
                    <div>• Usuario Administrador con acceso total a la nueva empresa</div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowInitCompanyModal(true)}
                    className="w-full flex items-center justify-center gap-2 border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                  >
                    <Server className="w-4 h-4" />
                    <span>Inicializar Nueva Empresa en BD</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* TAB 5: MEDIOS DE PAGO */
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 shadow-sm">
          <PaymentMethodsConfigView embedded />
        </div>
      )}

      {/* Modal Nueva / Editar Sucursal */}
      <Modal
        isOpen={showBranchModal}
        onClose={() => {
          setShowBranchModal(false);
          setEditingBranchId(null);
        }}
        title={editingBranchId ? "Editar Sucursal" : "Registrar Nueva Sucursal"}
      >
        <form onSubmit={handleSaveBranch} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Código *
              </label>
              <Input
                placeholder="SUC-03"
                value={branchForm.code}
                onChange={(e) =>
                  setBranchForm({
                    ...branchForm,
                    code: e.target.value.toUpperCase(),
                  })
                }
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Nombre *
              </label>
              <Input
                placeholder="Sucursal Valencia"
                value={branchForm.name}
                onChange={(e) =>
                  setBranchForm({ ...branchForm, name: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Dirección Fiscal
            </label>
            <Input
              placeholder="Zona Industrial El Recreo, Valencia"
              value={branchForm.address || ""}
              onChange={(e) =>
                setBranchForm({ ...branchForm, address: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Teléfono
            </label>
            <Input
              placeholder="+58 241 888-0011"
              value={branchForm.phone || ""}
              onChange={(e) =>
                setBranchForm({ ...branchForm, phone: e.target.value })
              }
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="branchIsMain"
              checked={branchForm.isMain}
              onChange={(e) =>
                setBranchForm({ ...branchForm, isMain: e.target.checked })
              }
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 dark:border-neutral-700"
            />
            <label
              htmlFor="branchIsMain"
              className="text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer"
            >
              Definir como Sede Principal
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowBranchModal(false);
                setEditingBranchId(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {editingBranchId ? "Actualizar Sucursal" : "Guardar Sucursal"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Nuevo / Editar Almacén */}
      <Modal
        isOpen={showWarehouseModal}
        onClose={() => {
          setShowWarehouseModal(false);
          setEditingWarehouseId(null);
        }}
        title={
          editingWarehouseId
            ? "Editar Almacén / Depósito"
            : "Registrar Nuevo Almacén / Depósito"
        }
      >
        <form onSubmit={handleSaveWarehouse} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Sucursal Asignada *
            </label>
            <select
              value={warehouseForm.branchId}
              onChange={(e) =>
                setWarehouseForm({ ...warehouseForm, branchId: e.target.value })
              }
              className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
              required
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} - {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Código Depósito *
              </label>
              <Input
                placeholder="ALM-02"
                value={warehouseForm.code}
                onChange={(e) =>
                  setWarehouseForm({
                    ...warehouseForm,
                    code: e.target.value.toUpperCase(),
                  })
                }
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Nombre Depósito *
              </label>
              <Input
                placeholder="Almacén de Refrigerados"
                value={warehouseForm.name}
                onChange={(e) =>
                  setWarehouseForm({ ...warehouseForm, name: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <span className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              Asignación Predeterminada por Sucursal
            </span>

            <div className="flex items-start gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
              <input
                type="checkbox"
                id="warehouseIsDefaultSales"
                checked={Boolean(warehouseForm.isDefaultSales)}
                onChange={(e) =>
                  setWarehouseForm({
                    ...warehouseForm,
                    isDefaultSales: e.target.checked,
                  })
                }
                className="w-4 h-4 mt-0.5 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 dark:border-neutral-700 focus-visible:ring-2"
              />
              <label
                htmlFor="warehouseIsDefaultSales"
                className="text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer select-none"
              >
                <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                  Predeterminado para Ventas
                </span>
                <span className="text-neutral-500 dark:text-neutral-400 block mt-0.5 leading-relaxed">
                  Se asignará automáticamente por defecto en el POS,
                  cotizaciones, pedidos, notas de entrega y facturación en esta
                  sucursal (máximo uno por sucursal).
                </span>
              </label>
            </div>

            <div className="flex items-start gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
              <input
                type="checkbox"
                id="warehouseIsDefaultPurchases"
                checked={Boolean(warehouseForm.isDefaultPurchases)}
                onChange={(e) =>
                  setWarehouseForm({
                    ...warehouseForm,
                    isDefaultPurchases: e.target.checked,
                  })
                }
                className="w-4 h-4 mt-0.5 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 dark:border-neutral-700 focus-visible:ring-2"
              />
              <label
                htmlFor="warehouseIsDefaultPurchases"
                className="text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer select-none"
              >
                <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                  Predeterminado para Compras
                </span>
                <span className="text-neutral-500 dark:text-neutral-400 block mt-0.5 leading-relaxed">
                  Se asignará automáticamente por defecto para ingresos de
                  mercancía, recepciones de almacén y compras a proveedores en
                  esta sucursal (máximo uno por sucursal).
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowWarehouseModal(false);
                setEditingWarehouseId(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {editingWarehouseId ? "Actualizar Depósito" : "Guardar Depósito"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal para actualizar tasa de cambio oficial */}
      {showRateModal && canEditRate && (
        <Modal
          isOpen={showRateModal}
          onClose={() => setShowRateModal(false)}
          title="Actualizar Tasa de Cambio Oficial (BCV)"
        >
          <form onSubmit={handleSaveRate} className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
              Esta tasa se guardará en base de datos MySQL con fecha efectiva e
              historial de auditoría, aplicándose de manera global a todos los
              módulos.
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Tasa Oficial en Bolívares (Bs. por 1 USD) *
              </label>
              <Input
                type="number"
                step="0.0001"
                min="0.0001"
                required
                value={formRate}
                onChange={(e) => setFormRate(e.target.value)}
                placeholder="36.8500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Fuente o Referencia Oficial
              </label>
              <Input
                value={formSource}
                onChange={(e) => setFormSource(e.target.value)}
                placeholder="Banco Central de Venezuela (BCV)"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Notas / Justificación del Ajuste (Opcional)
              </label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="ej: Publicación oficial de cierre BCV"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRateModal(false)}
                disabled={isUpdatingRate}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={isUpdatingRate}>
                {isUpdatingRate ? "Guardando..." : "Aplicar Tasa Oficial"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal para ver historial de tasas oficiales en base de datos */}
      {showRateHistoryModal && (
        <Modal
          maxWidth="max-w-[800px]"
          isOpen={showRateHistoryModal}
          onClose={() => setShowRateHistoryModal(false)}
          title="Historial de Tasas de Cambio Oficiales en Base de Datos"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span>{history.length} registros guardados en MySQL</span>
              <button
                type="button"
                onClick={() => fetchHistory()}
                className="text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 font-medium cursor-pointer"
              >
                Refrescar historial
              </button>
            </div>

            {isHistoryLoading ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                Cargando historial de base de datos...
              </div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg">
                No se encontraron registros de tasas de cambio en base de datos.
              </div>
            ) : (
              <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg max-h-72">
                <table className="w-full text-xs text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">Fecha Efectiva</th>
                      <th className="py-2.5 px-3 text-right">
                        Tasa Oficial (Bs.)
                      </th>
                      <th className="py-2.5 px-3">Fuente</th>
                      <th className="py-2.5 px-3">Registrado Por</th>
                      <th className="py-2.5 px-3">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {history.map((h, i) => (
                      <tr
                        key={h.id || i}
                        className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60"
                      >
                        <td className="py-2 px-3 font-mono text-neutral-700 dark:text-neutral-300 font-medium">
                          {h.effectiveDate}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                          Bs. {formatExchangeRate(h.rate, 4)}
                        </td>
                        <td className="py-2 px-3 text-neutral-600 dark:text-neutral-300 max-w-[140px] break-words">
                          {h.source}
                        </td>
                        <td className="py-2 px-3 text-neutral-500 dark:text-neutral-400 max-w-[120px] break-words">
                          {h.updatedBy}
                        </td>
                        <td className="py-2 px-3 text-neutral-400 dark:text-neutral-500 line-clamp-2 max-w-[140px] break-words">
                          {h.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRateHistoryModal(false)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Nueva / Editar Caja Registradora */}
      {showRegisterModal && (
        <Modal
          isOpen={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
          title={
            editingRegisterId
              ? "Editar Caja Registradora"
              : "Registrar Nueva Caja Registradora"
          }
        >
          <form onSubmit={handleSaveRegister} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Sucursal Asignada *
                </label>
                <select
                  value={registerForm.branchId}
                  onChange={(e) => {
                    const newBranchId = e.target.value;
                    const whInBranch = warehouses.filter(
                      (w) => !w.branchId || w.branchId === newBranchId,
                    );
                    const defWh =
                      whInBranch.find((w) => w.isDefault)?.id ||
                      whInBranch[0]?.id ||
                      "";
                    setRegisterForm({
                      ...registerForm,
                      branchId: newBranchId,
                      warehouseId: defWh,
                    });
                  }}
                  className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
                  required
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} - {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Almacén de Inventario *
                </label>
                <select
                  value={registerForm.warehouseId}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      warehouseId: e.target.value,
                    })
                  }
                  className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
                  required
                >
                  <option value="">-- Seleccionar Almacén --</option>
                  {warehouses
                    .filter(
                      (w) =>
                        !w.branchId || w.branchId === registerForm.branchId,
                    )
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {w.name}{" "}
                        {w.isDefault ? "(Predeterminado)" : ""}
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                  Almacén del cual se consultará la existencia y se rebajará el
                  stock al vender.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Código de Caja *
                </label>
                <Input
                  placeholder="CAJA-01"
                  value={registerForm.code}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Nombre / Descripción *
                </label>
                <Input
                  placeholder="Caja Principal Mostrador"
                  value={registerForm.name}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, name: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            {/* Configuración de Impresora Fiscal */}
            <div className="p-3 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800 space-y-3">
              <label className="block text-xs font-bold text-neutral-900 dark:text-neutral-100">
                ¿Tiene impresora fiscal conectada?
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  className={`p-3 rounded-lg border cursor-pointer flex flex-col gap-1 transition-colors ${
                    registerForm.isFiscal
                      ? "border-sky-500 bg-sky-50/40 dark:bg-sky-950/40 text-neutral-900 dark:text-neutral-100 ring-1 ring-sky-500"
                      : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-750"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Printer className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Sí, Impresora Fiscal
                    </span>
                    <input
                      type="radio"
                      name="isFiscalRadio"
                      checked={registerForm.isFiscal}
                      onChange={() =>
                        setRegisterForm({ ...registerForm, isFiscal: true })
                      }
                      className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                    />
                  </div>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Modo Fiscal SENIAT con serial y emisión de libro tributario
                  </span>
                </label>

                <label
                  className={`p-3 rounded-lg border cursor-pointer flex flex-col gap-1 transition-colors ${
                    !registerForm.isFiscal
                      ? "border-sky-500 bg-sky-50/40 dark:bg-sky-950/40 text-neutral-900 dark:text-neutral-100 ring-1 ring-sky-500"
                      : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-750"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
                      No, Sin Impresora Fiscal
                    </span>
                    <input
                      type="radio"
                      name="isFiscalRadio"
                      checked={!registerForm.isFiscal}
                      onChange={() =>
                        setRegisterForm({ ...registerForm, isFiscal: false })
                      }
                      className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                    />
                  </div>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Modo No Fiscal: preguntará si desea imprimir ticket al
                    cobrar
                  </span>
                </label>
              </div>

              {registerForm.isFiscal && (
                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Serial de la Impresora Fiscal SENIAT *
                  </label>
                  <Input
                    placeholder="ej: Z1B89201928 / Z5A8812341"
                    value={registerForm.fiscalPrinterSerial}
                    onChange={(e) =>
                      setRegisterForm({
                        ...registerForm,
                        fiscalPrinterSerial: e.target.value.toUpperCase(),
                      })
                    }
                    required={registerForm.isFiscal}
                  />
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                    Ingrese el número de serie troquelado en la máquina fiscal
                    homologada ante el SENIAT.
                  </p>
                </div>
              )}

              {!registerForm.isFiscal && (
                <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700 space-y-3">
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      Configuración de Impresora de Ticket (Modo No Fiscal)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Tipo de Impresora de Ticket *
                      </label>
                      <select
                        value={registerForm.ticketPrinterType}
                        onChange={(e) =>
                          setRegisterForm({
                            ...registerForm,
                            ticketPrinterType: e.target.value as any,
                          })
                        }
                        className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        <option value="thermal_80mm">Térmica 80mm (Estándar Punto de Venta)</option>
                        <option value="thermal_58mm">Térmica 58mm (Compacta / Mini)</option>
                        <option value="generic_esc_pos">Impresora Genérica ESC/POS</option>
                        <option value="windows_spooler">Controlador Windows / Sistema</option>
                        <option value="pdf_virtual">Documento Virtual / PDF</option>
                      </select>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
                        Formato y corte de papel para tickets y comprobantes.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Nombre de Impresora / Puerto (Opcional)
                      </label>
                      <Input
                        placeholder="ej: EPSON TM-T20III, POS-80, COM1..."
                        value={registerForm.ticketPrinterName}
                        onChange={(e) =>
                          setRegisterForm({
                            ...registerForm,
                            ticketPrinterName: e.target.value,
                          })
                        }
                      />
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
                        Nombre en Windows, puerto serie o IP en red local.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Modo de Impresión al Facturar en POS *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label
                        className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2.5 transition-colors ${
                          registerForm.ticketPrintMode === "prompt"
                            ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/40 text-neutral-900 dark:text-neutral-100 ring-1 ring-sky-500"
                            : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-750"
                        }`}
                      >
                        <input
                          type="radio"
                          name="ticketPrintModeRadio"
                          checked={registerForm.ticketPrintMode === "prompt"}
                          onChange={() =>
                            setRegisterForm({
                              ...registerForm,
                              ticketPrintMode: "prompt",
                            })
                          }
                          className="w-4 h-4 mt-0.5 text-sky-600 focus:ring-sky-500"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold">Preguntar antes de imprimir</span>
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                            Muestra confirmación al cajero para elegir si imprime o no el ticket.
                          </span>
                        </div>
                      </label>

                      <label
                        className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2.5 transition-colors ${
                          registerForm.ticketPrintMode === "direct"
                            ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/40 text-neutral-900 dark:text-neutral-100 ring-1 ring-sky-500"
                            : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-750"
                        }`}
                      >
                        <input
                          type="radio"
                          name="ticketPrintModeRadio"
                          checked={registerForm.ticketPrintMode === "direct"}
                          onChange={() =>
                            setRegisterForm({
                              ...registerForm,
                              ticketPrintMode: "direct",
                            })
                          }
                          className="w-4 h-4 mt-0.5 text-sky-600 focus:ring-sky-500"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold">Imprimir directamente</span>
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                            Envía de inmediato a la impresora configurada sin preguntar al cajero.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cuentas Bancarias Predeterminadas para el Cierre de Caja */}
            <div className="p-3 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800 space-y-3">
              <label className="block text-xs font-bold text-neutral-900 dark:text-neutral-100">
                Cuentas Bancarias de Tesorería Predeterminadas para Depósito
              </label>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Estas cuentas se preseleccionarán automáticamente al realizar el
                arqueo y cierre de turno en esta caja.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Cuenta Predeterminada VES (Bolívares)
                  </label>
                  <select
                    value={registerForm.defaultBankAccountIdVES}
                    onChange={(e) =>
                      setRegisterForm({
                        ...registerForm,
                        defaultBankAccountIdVES: e.target.value,
                      })
                    }
                    className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <option value="">
                      -- Sin cuenta predeterminada VES --
                    </option>
                    {bankAccounts
                      .filter((a) => a.currency === "VES")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.bankName} - {a.accountNumber.slice(-4)} (Saldo:{" "}
                          {formatMoneyVES(a.currentBalance)})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Cuenta Predeterminada USD
                  </label>
                  <select
                    value={registerForm.defaultBankAccountIdUSD}
                    onChange={(e) =>
                      setRegisterForm({
                        ...registerForm,
                        defaultBankAccountIdUSD: e.target.value,
                      })
                    }
                    className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <option value="">
                      -- Sin cuenta predeterminada USD --
                    </option>
                    {bankAccounts
                      .filter((a) => a.currency === "USD")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.bankName} - {a.accountNumber.slice(-4)} (Saldo:{" "}
                          {formatMoneyUSD(a.currentBalance)})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Departamentos Permitidos */}
            <div className="pt-2 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Departamentos Visibles en esta Caja
                </label>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {registerForm.allowedDepartmentIds.length === 0
                    ? "Todos visibles (sin restricción)"
                    : `${registerForm.allowedDepartmentIds.length} seleccionado(s)`}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-2">
                Restringe los departamentos de productos que podrá despachar
                esta caja en POS y en la toma de pedidos. Si no marca ninguno,
                mostrará todos los departamentos.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 bg-sky-50/60 dark:bg-sky-950/30 rounded-lg border border-sky-200 dark:border-sky-800">
                {availableDepartments.map((dept) => {
                  const isChecked = registerForm.allowedDepartmentIds.includes(
                    dept.id,
                  );
                  return (
                    <label
                      key={dept.id}
                      className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? "bg-sky-50 dark:bg-sky-950/50 border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-semibold"
                          : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-750"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const current = [
                            ...registerForm.allowedDepartmentIds,
                          ];
                          if (e.target.checked) {
                            setRegisterForm({
                              ...registerForm,
                              allowedDepartmentIds: [...current, dept.id],
                            });
                          } else {
                            setRegisterForm({
                              ...registerForm,
                              allowedDepartmentIds: current.filter(
                                (id) => id !== dept.id,
                              ),
                            });
                          }
                        }}
                        className="w-3.5 h-3.5 text-sky-600 rounded"
                      />
                      <span className="truncate">{dept.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex items-start gap-2.5 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-800/40">
                <input
                  type="checkbox"
                  id="registerAcceptsOrders"
                  checked={registerForm.acceptsOrders}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      acceptsOrders: e.target.checked,
                    })
                  }
                  className="w-4 h-4 mt-0.5 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 dark:border-neutral-700 cursor-pointer"
                />
                <label
                  htmlFor="registerAcceptsOrders"
                  className="text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer select-none"
                >
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                    Acepta comandas y toma de pedidos de Restaurante
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block mt-0.5">
                    Permite que los mesoneros y mozos seleccionen esta caja y le
                    envíen comandas para su facturación.
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="registerIsActive"
                  checked={registerForm.isActive}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      isActive: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 dark:border-neutral-700 cursor-pointer"
                />
                <label
                  htmlFor="registerIsActive"
                  className="text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer select-none"
                >
                  Caja registradora habilitada para turnos y ventas
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRegisterModal(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSavingRegister}
              >
                {isSavingRegister
                  ? "Guardando..."
                  : editingRegisterId
                    ? "Actualizar Caja"
                    : "Crear Caja Registradora"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Inicializar Nueva Empresa (Solo Superadmin) */}
      {showInitCompanyModal && isSuperAdminRole(user?.role) && (
        <Modal
          isOpen={showInitCompanyModal}
          onClose={() => !isInitializingCompany && setShowInitCompanyModal(false)}
          title="Inicializar Nueva Empresa en Base de Datos"
          subtitle="Aprovisiona un nuevo tenant con sucursal principal, almacén central, caja registradora y usuario administrador"
          size="lg"
        >
          <form onSubmit={handleInitializeCompany} className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="font-semibold block">Operación de Infraestructura Multitenant</span>
                Esta acción creará un nuevo ecosistema empresarial completo en MySQL. Por favor asegúrese de que el RIF sea el oficial ante el SENIAT.
              </div>
            </div>

            {/* Datos Fiscales */}
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3.5 space-y-3">
              <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                Identificación de la Empresa
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Razón Social Legal *
                  </label>
                  <Input
                    placeholder="INVERSIONES Y SERVICIOS XYZ, C.A."
                    value={initCompanyForm.legalName}
                    onChange={(e) =>
                      setInitCompanyForm({
                        ...initCompanyForm,
                        legalName: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    RIF (Registro Fiscal) *
                  </label>
                  <Input
                    placeholder="J-50123456-7"
                    value={initCompanyForm.rif}
                    onChange={(e) =>
                      setInitCompanyForm({
                        ...initCompanyForm,
                        rif: e.target.value.toUpperCase(),
                      })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Nombre Comercial
                  </label>
                  <Input
                    placeholder="COMERCIAL XYZ"
                    value={initCompanyForm.tradeName}
                    onChange={(e) =>
                      setInitCompanyForm({
                        ...initCompanyForm,
                        tradeName: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Dirección Fiscal Legal *
                  </label>
                  <Input
                    placeholder="Av. Principal, Edificio Centro, Piso 1, Local 4, Caracas"
                    value={initCompanyForm.fiscalAddress}
                    onChange={(e) =>
                      setInitCompanyForm({
                        ...initCompanyForm,
                        fiscalAddress: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Teléfono de Contacto
                  </label>
                  <Input
                    placeholder="+58 212 555-0100"
                    value={initCompanyForm.phone}
                    onChange={(e) =>
                      setInitCompanyForm({
                        ...initCompanyForm,
                        phone: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Correo Electrónico Corporativo
                  </label>
                  <Input
                    type="email"
                    placeholder="contacto@empresa.com"
                    value={initCompanyForm.email}
                    onChange={(e) =>
                      setInitCompanyForm({
                        ...initCompanyForm,
                        email: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Parámetros Impositivos y Monedas */}
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3.5 space-y-3">
              <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                Régimen Fiscal & Monedas
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="initSpecialTaxpayer"
                    checked={initCompanyForm.isSpecialTaxpayer}
                    onChange={(e) =>
                      setInitCompanyForm({
                        ...initCompanyForm,
                        isSpecialTaxpayer: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 dark:border-neutral-700"
                  />
                  <label
                    htmlFor="initSpecialTaxpayer"
                    className="text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer"
                  >
                    Designada como Contribuyente Especial SENIAT (Retiene IVA a proveedores)
                  </label>
                </div>

                {initCompanyForm.isSpecialTaxpayer && (
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Retención IVA Proveedores
                    </label>
                    <select
                      value={initCompanyForm.ivaRetentionRate}
                      onChange={(e) =>
                        setInitCompanyForm({
                          ...initCompanyForm,
                          ivaRetentionRate: Number(e.target.value),
                        })
                      }
                      className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100"
                    >
                      <option value={75}>75% (General)</option>
                      <option value={100}>100% (Especial)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Moneda Base
                  </label>
                  <select
                    value={initCompanyForm.currencyBase}
                    onChange={(e) =>
                      setInitCompanyForm({
                        ...initCompanyForm,
                        currencyBase: e.target.value,
                      })
                    }
                    className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="USD">USD ($ - Dólar)</option>
                    <option value="VES">VES (Bs - Bolívares)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Moneda Secundaria
                  </label>
                  <select
                    value={initCompanyForm.currencySecondary}
                    onChange={(e) =>
                      setInitCompanyForm({
                        ...initCompanyForm,
                        currencySecondary: e.target.value,
                      })
                    }
                    className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="VES">VES (Bs - Bolívares)</option>
                    <option value="USD">USD ($ - Dólar)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Administrador Inicial */}
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3.5 space-y-3">
              <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                Cuenta del Administrador de la Empresa
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Nombre Completo
                  </label>
                  <Input
                    placeholder="Administrador General"
                    value={initCompanyForm.adminFullName}
                    onChange={(e) =>
                      setInitCompanyForm({
                        ...initCompanyForm,
                        adminFullName: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Nombre de Usuario (Login)
                  </label>
                  <Input
                    placeholder="admin_empresa"
                    value={initCompanyForm.adminUsername}
                    onChange={(e) =>
                      setInitCompanyForm({
                        ...initCompanyForm,
                        adminUsername: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Correo del Administrador
                  </label>
                  <Input
                    type="email"
                    placeholder="admin@empresa.com"
                    value={initCompanyForm.adminEmail}
                    onChange={(e) =>
                      setInitCompanyForm({
                        ...initCompanyForm,
                        adminEmail: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Contraseña Inicial
                  </label>
                  <Input
                    type="text"
                    placeholder="Admin2026! (Opcional, predeterminada)"
                    value={initCompanyForm.adminPassword}
                    onChange={(e) =>
                      setInitCompanyForm({
                        ...initCompanyForm,
                        adminPassword: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Licencia del Sistema */}
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3.5 space-y-3">
              <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                Activación de Licencia del Sistema
              </h4>

              <div className="text-[11px] text-neutral-600 dark:text-neutral-400">
                Seleccione la modalidad de activación de licencia para la nueva empresa. Recuerde que si usa una clave de licencia comercial, su Razón Social debe coincidir exactamente con la ingresada arriba.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                  initCompanyForm.activateLicenseMode === "trial"
                    ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 text-sky-900 dark:text-sky-200"
                    : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300"
                }`}>
                  <input
                    type="radio"
                    name="activateLicenseMode"
                    value="trial"
                    checked={initCompanyForm.activateLicenseMode === "trial"}
                    onChange={() =>
                      setInitCompanyForm({
                        ...initCompanyForm,
                        activateLicenseMode: "trial",
                      })
                    }
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-semibold block text-[11px]">Licencia de Prueba (30 Días)</span>
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      Activa automáticamente 30 días de acceso ilimitado vinculada a la nueva Razón Social.
                    </span>
                  </div>
                </label>

                <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                  initCompanyForm.activateLicenseMode === "custom"
                    ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 text-sky-900 dark:text-sky-200"
                    : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300"
                }`}>
                  <input
                    type="radio"
                    name="activateLicenseMode"
                    value="custom"
                    checked={initCompanyForm.activateLicenseMode === "custom"}
                    onChange={() =>
                      setInitCompanyForm({
                        ...initCompanyForm,
                        activateLicenseMode: "custom",
                      })
                    }
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-semibold block text-[11px]">Clave de Licencia Comercial</span>
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      Vincular un paquete criptográfico o clave provista por el proveedor ERO ERP.
                    </span>
                  </div>
                </label>
              </div>

              {initCompanyForm.activateLicenseMode === "custom" && (
                <div className="space-y-1 pt-1">
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                    Clave o Paquete de Licencia *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Pegue aquí el paquete o clave de licencia provista..."
                    value={initCompanyForm.licenseKey}
                    onChange={(e) =>
                      setInitCompanyForm({
                        ...initCompanyForm,
                        licenseKey: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-xs font-mono text-neutral-900 dark:text-neutral-100"
                    required
                  />
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                    Importante: La Razón Social emitida en el certificado de licencia debe coincidir con la Razón Social Legal de la empresa.
                  </p>
                </div>
              )}
            </div>

            {/* Confirmación Crítica */}
            <div className="border border-red-200 dark:border-red-900/60 rounded-lg p-3.5 bg-red-50/40 dark:bg-red-950/20 space-y-2">
              <label className="block text-xs font-bold text-red-800 dark:text-red-300">
                Confirmación de Seguridad Requerida *
              </label>
              <p className="text-[11px] text-red-700 dark:text-red-400">
                Para confirmar la inicialización, escriba exactamente: <span className="font-mono font-bold">INICIALIZAR_EMPRESA</span>
              </p>
              <Input
                placeholder="INICIALIZAR_EMPRESA"
                value={initCompanyForm.securityConfirmation}
                onChange={(e) =>
                  setInitCompanyForm({
                    ...initCompanyForm,
                    securityConfirmation: e.target.value,
                  })
                }
                className="font-mono font-semibold"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <Button
                type="button"
                variant="outline"
                disabled={isInitializingCompany}
                onClick={() => setShowInitCompanyModal(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={
                  isInitializingCompany ||
                  initCompanyForm.securityConfirmation !== "INICIALIZAR_EMPRESA"
                }
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isInitializingCompany
                  ? "Inicializando..."
                  : "Inicializar Empresa"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Resumen de Empresa Inicializada */}
      {showInitResultModal && initResult && (
        <Modal
          isOpen={showInitResultModal}
          onClose={() => setShowInitResultModal(false)}
          title="Empresa Inicializada con Éxito"
          subtitle="Recursos aprovisionados y credenciales de acceso creadas"
        >
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-300 text-xs">
              <span className="font-bold block">Aprovisionamiento Completado</span>
              La empresa ha sido creada en la base de datos con todos sus módulos, sucursal, almacén, caja y métodos de pago operativos.
            </div>

            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3.5 space-y-2 text-xs">
              <div className="font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-100 dark:border-neutral-800 pb-1.5">
                Datos Corporativos Creados
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-neutral-500">Razón Social:</span>{" "}
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {initResult.company?.legalName}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">RIF:</span>{" "}
                  <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">
                    {initResult.company?.rif}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">Sede Principal:</span>{" "}
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {initResult.branch?.name} ({initResult.branch?.code})
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">Almacén Central:</span>{" "}
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {initResult.warehouse?.name} ({initResult.warehouse?.code})
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">Caja Mostrador:</span>{" "}
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {initResult.cashRegister?.name} ({initResult.cashRegister?.code})
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">Métodos de Pago:</span>{" "}
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    7 configurados (con IGTF)
                  </span>
                </div>
              </div>
            </div>

            {/* Credenciales de Acceso */}
            <div className="border border-sky-200 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/20 rounded-lg p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-900 dark:text-sky-200">
                  Credenciales del Administrador
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const text = `ERO ERP - Credenciales de Acceso\nEmpresa: ${initResult.company?.legalName} (${initResult.company?.rif})\nUsuario: ${initResult.adminUser?.username}\nContraseña: ${initResult.adminUser?.initialPassword}\nCorreo: ${initResult.adminUser?.email}`;
                    navigator.clipboard.writeText(text);
                    toast.success("Credenciales copiadas al portapapeles");
                  }}
                  className="flex items-center gap-1 text-[11px] text-sky-700 dark:text-sky-300 hover:underline font-medium cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar credenciales</span>
                </button>
              </div>

              <div className="space-y-1 font-mono text-[11px] text-neutral-800 dark:text-neutral-200 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded p-2.5">
                <div>
                  <span className="text-neutral-400">Usuario:</span>{" "}
                  <span className="font-bold text-neutral-900 dark:text-white">
                    {initResult.adminUser?.username}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400">Contraseña:</span>{" "}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {initResult.adminUser?.initialPassword}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400">Correo:</span>{" "}
                  <span>{initResult.adminUser?.email}</span>
                </div>
              </div>
            </div>

            {/* Licencia Activada */}
            {initResult.license && (
              <div className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 rounded-lg p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Licencia del Sistema Activada
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 uppercase">
                    {initResult.license.type}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-700 dark:text-neutral-300">
                  <div>
                    <span className="text-neutral-500">Razón Social:</span>{" "}
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {initResult.license.companyName}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Vigencia:</span>{" "}
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {initResult.license.validUntil
                        ? new Date(initResult.license.validUntil).toLocaleDateString()
                        : "Permanente"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-neutral-500 block mb-0.5">Clave de Activación:</span>
                    <span className="font-mono text-[10px] break-all bg-white dark:bg-neutral-900 px-2 py-1 rounded border border-neutral-200 dark:border-neutral-800 block select-all">
                      {initResult.license.licenseKey}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <Button
                type="button"
                variant="primary"
                onClick={() => setShowInitResultModal(false)}
              >
                Entendido y Cerrar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
