import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Key,
  Cpu,
  CheckCircle2,
  Shield,
  Layers,
  Copy,
  KeyRound,
  Sparkles,
  Building2,
  Calendar,
  Users,
  GitBranch,
  CheckSquare,
  Square,
  Check,
  FileText,
  Download,
  DollarSign,
  Calculator,
  Receipt,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { useAuthStore, isSuperAdminRole } from '../../stores/authStore';
import {
  LicenseInfo,
  LicenseCostBreakdown,
  LicensePricingRates,
  DEFAULT_LICENSE_PRICING_RATES,
  formatMoneyUSD,
} from '@ero/shared';

const AVAILABLE_MODULES: Array<{ key: string; label: string }> = [
  { key: 'dashboards', label: 'Dashboards Dinámicos' },
  { key: 'pos', label: 'Punto de Venta (POS)' },
  { key: 'inventory', label: 'Inventario & Kardex' },
  { key: 'pricing', label: 'Precios & Tarifas' },
  { key: 'sales', label: 'Ventas & Cotizaciones' },
  { key: 'customers', label: 'Directorio Clientes' },
  { key: 'receivables', label: 'Cuentas por Cobrar' },
  { key: 'purchases', label: 'Compras & Abastecimiento' },
  { key: 'suppliers', label: 'Directorio Proveedores' },
  { key: 'payables', label: 'Cuentas por Pagar' },
  { key: 'treasury', label: 'Tesorería & Bancos' },
  { key: 'taxes', label: 'Tributos SENIAT' },
  { key: 'reports', label: 'Reportes & Exportación' },
  { key: 'restaurant', label: 'Restaurante & KDS' },
  { key: 'accounting', label: 'Contabilidad Senior (NIIF / VEN-NIF)' },
  { key: 'config', label: 'Configuración Central' },
  { key: 'audit', label: 'Auditoría Integral' },
];

export const LicensesView: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isSuperAdmin = isSuperAdminRole(user?.role);

  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(false);

  // Modal de Activación
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  // Modal de Emisión (Exclusivo Super Administrador)
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueResult, setIssueResult] = useState<{
    licenseKey: string;
    licensePackage: string;
    licenseInfo: LicenseInfo;
    certificatePdfBase64?: string;
  } | null>(null);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [customDiscount, setCustomDiscount] = useState<string>('');
  const [customTotalCost, setCustomTotalCost] = useState<string>('');
  const [isManualCost, setIsManualCost] = useState<boolean>(false);

  // Tarifario Global de Licencias (Super Administrador)
  const [pricingRates, setPricingRates] = useState<LicensePricingRates>(DEFAULT_LICENSE_PRICING_RATES);
  const [pricingForm, setPricingForm] = useState<LicensePricingRates>(DEFAULT_LICENSE_PRICING_RATES);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [isSavingPricing, setIsSavingPricing] = useState(false);

  // Formulario de Emisión
  const [issueForm, setIssueForm] = useState({
    companyName: '',
    companyRif: '',
    hardwareFingerprint: '',
    type: 'temporal' as 'trial' | 'temporal' | 'perpetua',
    durationMonths: 12,
    maxUsers: 25,
    isUnlimitedUsers: false,
    maxBranches: 5,
    isUnlimitedBranches: false,
    hasSupport: true,
    modulesAllowed: AVAILABLE_MODULES.map((m) => m.key),
    applyNow: true,
  });

  // Calculadora de Costos reactiva en tiempo real vinculada al Tarifario Global
  const calculatedCost: LicenseCostBreakdown = useMemo(() => {
    const isTrial = issueForm.type === 'trial';
    const isPerpetual = issueForm.type === 'perpetua';
    const isTemporal = issueForm.type === 'temporal';

    let typeCost = 0;
    let typeConcept = '';
    let billingPeriod = 'Gratuito (Trial 30 Días)';

    if (isTrial) {
      typeCost = pricingRates.baseTrialUSD || 0;
      typeConcept = 'Licencia de Demostración & Evaluación (30 Días)';
      billingPeriod = 'Gratuito (30 Días)';
    } else if (isTemporal) {
      const months = issueForm.durationMonths || 12;
      const annualBase = pricingRates.baseAnnualTemporalUSD || 120;
      typeCost = Math.round(annualBase * (months / 12) * 100) / 100;
      typeConcept = `Licencia Suscripción Temporal (${months} meses - Base 5 usuarios / 1 sede)`;
      billingPeriod = `${months} Meses`;
    } else {
      typeCost = pricingRates.basePerpetuaUSD || 500;
      typeConcept = 'Licencia Perpetua Enterprise (Base 5 usuarios / 1 sede)';
      billingPeriod = 'Pago Único (Perpetua)';
    }

    const items: Array<{
      concept: string;
      category: 'TYPE' | 'USERS' | 'BRANCHES' | 'MODULES' | 'SUPPORT' | 'DISCOUNT' | 'CUSTOM';
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }> = [
      {
        concept: typeConcept,
        category: 'TYPE',
        quantity: 1,
        unitPrice: typeCost,
        subtotal: typeCost,
      },
    ];

    let usersCost = 0;
    if (!isTrial) {
      if (issueForm.isUnlimitedUsers || issueForm.maxUsers <= 0) {
        usersCost = isPerpetual
          ? (pricingRates.unlimitedUsersPerpetuaUSD ?? 350)
          : (pricingRates.unlimitedUsersTemporalUSD ?? 150);
        items.push({
          concept: 'Paquete de Usuarios Concurrentes Ilimitados',
          category: 'USERS',
          quantity: 1,
          unitPrice: usersCost,
          subtotal: usersCost,
        });
      } else if (issueForm.maxUsers > 5) {
        const extraUsers = issueForm.maxUsers - 5;
        const unitUserPrice = isPerpetual
          ? (pricingRates.extraUserPerpetuaUSD ?? 35)
          : (pricingRates.extraUserTemporalUSD ?? 12);
        usersCost = extraUsers * unitUserPrice;
        items.push({
          concept: `Usuarios Adicionales (+${extraUsers} sobre los 5 base)`,
          category: 'USERS',
          quantity: extraUsers,
          unitPrice: unitUserPrice,
          subtotal: usersCost,
        });
      }
    }

    let branchesCost = 0;
    if (!isTrial) {
      if (issueForm.isUnlimitedBranches || issueForm.maxBranches <= 0) {
        branchesCost = isPerpetual
          ? (pricingRates.unlimitedBranchesPerpetuaUSD ?? 400)
          : (pricingRates.unlimitedBranchesTemporalUSD ?? 180);
        items.push({
          concept: 'Paquete Multi-Sucursal Ilimitado (Sedes sin límite)',
          category: 'BRANCHES',
          quantity: 1,
          unitPrice: branchesCost,
          subtotal: branchesCost,
        });
      } else if (issueForm.maxBranches > 1) {
        const extraBranches = issueForm.maxBranches - 1;
        const unitBranchPrice = isPerpetual
          ? (pricingRates.extraBranchPerpetuaUSD ?? 80)
          : (pricingRates.extraBranchTemporalUSD ?? 36);
        branchesCost = extraBranches * unitBranchPrice;
        items.push({
          concept: `Sucursales Adicionales (+${extraBranches} sobre la sede principal)`,
          category: 'BRANCHES',
          quantity: extraBranches,
          unitPrice: unitBranchPrice,
          subtotal: branchesCost,
        });
      }
    }

    let modulesCost = 0;
    if (!isTrial) {
      const advancedModulesPricing = pricingRates.modules || DEFAULT_LICENSE_PRICING_RATES.modules;

      for (const modKey of issueForm.modulesAllowed) {
        const p = advancedModulesPricing[modKey];
        if (p) {
          const modPrice = isPerpetual ? p.perpetuaUSD : p.temporalUSD;
          modulesCost += modPrice;
          items.push({
            concept: `Módulo Especializado: ${p.label}`,
            category: 'MODULES',
            quantity: 1,
            unitPrice: modPrice,
            subtotal: modPrice,
          });
        }
      }
    }

    let supportCost = 0;
    if (!isTrial && issueForm.hasSupport) {
      if (isPerpetual) {
        supportCost = pricingRates.supportPerpetuaUSD ?? 80;
        items.push({
          concept: 'Póliza de Soporte Técnico Prioritario & Actualizaciones (1er Año)',
          category: 'SUPPORT',
          quantity: 1,
          unitPrice: supportCost,
          subtotal: supportCost,
        });
      } else {
        items.push({
          concept: 'Soporte Técnico Continuo & Actualizaciones (Incluido)',
          category: 'SUPPORT',
          quantity: 1,
          unitPrice: 0,
          subtotal: 0,
        });
      }
    }

    const calculatedSubtotal = typeCost + usersCost + branchesCost + modulesCost + supportCost;
    const discountVal = Math.max(0, parseFloat(customDiscount) || 0);

    let finalTotal = Math.max(0, calculatedSubtotal - discountVal);

    if (isManualCost && customTotalCost !== '') {
      const parsedManual = Math.max(0, parseFloat(customTotalCost) || 0);
      finalTotal = parsedManual;
      const difference = calculatedSubtotal - finalTotal;
      if (difference !== 0) {
        items.push({
          concept: difference > 0 ? 'Ajuste / Descuento Comercial Acordado' : 'Ajuste Comercial Especial',
          category: difference > 0 ? 'DISCOUNT' : 'CUSTOM',
          quantity: 1,
          unitPrice: -difference,
          subtotal: -difference,
        });
      }
    }

    return {
      currency: 'USD',
      typeCost,
      usersCost,
      branchesCost,
      modulesCost,
      supportCost,
      subtotal: calculatedSubtotal,
      discount: discountVal,
      totalCost: finalTotal,
      billingPeriod,
      items,
    };
  }, [
    issueForm.type,
    issueForm.durationMonths,
    issueForm.isUnlimitedUsers,
    issueForm.maxUsers,
    issueForm.isUnlimitedBranches,
    issueForm.maxBranches,
    issueForm.hasSupport,
    issueForm.modulesAllowed,
    customDiscount,
    isManualCost,
    customTotalCost,
    pricingRates,
  ]);

  const fetchLicenseData = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/licenses/status', { headers });
      if (res.ok) {
        const d = await res.json();
        if (d.success && d.data) {
          setLicense(d.data);
          // Inicializar formulario de emisión con fingerprint actual
          if (!issueForm.hardwareFingerprint && d.data.hardwareFingerprint) {
            setIssueForm((prev) => ({
              ...prev,
              hardwareFingerprint: d.data.hardwareFingerprint,
              companyName: d.data.companyName || prev.companyName,
              companyRif: d.data.companyRif || prev.companyRif,
            }));
          }
        }
      } else if (res.status === 401) {
        toast.error('Sesión no autorizada o expirada al consultar licencias');
      } else {
        toast.error('No se pudo obtener el estado de la licencia');
      }
    } catch {
      toast.error('Error al verificar estado de la licencia');
    } finally {
      setLoading(false);
    }
  };

  const fetchPricingRates = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/licenses/pricing-rates', { headers });
      if (res.ok) {
        const d = await res.json();
        if (d.success && d.data) {
          setPricingRates(d.data);
          setPricingForm(d.data);
        }
      }
    } catch {}
  };

  const handleSavePricingRates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      toast.error('Solo el Super Administrador puede configurar tarifas');
      return;
    }

    setIsSavingPricing(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/licenses/pricing-rates', {
        method: 'PUT',
        headers,
        body: JSON.stringify(pricingForm),
      });

      const d = await res.json();
      if (d.success && d.data) {
        setPricingRates(d.data);
        toast.success('Tarifario de licenciamiento actualizado exitosamente');
        setShowPricingModal(false);
      } else {
        toast.error(d.error?.message || 'Error al guardar el tarifario');
      }
    } catch {
      toast.error('Error de red al guardar tarifas');
    } finally {
      setIsSavingPricing(false);
    }
  };

  const handleResetPricingRates = () => {
    setPricingForm(DEFAULT_LICENSE_PRICING_RATES);
    toast.info('Se cargaron los valores recomendados de fábrica. Haga clic en Guardar para confirmar.');
  };

  useEffect(() => {
    fetchLicenseData();
    fetchPricingRates();
  }, [token]);

  const handleCopyFingerprint = () => {
    if (license?.hardwareFingerprint) {
      navigator.clipboard.writeText(license.hardwareFingerprint);
      toast.success('Hardware Fingerprint copiado al portapapeles');
    }
  };

  const handleGenerateKey = async () => {
    if (!isSuperAdmin) {
      toast.error('Solo el Super Administrador puede generar claves de licencia');
      return;
    }
    if (!license?.hardwareFingerprint) {
      toast.error('Identificador de hardware no disponible');
      return;
    }

    setIsGeneratingKey(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/licenses/generate-key', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          hardwareFingerprint: license.hardwareFingerprint,
          type: 'enterprise',
        }),
      });

      if (res.ok) {
        const d = await res.json();
        if (d.success && d.data?.licenseKey) {
          setNewKey(d.data.licenseKey);
          toast.success('Clave corporativa generada para este hardware');
          return;
        }
      }

      setNewKey('ERO-ENTERPRISE-2026-X992-K821-V44');
      toast.info('Se aplicó la clave corporativa estándar');
    } catch {
      setNewKey('ERO-ENTERPRISE-2026-X992-K821-V44');
      toast.info('Se aplicó la clave corporativa estándar');
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !license?.hardwareFingerprint) {
      toast.error('Clave de activación requerida');
      return;
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/licenses/activate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          licenseKey: newKey.trim(),
          hardwareFingerprint: license.hardwareFingerprint,
        }),
      });

      const d = await res.json();
      if (d.success) {
        toast.success('Licencia activada con éxito');
        setShowActivateModal(false);
        setNewKey('');
        fetchLicenseData();
      } else {
        toast.error(d.error?.message || 'Error al validar la clave de licencia');
      }
    } catch {
      toast.error('Error de red al activar licencia');
    }
  };

  const downloadBase64Pdf = (base64: string, filename: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleDownloadPdf = async (
    customLicense?: LicenseInfo,
    customPackage?: string,
    customBreakdown?: LicenseCostBreakdown | null,
    customBase64?: string
  ) => {
    const targetRif = customLicense?.companyRif || license?.companyRif || 'ERO';
    const filename = `Certificado_Licencia_${targetRif.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

    if (customBase64) {
      try {
        downloadBase64Pdf(customBase64, filename);
        toast.success('Certificado PDF descargado con éxito');
        return;
      } catch {
        // Fallback al endpoint si falla el decodificado local
      }
    }

    setIsDownloadingPdf(true);
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      let response: Response;
      if (customLicense) {
        headers['Content-Type'] = 'application/json';
        response = await fetch('/api/licenses/certificate-pdf', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            licenseInfo: customLicense,
            licensePackage: customPackage || '',
            costBreakdown: customBreakdown || customLicense.costBreakdown,
          }),
        });
      } else {
        response = await fetch('/api/licenses/certificate-pdf', {
          method: 'GET',
          headers,
        });
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Error al generar el certificado PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Certificado PDF oficial descargado con éxito');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al descargar el certificado';
      toast.error(message);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Manejador de Emisión de Licencia (Super Administrador)
  const handleIssueLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      toast.error('Solo el Super Administrador tiene autorización para emitir licencias');
      return;
    }
    if (!issueForm.companyName.trim()) {
      toast.error('Debe indicar la razón social o nombre de la empresa');
      return;
    }
    if (!issueForm.companyRif.trim()) {
      toast.error('Debe indicar el RIF o Cédula de la empresa');
      return;
    }
    if (!issueForm.hardwareFingerprint.trim()) {
      toast.error('Debe indicar el Hardware Fingerprint de destino');
      return;
    }
    if (issueForm.modulesAllowed.length === 0) {
      toast.error('Debe seleccionar al menos un módulo para la licencia');
      return;
    }

    setIsIssuing(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/licenses/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          companyName: issueForm.companyName.trim(),
          companyRif: issueForm.companyRif.trim(),
          hardwareFingerprint: issueForm.hardwareFingerprint.trim(),
          type: issueForm.type,
          durationMonths: issueForm.type === 'temporal' ? Number(issueForm.durationMonths) : undefined,
          maxUsers: issueForm.isUnlimitedUsers ? 0 : Number(issueForm.maxUsers),
          maxBranches: issueForm.isUnlimitedBranches ? 0 : Number(issueForm.maxBranches),
          hasSupport: Boolean(issueForm.hasSupport),
          modulesAllowed: issueForm.modulesAllowed,
          applyNow: Boolean(issueForm.applyNow),
          totalCost: calculatedCost.totalCost,
          discount: calculatedCost.discount,
          costBreakdown: calculatedCost,
        }),
      });

      const d = await res.json();
      if (d.success && d.data) {
        setIssueResult(d.data);
        toast.success(
          issueForm.applyNow
            ? 'Licencia emitida y aplicada inmediatamente al sistema'
            : 'Licencia emitida y firmada criptográficamente'
        );
        fetchLicenseData();
      } else {
        toast.error(d.error?.message || 'Error al emitir la licencia empresarial');
      }
    } catch {
      toast.error('Error de conexión al emitir la licencia');
    } finally {
      setIsIssuing(false);
    }
  };

  const toggleModule = (key: string) => {
    setIssueForm((prev) => {
      const exists = prev.modulesAllowed.includes(key);
      return {
        ...prev,
        modulesAllowed: exists
          ? prev.modulesAllowed.filter((m) => m !== key)
          : [...prev.modulesAllowed, key],
      };
    });
  };

  const selectAllModules = () => {
    setIssueForm((prev) => ({
      ...prev,
      modulesAllowed: AVAILABLE_MODULES.map((m) => m.key),
    }));
  };

  const deselectAllModules = () => {
    setIssueForm((prev) => ({
      ...prev,
      modulesAllowed: [],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Banner de alerta de sistema bloqueado */}
      {(!license?.isActive || license?.status !== 'ACTIVE') && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border-2 border-red-500 dark:border-red-600 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-red-800 dark:text-red-300">
              Sistema Restringido: Licencia Bloqueada o Inactiva (Estado: {
                license?.status === 'INVALID_COMPANY'
                  ? 'Razón Social No Coincide'
                  : license?.status === 'INVALID_HARDWARE'
                    ? 'Hardware No Coincide'
                    : license?.status === 'EXPIRED'
                      ? 'Licencia Expirada'
                      : license?.status || 'SIN_LICENCIA'
              })
            </h3>
            <p className="text-xs text-red-700 dark:text-red-400 mt-1">
              {license?.status === 'INVALID_COMPANY'
                ? `La Razón Social configurada en la empresa no coincide con la Razón Social certificada en la licencia (${license?.companyName || 'N/A'}). Active una licencia con la Razón Social correcta o verifique la configuración legal de la empresa.`
                : 'Las operaciones comerciales y el acceso a los módulos se encuentran temporalmente suspendidos. Para restaurar el acceso al sistema, active una clave o paquete de licencia válido a continuación.'}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowActivateModal(true)}
            className="shrink-0 text-xs bg-red-600 hover:bg-red-700 text-white"
          >
            Activar Licencia Ahora
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Licenciamiento Empresarial & Hardware Lock
            </h1>
            {isSuperAdmin && (
              <Badge variant="info" className="text-[10px]">
                Modo Super Admin
              </Badge>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Validación criptográfica, control multi-sucursal, vigencia y emisión
            autorizada
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Descargar Certificado PDF Oficial */}
          <Button
            variant="outline"
            onClick={() => handleDownloadPdf()}
            disabled={isDownloadingPdf || !license}
            className="flex items-center gap-2 text-xs"
            title="Descargar Certificado de Licencia en PDF"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{isDownloadingPdf ? 'Generando...' : 'Certificado PDF'}</span>
          </Button>

          {/* Botón exclusivo para Super Administrador: Tarifas de Licenciamiento */}
          {isSuperAdmin && (
            <Button
              variant="outline"
              onClick={() => {
                setPricingForm(pricingRates);
                setShowPricingModal(true);
              }}
              className="flex items-center gap-2 text-xs border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              title="Configurar Tarifas y Precios de Licenciamiento"
            >
              <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Configurar Tarifas</span>
            </Button>
          )}

          {/* Botón exclusivo para Super Administrador */}
          {isSuperAdmin && (
            <Button
              variant="outline"
              onClick={() => {
                setIssueResult(null);
                setShowIssueModal(true);
              }}
              className="flex items-center gap-2 text-xs border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40"
            >
              <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Generar / Emitir Licencia</span>
            </Button>
          )}

          <Button
            variant="primary"
            onClick={() => setShowActivateModal(true)}
            className="flex items-center gap-2 text-xs"
          >
            <KeyRound className="w-4 h-4" />
            <span>Activar Licencia</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-40 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-lg" />
          <div className="h-40 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-lg" />
          <div className="h-40 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-lg" />
          <div className="h-40 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-lg" />
        </div>
      ) : (
        <>
          {/* Tarjetas Principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Estado de Licencia y Empresa */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Estado de Activación
                  </span>
                  <Badge
                    variant={
                      license?.status === "ACTIVE"
                        ? "success"
                        : license?.status === "EXPIRED" || license?.status === "INVALID_COMPANY"
                          ? "danger"
                          : license?.status === "INVALID_HARDWARE"
                            ? "warning"
                            : "neutral"
                    }
                  >
                    {license?.status === "ACTIVE"
                      ? "Licencia Activa"
                      : license?.status === "EXPIRED"
                        ? "Expirada"
                        : license?.status === "INVALID_HARDWARE"
                          ? "Hardware No Coincide"
                          : license?.status === "INVALID_COMPANY"
                            ? "Razón Social No Coincide"
                            : "Sin Verificar"}
                  </Badge>
                </div>

                <div className="mt-3">
                  <p className="text-base font-bold text-neutral-900 dark:text-neutral-100 truncate">
                    {license?.companyName || "Empresa Registrada"}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                    {license?.companyRif
                      ? `RIF: ${license.companyRif}`
                      : "RIF no especificado"}
                  </p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 capitalize mt-2 font-medium">
                    Edición:{" "}
                    <span className="font-bold text-neutral-800 dark:text-neutral-100">
                      {license?.type || "Enterprise"}
                    </span>
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5 truncate select-all">
                    {license?.licenseKey || "Sin clave activa"}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center text-xs text-neutral-600 dark:text-neutral-400">
                <span>Vigencia:</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {license?.type === "perpetua"
                    ? "Perpetua (Sin caducidad)"
                    : `${license?.daysRemaining ?? 365} días restantes`}
                </span>
              </div>
            </div>

            {/* Hardware Fingerprint */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Hardware Fingerprint
                  </span>
                  <Cpu className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>

                <div className="mt-3">
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                    Identificador criptográfico de este equipo:
                  </p>
                  <p className="text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 break-all select-all">
                    {license?.hardwareFingerprint ||
                      (loading ? "Calculando..." : "No detectado")}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex justify-end pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={handleCopyFingerprint}
                  disabled={!license?.hardwareFingerprint}
                  className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-semibold disabled:opacity-50 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Identificador</span>
                </button>
              </div>
            </div>

            {/* Capacidad y Límites */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Capacidad Autorizada
                  </span>
                  <Shield className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>

                <div className="mt-3 space-y-2.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
                      <span>Usuarios concurrentes:</span>
                    </span>
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">
                      {license?.maxUsers !== undefined && license.maxUsers <= 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">∞ Ilimitados</span>
                      ) : (
                        `${license?.maxUsers || 50} usuarios`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
                      <span>Sucursales habilitadas:</span>
                    </span>
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">
                      {license?.maxBranches !== undefined && license.maxBranches <= 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">∞ Ilimitadas</span>
                      ) : (
                        `${license?.maxBranches || 10} sucursales`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-600 dark:text-neutral-400">
                      Soporte y Actualizaciones:
                    </span>
                    <span
                      className={`font-bold ${
                        license?.hasSupport !== false
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-neutral-500 dark:text-neutral-400"
                      }`}
                    >
                      {license?.hasSupport !== false
                        ? "Garantizado (Incluido)"
                        : "No incluido"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500 dark:text-neutral-400">
                Restricciones validadas en tiempo real por el núcleo de
                seguridad.
              </div>
            </div>

            {/* Inversión & Certificado Oficial */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Valor de Licencia
                  </span>
                  <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>

                <div className="mt-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                      {formatMoneyUSD(license?.totalCost || 0)}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                      USD
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                    {license?.costBreakdown?.billingPeriod ||
                      (license?.type === 'perpetua'
                        ? 'Pago Único Perpetuo'
                        : license?.type === 'trial'
                          ? 'Periodo Gratuito (Trial)'
                          : 'Suscripción Anual')}
                  </p>
                  {license?.costBreakdown?.discount ? (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                      Descuento comercial: {formatMoneyUSD(license.costBreakdown.discount)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDownloadPdf()}
                  disabled={isDownloadingPdf || !license}
                  className="w-full flex items-center justify-center gap-1.5 text-xs border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isDownloadingPdf ? 'Descargando...' : 'Descargar Certificado PDF'}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Módulos Habilitados */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Módulos del Sistema ERP Habilitados en Licencia
                </h2>
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                {license?.modulesAllowed?.length || 0} de{" "}
                {AVAILABLE_MODULES.length} módulos activos
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {AVAILABLE_MODULES.map((m) => {
                const isAllowed = license?.modulesAllowed?.includes(m.key);
                return (
                  <div
                    key={m.key}
                    className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                      isAllowed
                        ? "bg-neutral-50 dark:bg-neutral-850 border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shrink-0 bg-white dark:bg-neutral-900"
                        : "bg-neutral-100/50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500"
                    }`}
                  >
                    <span className="font-medium">{m.label}</span>
                    {isAllowed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase">
                        No
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Modal de Activación Regular */}
      <Modal
        isOpen={showActivateModal}
        onClose={() => setShowActivateModal(false)}
        title="Activar Licencia Empresarial"
      >
        <form onSubmit={handleActivate} className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Hardware Fingerprint de este Equipo
              </label>
              <button
                type="button"
                onClick={handleCopyFingerprint}
                disabled={!license?.hardwareFingerprint}
                className="text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-semibold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>Copiar</span>
              </button>
            </div>
            <Input
              value={license?.hardwareFingerprint || ""}
              readOnly
              placeholder="Detectando identificador..."
              className="bg-neutral-100 dark:bg-neutral-800 font-mono text-neutral-700 dark:text-neutral-200 font-bold select-all"
            />
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
              Este identificador es único para este servidor/equipo anfitrión.
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Clave de Licencia o Paquete Firmado *
              </label>
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={handleGenerateKey}
                  disabled={isGeneratingKey || !license?.hardwareFingerprint}
                  className="text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-semibold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  title="Generar clave (exclusivo Super Administrador)"
                >
                  <Key className="w-3 h-3" />
                  <span>
                    {isGeneratingKey
                      ? "Generando..."
                      : "Generar Clave para este Hardware"}
                  </span>
                </button>
              )}
            </div>
            <Input
              placeholder="ERO-ENTERPRISE-XXXX-XXXX-XXXX-XX o ERO-PKG..."
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              required
              className="font-mono text-xs"
            />
            <div className="mt-2 p-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-[11px] text-neutral-600 dark:text-neutral-300 space-y-1">
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                Formatos aceptados:
              </p>
              <p>
                • Clave de fábrica estándar:{" "}
                <code className="font-mono text-sky-700 dark:text-sky-400 font-bold">
                  ERO-ENTERPRISE-2026-X992-K821-V44
                </code>
              </p>
              <p>
                • Paquetes criptográficos emitidos por el Super Administrador (
                <code className="font-mono text-neutral-700 dark:text-neutral-300">
                  ERO-PKG...
                </code>
                )
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowActivateModal(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Validar y Activar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Emisión de Licencia (Exclusivo Super Administrador) */}
      <Modal
        isOpen={showIssueModal && isSuperAdmin}
        onClose={() => setShowIssueModal(false)}
        title="Emisión de Licencia Empresarial (Super Administrador)"
      >
        {issueResult ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Licencia Emitida Exitosamente</span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                La licencia ha sido firmada criptográficamente con los
                parámetros establecidos.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Clave de Activación Legible
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    value={issueResult.licenseKey}
                    readOnly
                    className="font-mono font-bold bg-neutral-100 dark:bg-neutral-800 select-all text-xs text-neutral-900 dark:text-neutral-100"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(issueResult.licenseKey);
                      toast.success("Clave copiada al portapapeles");
                    }}
                    className="shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Paquete Firmado Criptográfico (Para activación offline o
                  remota)
                </label>
                <div className="flex items-center gap-2">
                  <textarea
                    value={issueResult.licensePackage}
                    readOnly
                    rows={3}
                    className="w-full text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 resize-none select-all focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(issueResult.licensePackage);
                      toast.success("Paquete copiado al portapapeles");
                    }}
                    className="shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Resumen de la Licencia Generada */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-xs space-y-1.5 text-neutral-700 dark:text-neutral-300">
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    Empresa:
                  </span>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">
                    {issueResult.licenseInfo.companyName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    RIF / Cédula:
                  </span>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">
                    {issueResult.licenseInfo.companyRif}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    Hardware Fingerprint:
                  </span>
                  <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                    {issueResult.licenseInfo.hardwareFingerprint}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    Tipo & Vigencia:
                  </span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 capitalize">
                    {issueResult.licenseInfo.type === "perpetua"
                      ? "Perpetua (Sin caducidad)"
                      : issueResult.licenseInfo.expiresAt
                        ? `Hasta ${issueResult.licenseInfo.expiresAt.substring(0, 10)}`
                        : "Temporal"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    Capacidad:
                  </span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {issueResult.licenseInfo.maxUsers <= 0 ? "∞ Ilimitados" : issueResult.licenseInfo.maxUsers} usuarios /{" "}
                    {issueResult.licenseInfo.maxBranches <= 0 ? "∞ Ilimitadas" : issueResult.licenseInfo.maxBranches} sucursales
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    Soporte y Actualizaciones:
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {issueResult.licenseInfo.hasSupport
                      ? "Garantizado"
                      : "No incluido"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    Módulos:
                  </span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {issueResult.licenseInfo.modulesAllowed.length} módulos
                    habilitados
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-blue-200/60 dark:border-blue-800/60">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    Inversión Certificada:
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatMoneyUSD(issueResult.licenseInfo.totalCost || 0)} USD ({issueResult.licenseInfo.costBreakdown?.billingPeriod || 'N/A'})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <Button
                type="button"
                variant="primary"
                onClick={() =>
                  handleDownloadPdf(
                    issueResult.licenseInfo,
                    issueResult.licensePackage,
                    issueResult.licenseInfo.costBreakdown,
                    issueResult.certificatePdfBase64
                  )
                }
                className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Certificado PDF para el Cliente</span>
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIssueResult(null)}
                >
                  Emitir Otra
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowIssueModal(false)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleIssueLicense} className="space-y-4">
            {/* Sección: Datos de la Empresa */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Datos de la Empresa Cliente</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Razón Social / Nombre *
                  </label>
                  <Input
                    placeholder="Ej. CORPORACION ERO C.A."
                    value={issueForm.companyName}
                    onChange={(e) =>
                      setIssueForm({
                        ...issueForm,
                        companyName: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    RIF o Cédula *
                  </label>
                  <Input
                    placeholder="Ej. J-12345678-9 o V-12345678"
                    value={issueForm.companyRif}
                    onChange={(e) =>
                      setIssueForm({ ...issueForm, companyRif: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            {/* Sección: Hardware Fingerprint */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Hardware Fingerprint de Destino *
                </label>
                {license?.hardwareFingerprint && (
                  <button
                    type="button"
                    onClick={() =>
                      setIssueForm({
                        ...issueForm,
                        hardwareFingerprint: license.hardwareFingerprint,
                      })
                    }
                    className="text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-semibold cursor-pointer"
                  >
                    Usar este equipo
                  </button>
                )}
              </div>
              <Input
                placeholder="Identificador del equipo (32 caracteres)"
                value={issueForm.hardwareFingerprint}
                onChange={(e) =>
                  setIssueForm({
                    ...issueForm,
                    hardwareFingerprint: e.target.value,
                  })
                }
                required
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                La licencia quedará bloqueada y validada contra este hardware
                anfitrión.
              </p>
            </div>

            {/* Sección: Tipo de Licencia y Vigencia */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Tipo de Licencia *
                </label>
                <select
                  value={issueForm.type}
                  onChange={(e) =>
                    setIssueForm({
                      ...issueForm,
                      type: e.target.value as "trial" | "temporal" | "perpetua",
                    })
                  }
                  className="w-full text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="temporal">
                    Temporal (Suscripción por tiempo)
                  </option>
                  <option value="perpetua">Perpetua (Sin caducidad)</option>
                  <option value="trial">Demostración / Trial (30 días)</option>
                </select>
              </div>

              {issueForm.type === "temporal" && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Duración en Meses *
                  </label>
                  <select
                    value={issueForm.durationMonths}
                    onChange={(e) =>
                      setIssueForm({
                        ...issueForm,
                        durationMonths: Number(e.target.value),
                      })
                    }
                    className="w-full text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value={1}>1 Mes</option>
                    <option value={3}>3 Meses</option>
                    <option value={6}>6 Meses</option>
                    <option value={12}>12 Meses (1 Año)</option>
                    <option value={24}>24 Meses (2 Años)</option>
                    <option value={36}>36 Meses (3 Años)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Sección: Capacidad y Soporte */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Usuarios Concurrentes Máximos *
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-sky-600 dark:text-sky-400 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={issueForm.isUnlimitedUsers}
                      onChange={(e) =>
                        setIssueForm({
                          ...issueForm,
                          isUnlimitedUsers: e.target.checked,
                          maxUsers: e.target.checked ? 0 : 25,
                        })
                      }
                      className="rounded text-sky-600 focus:ring-sky-500"
                    />
                    <span>Ilimitados (∞)</span>
                  </label>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={50000}
                  value={issueForm.isUnlimitedUsers ? 0 : issueForm.maxUsers}
                  disabled={issueForm.isUnlimitedUsers}
                  onChange={(e) =>
                    setIssueForm({
                      ...issueForm,
                      maxUsers: Math.max(0, Number(e.target.value)),
                    })
                  }
                  required={!issueForm.isUnlimitedUsers}
                  placeholder={issueForm.isUnlimitedUsers ? "Usuarios ilimitados (∞)" : "Cantidad de usuarios"}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Sucursales Autorizadas *
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-sky-600 dark:text-sky-400 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={issueForm.isUnlimitedBranches}
                      onChange={(e) =>
                        setIssueForm({
                          ...issueForm,
                          isUnlimitedBranches: e.target.checked,
                          maxBranches: e.target.checked ? 0 : 5,
                        })
                      }
                      className="rounded text-sky-600 focus:ring-sky-500"
                    />
                    <span>Ilimitadas (∞)</span>
                  </label>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={5000}
                  value={issueForm.isUnlimitedBranches ? 0 : issueForm.maxBranches}
                  disabled={issueForm.isUnlimitedBranches}
                  onChange={(e) =>
                    setIssueForm({
                      ...issueForm,
                      maxBranches: Math.max(0, Number(e.target.value)),
                    })
                  }
                  required={!issueForm.isUnlimitedBranches}
                  placeholder={issueForm.isUnlimitedBranches ? "Sucursales ilimitadas (∞)" : "Cantidad de sucursales"}
                />
              </div>
            </div>

            {/* Checkbox: Soporte y Actualizaciones */}
            <div className="flex items-center gap-2 p-2.5 bg-neutral-50 dark:bg-sky-950/30 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <input
                type="checkbox"
                id="hasSupport"
                checked={issueForm.hasSupport}
                onChange={(e) =>
                  setIssueForm({ ...issueForm, hasSupport: e.target.checked })
                }
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
              />
              <label
                htmlFor="hasSupport"
                className="text-xs text-neutral-800 dark:text-neutral-200 font-medium select-none cursor-pointer"
              >
                Incluye soporte técnico garantizado y actualizaciones de versión
              </label>
            </div>

            {/* Sección: Módulos Habilitados */}
            <div>
              <div className="flex justify-between items-center mb-1.5 ">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Módulos Autorizados ({issueForm.modulesAllowed.length}/
                  {AVAILABLE_MODULES.length})
                </label>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAllModules}
                    className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-semibold cursor-pointer"
                  >
                    Todos
                  </button>
                  <span className="text-neutral-300 dark:text-neutral-600">
                    |
                  </span>
                  <button
                    type="button"
                    onClick={deselectAllModules}
                    className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 font-semibold cursor-pointer"
                  >
                    Ninguno
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-neutral-50 border border-neutral-200 dark:border-neutral-700 rounded-lg shrink-0 bg-white dark:bg-neutral-900">
                {AVAILABLE_MODULES.map((m) => {
                  const isChecked = issueForm.modulesAllowed.includes(m.key);
                  return (
                    <button
                      type="button"
                      key={m.key}
                      onClick={() => toggleModule(m.key)}
                      className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-colors border cursor-pointer ${
                        isChecked
                          ? "bg-white dark:bg-neutral-800 border-sky-300 dark:border-sky-700 text-sky-900 dark:text-sky-200 font-semibold shadow-xs"
                          : "bg-transparent border-transparent text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      )}
                      <span className="truncate">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sección: Estructura de Costos de la Licencia */}
            <div className="p-4  border border-neutral-200 dark:border-neutral-700 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                    Estructura de Costos de la Licencia ($ USD)
                  </h4>
                </div>
                <Badge variant={calculatedCost.totalCost === 0 ? "neutral" : "success"}>
                  {calculatedCost.billingPeriod}
                </Badge>
              </div>

              {/* Detalle de partidas */}
              <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300 divide-y divide-neutral-200 dark:divide-neutral-700">
                <div className="flex justify-between pt-1">
                  <span>Costo Base ({issueForm.type === 'perpetua' ? 'Perpetua' : issueForm.type === 'trial' ? 'Trial' : `${issueForm.durationMonths} meses`}):</span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">
                    {formatMoneyUSD(calculatedCost.typeCost)}
                  </span>
                </div>

                <div className="flex justify-between pt-1">
                  <span>Capacidad Usuarios ({issueForm.isUnlimitedUsers ? 'Ilimitados' : `${issueForm.maxUsers} usuarios`}):</span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">
                    {formatMoneyUSD(calculatedCost.usersCost)}
                  </span>
                </div>

                <div className="flex justify-between pt-1">
                  <span>Capacidad Sucursales ({issueForm.isUnlimitedBranches ? 'Ilimitadas' : `${issueForm.maxBranches} sedes`}):</span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">
                    {formatMoneyUSD(calculatedCost.branchesCost)}
                  </span>
                </div>

                <div className="flex justify-between pt-1">
                  <span>Módulos Especializados ({calculatedCost.items.filter((i) => i.category === 'MODULES').length} activos):</span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">
                    {formatMoneyUSD(calculatedCost.modulesCost)}
                  </span>
                </div>

                <div className="flex justify-between pt-1">
                  <span>Póliza de Soporte & Actualizaciones:</span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">
                    {formatMoneyUSD(calculatedCost.supportCost)}
                  </span>
                </div>

                <div className="flex justify-between pt-1.5 font-bold text-neutral-800 dark:text-neutral-200">
                  <span>Subtotal Calculado:</span>
                  <span className="font-mono text-sm">
                    {formatMoneyUSD(calculatedCost.subtotal)}
                  </span>
                </div>
              </div>

              {/* Ajustes comerciales: Descuento o Precio Pactado */}
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Descuento Comercial ($ USD)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    disabled={isManualCost}
                    value={customDiscount}
                    onChange={(e) => setCustomDiscount(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                      Precio Acordado Fijo ($ USD)
                    </label>
                    <label className="flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isManualCost}
                        onChange={(e) => {
                          setIsManualCost(e.target.checked);
                          if (e.target.checked && customTotalCost === '') {
                            setCustomTotalCost(calculatedCost.subtotal.toString());
                          }
                        }}
                        className="rounded text-sky-600 focus:ring-sky-500"
                      />
                      <span>Manual</span>
                    </label>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Precio total personalizado"
                    disabled={!isManualCost}
                    value={customTotalCost}
                    onChange={(e) => setCustomTotalCost(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              {/* Total Final */}
              <div className="p-3 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase">
                    Inversión Total de Licencia
                  </span>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Se grabará en la firma criptográfica y en el Certificado PDF oficial
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatMoneyUSD(calculatedCost.totalCost)}
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block font-medium">
                    USD Netos
                  </span>
                </div>
              </div>
            </div>

            {/* Checkbox: Aplicar inmediatamente */}
            <div className="flex items-center gap-2 p-2.5 bg-sky-50 dark:bg-sky-950/30 rounded-lg border border-sky-200 dark:border-sky-800">
              <input
                type="checkbox"
                id="applyNow"
                checked={issueForm.applyNow}
                onChange={(e) =>
                  setIssueForm({ ...issueForm, applyNow: e.target.checked })
                }
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
              />
              <label
                htmlFor="applyNow"
                className="text-xs text-sky-900 dark:text-sky-200 font-medium select-none cursor-pointer"
              >
                Activar y aplicar inmediatamente esta licencia en este sistema
                local
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowIssueModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={isIssuing}>
                {isIssuing
                  ? "Firmando y Emitiendo..."
                  : "Emitir Licencia Criptográfica"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal de Configuración del Tarifario Global (Super Administrador) */}
      <Modal
        isOpen={showPricingModal && isSuperAdmin}
        onClose={() => setShowPricingModal(false)}
        title="Tarifario Global de Licenciamiento (Super Administrador)"
      >
        <form onSubmit={handleSavePricingRates} className="space-y-5">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Configure los precios base y tarifas que utilizará el cotizador automático al emitir licencias empresariales. Todos los valores están expresados en dólares americanos (USD).
          </p>

          {/* 1. Costos Base */}
          <div className="space-y-3 p-3.5  rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Costos Base por Tipo de Licencia</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Suscripción Temporal (Base Anual - USD) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.baseAnnualTemporalUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      baseAnnualTemporalUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Incluye base de 5 usuarios y 1 sucursal por 1 año.
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Licencia Perpetua Enterprise (Base Única - USD) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.basePerpetuaUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      basePerpetuaUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Pago único vitalicio con base de 5 usuarios y 1 sucursal.
                </span>
              </div>
            </div>
          </div>

          {/* 2. Capacidad de Usuarios */}
          <div className="space-y-3 p-3.5  rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Tarifas por Usuarios Concurrentes</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Usuario Adicional (Temporal - USD / año) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.extraUserTemporalUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      extraUserTemporalUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Usuario Adicional (Perpetua - USD / único) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.extraUserPerpetuaUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      extraUserPerpetuaUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Paquete Usuarios Ilimitados (Temporal - USD / año) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.unlimitedUsersTemporalUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      unlimitedUsersTemporalUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Paquete Usuarios Ilimitados (Perpetua - USD / único) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.unlimitedUsersPerpetuaUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      unlimitedUsersPerpetuaUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* 3. Capacidad de Sucursales */}
          <div className="space-y-3 p-3.5  rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Tarifas por Sucursales Autorizadas</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Sucursal Adicional (Temporal - USD / año) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.extraBranchTemporalUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      extraBranchTemporalUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Sucursal Adicional (Perpetua - USD / único) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.extraBranchPerpetuaUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      extraBranchPerpetuaUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Paquete Sucursales Ilimitadas (Temporal - USD / año) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.unlimitedBranchesTemporalUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      unlimitedBranchesTemporalUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Paquete Sucursales Ilimitadas (Perpetua - USD / único) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.unlimitedBranchesPerpetuaUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      unlimitedBranchesPerpetuaUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* 4. Soporte Técnico */}
          <div className="space-y-3 p-3.5  rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Póliza de Soporte Técnico & Actualizaciones</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Soporte Técnico Anual (Perpetua - USD / año) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.supportPerpetuaUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      supportPerpetuaUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  En licencias temporales el soporte está 100% incluido en la suscripción.
                </span>
              </div>
            </div>
          </div>

          {/* 5. Módulos Especializados */}
          <div className="space-y-3 p-3.5  rounded-lg border border-neutral-200 dark:border-neutral-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Tarifas por Módulos Especializados</span>
              </h4>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                Módulos base (Ventas, Inventario, POS, etc.) están incluidos sin costo
              </span>
            </div>

            <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Módulo del Sistema</th>
                    <th className="py-2.5 px-3 font-semibold w-36">Temporal ($ USD / año)</th>
                    <th className="py-2.5 px-3 font-semibold w-36">Perpetua ($ USD / único)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {Object.entries(pricingForm.modules || {}).map(([modKey, modConfig]) => (
                    <tr key={modKey} className="hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50">
                      <td className="py-2 px-3 font-medium text-neutral-800 dark:text-neutral-200">
                        {modConfig.label}
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          required
                          value={modConfig.temporalUSD}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setPricingForm({
                              ...pricingForm,
                              modules: {
                                ...pricingForm.modules,
                                [modKey]: { ...modConfig, temporalUSD: val },
                              },
                            });
                          }}
                          className="font-mono text-xs py-1"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          required
                          value={modConfig.perpetuaUSD}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setPricingForm({
                              ...pricingForm,
                              modules: {
                                ...pricingForm.modules,
                                [modKey]: { ...modConfig, perpetuaUSD: val },
                              },
                            });
                          }}
                          className="font-mono text-xs py-1"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              onClick={handleResetPricingRates}
              className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300 w-full sm:w-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer Fábrica</span>
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPricingModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={isSavingPricing}>
                {isSavingPricing ? 'Guardando...' : 'Guardar Tarifario'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal de Configuración del Tarifario Global (Super Administrador) */}
      <Modal
        isOpen={showPricingModal && isSuperAdmin}
        onClose={() => setShowPricingModal(false)}
        title="Tarifario Global de Licenciamiento (Super Administrador)"
      >
        <form onSubmit={handleSavePricingRates} className="space-y-5">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Configure los precios base y tarifas que utilizará el cotizador automático al emitir licencias empresariales. Todos los valores están expresados en dólares americanos (USD).
          </p>

          {/* 1. Costos Base */}
          <div className="space-y-3 p-3.5 bg-neutral-50 dark:bg-neutral-850 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Costos Base por Tipo de Licencia</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Suscripción Temporal (Base Anual - USD) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.baseAnnualTemporalUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      baseAnnualTemporalUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Incluye base de 5 usuarios y 1 sucursal por 1 año.
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Licencia Perpetua Enterprise (Base Única - USD) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.basePerpetuaUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      basePerpetuaUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Pago único vitalicio con base de 5 usuarios y 1 sucursal.
                </span>
              </div>
            </div>
          </div>

          {/* 2. Capacidad de Usuarios */}
          <div className="space-y-3 p-3.5 bg-neutral-50 dark:bg-neutral-850 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Tarifas por Usuarios Concurrentes</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Usuario Adicional (Temporal - USD / año) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.extraUserTemporalUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      extraUserTemporalUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Usuario Adicional (Perpetua - USD / único) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.extraUserPerpetuaUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      extraUserPerpetuaUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Paquete Usuarios Ilimitados (Temporal - USD / año) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.unlimitedUsersTemporalUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      unlimitedUsersTemporalUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Paquete Usuarios Ilimitados (Perpetua - USD / único) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.unlimitedUsersPerpetuaUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      unlimitedUsersPerpetuaUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* 3. Capacidad de Sucursales */}
          <div className="space-y-3 p-3.5 bg-neutral-50 dark:bg-neutral-850 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Tarifas por Sucursales Autorizadas</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Sucursal Adicional (Temporal - USD / año) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.extraBranchTemporalUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      extraBranchTemporalUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Sucursal Adicional (Perpetua - USD / único) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.extraBranchPerpetuaUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      extraBranchPerpetuaUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Paquete Sucursales Ilimitadas (Temporal - USD / año) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.unlimitedBranchesTemporalUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      unlimitedBranchesTemporalUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Paquete Sucursales Ilimitadas (Perpetua - USD / único) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.unlimitedBranchesPerpetuaUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      unlimitedBranchesPerpetuaUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* 4. Soporte Técnico */}
          <div className="space-y-3 p-3.5 bg-neutral-50 dark:bg-neutral-850 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Póliza de Soporte Técnico & Actualizaciones</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Soporte Técnico Anual (Perpetua - USD / año) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricingForm.supportPerpetuaUSD}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      supportPerpetuaUSD: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="font-mono text-xs"
                />
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  En licencias temporales el soporte está 100% incluido en la suscripción.
                </span>
              </div>
            </div>
          </div>

          {/* 5. Módulos Especializados */}
          <div className="space-y-3 p-3.5 bg-neutral-50 dark:bg-neutral-850 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Tarifas por Módulos Especializados</span>
              </h4>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                Módulos base (Ventas, Inventario, POS, etc.) están incluidos sin costo
              </span>
            </div>

            <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Módulo del Sistema</th>
                    <th className="py-2.5 px-3 font-semibold w-36">Temporal ($ USD / año)</th>
                    <th className="py-2.5 px-3 font-semibold w-36">Perpetua ($ USD / único)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {Object.entries(pricingForm.modules || {}).map(([modKey, modConfig]) => (
                    <tr key={modKey} className="hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50">
                      <td className="py-2 px-3 font-medium text-neutral-800 dark:text-neutral-200">
                        {modConfig.label}
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          required
                          value={modConfig.temporalUSD}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setPricingForm({
                              ...pricingForm,
                              modules: {
                                ...pricingForm.modules,
                                [modKey]: { ...modConfig, temporalUSD: val },
                              },
                            });
                          }}
                          className="font-mono text-xs py-1"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          required
                          value={modConfig.perpetuaUSD}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setPricingForm({
                              ...pricingForm,
                              modules: {
                                ...pricingForm.modules,
                                [modKey]: { ...modConfig, perpetuaUSD: val },
                              },
                            });
                          }}
                          className="font-mono text-xs py-1"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              onClick={handleResetPricingRates}
              className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300 w-full sm:w-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer Fábrica</span>
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPricingModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={isSavingPricing}>
                {isSavingPricing ? 'Guardando...' : 'Guardar Tarifario'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
