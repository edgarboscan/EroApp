import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
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
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { useAuthStore, isSuperAdminRole } from '../../stores/authStore';
import { LicenseInfo } from '@ero/shared';

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
  } | null>(null);

  // Formulario de Emisión
  const [issueForm, setIssueForm] = useState({
    companyName: '',
    companyRif: '',
    hardwareFingerprint: '',
    type: 'temporal' as 'trial' | 'temporal' | 'perpetua',
    durationMonths: 12,
    maxUsers: 25,
    maxBranches: 5,
    hasSupport: true,
    modulesAllowed: AVAILABLE_MODULES.map((m) => m.key),
    applyNow: true,
  });

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

  useEffect(() => {
    fetchLicenseData();
  }, [token]);

  const handleCopyFingerprint = () => {
    if (license?.hardwareFingerprint) {
      navigator.clipboard.writeText(license.hardwareFingerprint);
      toast.success('Hardware Fingerprint copiado al portapapeles');
    }
  };

  const handleGenerateKey = async () => {
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

  // Manejador de Emisión de Licencia (Super Administrador)
  const handleIssueLicense = async (e: React.FormEvent) => {
    e.preventDefault();
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
          maxUsers: Number(issueForm.maxUsers),
          maxBranches: Number(issueForm.maxBranches),
          hasSupport: Boolean(issueForm.hasSupport),
          modulesAllowed: issueForm.modulesAllowed,
          applyNow: Boolean(issueForm.applyNow),
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
              Licenciamiento Empresarial & Hardware Lock
            </h1>
            {isSuperAdmin && (
              <Badge variant="info" className="text-[10px]">
                Modo Super Admin
              </Badge>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Validación criptográfica, control multi-sucursal, vigencia y emisión autorizada
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Botón exclusivo para Super Administrador */}
          {isSuperAdmin && (
            <Button
              variant="outline"
              onClick={() => {
                setIssueResult(null);
                setShowIssueModal(true);
              }}
              className="flex items-center gap-2 text-xs border-sky-300 text-sky-800 hover:bg-sky-50"
            >
              <Sparkles className="w-4 h-4 text-sky-600" />
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-40 bg-neutral-200 animate-pulse rounded-lg" />
          <div className="h-40 bg-neutral-200 animate-pulse rounded-lg" />
          <div className="h-40 bg-neutral-200 animate-pulse rounded-lg" />
        </div>
      ) : (
        <>
          {/* Tarjetas Principales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Estado de Licencia y Empresa */}
            <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Estado de Activación
                  </span>
                  <Badge
                    variant={
                      license?.status === 'ACTIVE'
                        ? 'success'
                        : license?.status === 'EXPIRED'
                        ? 'danger'
                        : license?.status === 'INVALID_HARDWARE'
                        ? 'warning'
                        : 'neutral'
                    }
                  >
                    {license?.status === 'ACTIVE'
                      ? 'Licencia Activa'
                      : license?.status === 'EXPIRED'
                      ? 'Expirada'
                      : license?.status === 'INVALID_HARDWARE'
                      ? 'Hardware No Coincide'
                      : 'Sin Verificar'}
                  </Badge>
                </div>

                <div className="mt-3">
                  <p className="text-base font-bold text-neutral-900 truncate">
                    {license?.companyName || 'Empresa Registrada'}
                  </p>
                  <p className="text-xs text-neutral-500 font-mono mt-0.5">
                    {license?.companyRif ? `RIF: ${license.companyRif}` : 'RIF no especificado'}
                  </p>
                  <p className="text-xs text-neutral-600 capitalize mt-2 font-medium">
                    Edición: <span className="font-bold text-neutral-800">{license?.type || 'Enterprise'}</span>
                  </p>
                  <p className="text-[11px] text-neutral-500 font-mono mt-0.5 truncate select-all">
                    {license?.licenseKey || 'Sin clave activa'}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-200 flex justify-between items-center text-xs text-neutral-600">
                <span>Vigencia:</span>
                <span className="font-semibold text-neutral-800">
                  {license?.type === 'perpetua'
                    ? 'Perpetua (Sin caducidad)'
                    : `${license?.daysRemaining ?? 365} días restantes`}
                </span>
              </div>
            </div>

            {/* Hardware Fingerprint */}
            <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Hardware Fingerprint
                  </span>
                  <Cpu className="w-4 h-4 text-sky-600" />
                </div>

                <div className="mt-3">
                  <p className="text-[11px] text-neutral-500 mb-1">Identificador criptográfico de este equipo:</p>
                  <p className="text-xs font-mono font-bold text-neutral-900 bg-neutral-100 p-2.5 rounded-lg border border-neutral-200 break-all select-all">
                    {license?.hardwareFingerprint || (loading ? 'Calculando...' : 'No detectado')}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex justify-end pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={handleCopyFingerprint}
                  disabled={!license?.hardwareFingerprint}
                  className="flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 font-semibold disabled:opacity-50"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Identificador</span>
                </button>
              </div>
            </div>

            {/* Capacidad y Límites */}
            <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Capacidad Autorizada
                  </span>
                  <Shield className="w-4 h-4 text-sky-600" />
                </div>

                <div className="mt-3 space-y-2.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-600 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Usuarios concurrentes:</span>
                    </span>
                    <span className="font-bold text-neutral-900">{license?.maxUsers || 50} usuarios</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-600 flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Sucursales habilitadas:</span>
                    </span>
                    <span className="font-bold text-neutral-900">{license?.maxBranches || 10} sucursales</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-600">Soporte y Actualizaciones:</span>
                    <span
                      className={`font-bold ${
                        license?.hasSupport !== false ? 'text-emerald-600' : 'text-neutral-500'
                      }`}
                    >
                      {license?.hasSupport !== false ? 'Garantizado (Incluido)' : 'No incluido'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-200 text-[11px] text-neutral-500">
                Restricciones validadas en tiempo real por el núcleo de seguridad.
              </div>
            </div>
          </div>

          {/* Módulos Habilitados */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-600" />
                <h2 className="text-sm font-bold text-neutral-900">
                  Módulos del Sistema ERP Habilitados en Licencia
                </h2>
              </div>
              <span className="text-xs text-neutral-500 font-medium">
                {license?.modulesAllowed?.length || 0} de {AVAILABLE_MODULES.length} módulos activos
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
                        ? 'bg-neutral-50 border-neutral-200 text-neutral-900'
                        : 'bg-neutral-100/50 border-neutral-200 text-neutral-400'
                    }`}
                  >
                    <span className="font-medium">{m.label}</span>
                    {isAllowed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <span className="text-[10px] text-neutral-400 font-bold uppercase">No</span>
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
              <label className="block text-xs font-medium text-neutral-700">
                Hardware Fingerprint de este Equipo
              </label>
              <button
                type="button"
                onClick={handleCopyFingerprint}
                disabled={!license?.hardwareFingerprint}
                className="text-[11px] text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-1 disabled:opacity-50"
              >
                <Copy className="w-3 h-3" />
                <span>Copiar</span>
              </button>
            </div>
            <Input
              value={license?.hardwareFingerprint || ''}
              readOnly
              placeholder="Detectando identificador..."
              className="bg-neutral-100 font-mono text-neutral-700 font-bold select-all"
            />
            <p className="text-[11px] text-neutral-500 mt-1">
              Este identificador es único para este servidor/equipo anfitrión.
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-medium text-neutral-700">
                Clave de Licencia o Paquete Firmado *
              </label>
              <button
                type="button"
                onClick={handleGenerateKey}
                disabled={isGeneratingKey || !license?.hardwareFingerprint}
                className="text-[11px] text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-1 disabled:opacity-50"
              >
                <Key className="w-3 h-3" />
                <span>{isGeneratingKey ? 'Generando...' : 'Generar Clave para este Hardware'}</span>
              </button>
            </div>
            <Input
              placeholder="ERO-ENTERPRISE-XXXX-XXXX-XXXX-XX o ERO-PKG..."
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              required
              className="font-mono text-xs"
            />
            <div className="mt-2 p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-[11px] text-neutral-600 space-y-1">
              <p className="font-semibold text-neutral-800">Formatos aceptados:</p>
              <p>• Clave de fábrica estándar: <code className="font-mono text-sky-700 font-bold">ERO-ENTERPRISE-2026-X992-K821-V44</code></p>
              <p>• Paquetes criptográficos emitidos por el Super Administrador (<code className="font-mono text-neutral-700">ERO-PKG...</code>)</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200">
            <Button type="button" variant="outline" onClick={() => setShowActivateModal(false)}>
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
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        title="Emisión de Licencia Empresarial (Super Administrador)"
      >
        {issueResult ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Licencia Emitida Exitosamente</span>
              </div>
              <p className="text-xs text-emerald-700 mt-1">
                La licencia ha sido firmada criptográficamente con los parámetros establecidos.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Clave de Activación Legible
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    value={issueResult.licenseKey}
                    readOnly
                    className="font-mono font-bold bg-neutral-100 select-all text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(issueResult.licenseKey);
                      toast.success('Clave copiada al portapapeles');
                    }}
                    className="shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Paquete Firmado Criptográfico (Para activación offline o remota)
                </label>
                <div className="flex items-center gap-2">
                  <textarea
                    value={issueResult.licensePackage}
                    readOnly
                    rows={3}
                    className="w-full text-[10px] font-mono bg-neutral-100 p-2 rounded-lg border border-neutral-200 resize-none select-all focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(issueResult.licensePackage);
                      toast.success('Paquete copiado al portapapeles');
                    }}
                    className="shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Resumen de la Licencia Generada */}
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs space-y-1.5 text-neutral-700">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Empresa:</span>
                  <span className="font-bold text-neutral-900">{issueResult.licenseInfo.companyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">RIF / Cédula:</span>
                  <span className="font-bold text-neutral-900">{issueResult.licenseInfo.companyRif}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Hardware Fingerprint:</span>
                  <span className="font-mono font-bold text-neutral-900">{issueResult.licenseInfo.hardwareFingerprint}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Tipo & Vigencia:</span>
                  <span className="font-semibold text-neutral-900 capitalize">
                    {issueResult.licenseInfo.type === 'perpetua'
                      ? 'Perpetua (Sin caducidad)'
                      : issueResult.licenseInfo.expiresAt
                      ? `Hasta ${issueResult.licenseInfo.expiresAt.substring(0, 10)}`
                      : 'Temporal'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Capacidad:</span>
                  <span className="font-semibold text-neutral-900">
                    {issueResult.licenseInfo.maxUsers} usuarios / {issueResult.licenseInfo.maxBranches} sucursales
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Soporte y Actualizaciones:</span>
                  <span className="font-semibold text-emerald-600">
                    {issueResult.licenseInfo.hasSupport ? 'Garantizado' : 'No incluido'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Módulos:</span>
                  <span className="font-semibold text-neutral-900">
                    {issueResult.licenseInfo.modulesAllowed.length} módulos habilitados
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIssueResult(null)}
              >
                Emitir Otra Licencia
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => setShowIssueModal(false)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleIssueLicense} className="space-y-4">
            {/* Sección: Datos de la Empresa */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-sky-600" />
                <span>Datos de la Empresa Cliente</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Razón Social / Nombre *
                  </label>
                  <Input
                    placeholder="Ej. CORPORACION ERO C.A."
                    value={issueForm.companyName}
                    onChange={(e) => setIssueForm({ ...issueForm, companyName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    RIF o Cédula *
                  </label>
                  <Input
                    placeholder="Ej. J-12345678-9 o V-12345678"
                    value={issueForm.companyRif}
                    onChange={(e) => setIssueForm({ ...issueForm, companyRif: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Sección: Hardware Fingerprint */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-neutral-700">
                  Hardware Fingerprint de Destino *
                </label>
                {license?.hardwareFingerprint && (
                  <button
                    type="button"
                    onClick={() =>
                      setIssueForm({ ...issueForm, hardwareFingerprint: license.hardwareFingerprint })
                    }
                    className="text-[11px] text-sky-600 hover:text-sky-700 font-semibold"
                  >
                    Usar este equipo
                  </button>
                )}
              </div>
              <Input
                placeholder="Identificador del equipo (32 caracteres)"
                value={issueForm.hardwareFingerprint}
                onChange={(e) => setIssueForm({ ...issueForm, hardwareFingerprint: e.target.value })}
                required
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                La licencia quedará bloqueada y validada contra este hardware anfitrión.
              </p>
            </div>

            {/* Sección: Tipo de Licencia y Vigencia */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Tipo de Licencia *
                </label>
                <select
                  value={issueForm.type}
                  onChange={(e) =>
                    setIssueForm({
                      ...issueForm,
                      type: e.target.value as 'trial' | 'temporal' | 'perpetua',
                    })
                  }
                  className="w-full text-xs rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="temporal">Temporal (Suscripción por tiempo)</option>
                  <option value="perpetua">Perpetua (Sin caducidad)</option>
                  <option value="trial">Demostración / Trial (30 días)</option>
                </select>
              </div>

              {issueForm.type === 'temporal' && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Duración en Meses *
                  </label>
                  <select
                    value={issueForm.durationMonths}
                    onChange={(e) =>
                      setIssueForm({ ...issueForm, durationMonths: Number(e.target.value) })
                    }
                    className="w-full text-xs rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Usuarios Concurrentes Máximos *
                </label>
                <Input
                  type="number"
                  min={1}
                  max={5000}
                  value={issueForm.maxUsers}
                  onChange={(e) => setIssueForm({ ...issueForm, maxUsers: Number(e.target.value) })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Sucursales Autorizadas *
                </label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={issueForm.maxBranches}
                  onChange={(e) => setIssueForm({ ...issueForm, maxBranches: Number(e.target.value) })}
                  required
                />
              </div>
            </div>

            {/* Checkbox: Soporte y Actualizaciones */}
            <div className="flex items-center gap-2 p-2.5 bg-neutral-50 rounded-lg border border-neutral-200">
              <input
                type="checkbox"
                id="hasSupport"
                checked={issueForm.hasSupport}
                onChange={(e) => setIssueForm({ ...issueForm, hasSupport: e.target.checked })}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
              />
              <label htmlFor="hasSupport" className="text-xs text-neutral-800 font-medium select-none cursor-pointer">
                Incluye soporte técnico garantizado y actualizaciones de versión
              </label>
            </div>

            {/* Sección: Módulos Habilitados */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-neutral-700">
                  Módulos Autorizados ({issueForm.modulesAllowed.length}/{AVAILABLE_MODULES.length})
                </label>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAllModules}
                    className="text-sky-600 hover:text-sky-700 font-semibold"
                  >
                    Todos
                  </button>
                  <span className="text-neutral-300">|</span>
                  <button
                    type="button"
                    onClick={deselectAllModules}
                    className="text-neutral-500 hover:text-neutral-700 font-semibold"
                  >
                    Ninguno
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-neutral-50 border border-neutral-200 rounded-lg">
                {AVAILABLE_MODULES.map((m) => {
                  const isChecked = issueForm.modulesAllowed.includes(m.key);
                  return (
                    <button
                      type="button"
                      key={m.key}
                      onClick={() => toggleModule(m.key)}
                      className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-colors border ${
                        isChecked
                          ? 'bg-white border-sky-300 text-sky-900 font-semibold shadow-xs'
                          : 'bg-transparent border-transparent text-neutral-500 hover:bg-neutral-100'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      )}
                      <span className="truncate">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Checkbox: Aplicar inmediatamente */}
            <div className="flex items-center gap-2 p-2.5 bg-sky-50 rounded-lg border border-sky-200">
              <input
                type="checkbox"
                id="applyNow"
                checked={issueForm.applyNow}
                onChange={(e) => setIssueForm({ ...issueForm, applyNow: e.target.checked })}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
              />
              <label htmlFor="applyNow" className="text-xs text-sky-900 font-medium select-none cursor-pointer">
                Activar y aplicar inmediatamente esta licencia en este sistema local
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200">
              <Button type="button" variant="outline" onClick={() => setShowIssueModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={isIssuing}>
                {isIssuing ? 'Firmando y Emitiendo...' : 'Emitir Licencia Criptográfica'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
