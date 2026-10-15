import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
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
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { useAuthStore, isSuperAdminRole } from '../../stores/authStore';
import { useExchangeRateStore } from '../../stores/exchangeRateStore';
import {
  UpdateCompanyInput,
  BranchInput,
  WarehouseInput,
  UpdateBusinessRulesInput,
  formatExchangeRate,
  formatMoneyUSD,
  formatMoneyVES,
} from '@ero/shared';

export interface CashRegisterConfigItem {
  id: string;
  branchId: string;
  branchName?: string;
  code: string;
  name: string;
  fiscalPrinterSerial?: string | null;
  invoiceMode: 'fiscal_printer' | 'normal_printer';
  defaultBankAccountIdVES?: string | null;
  defaultBankAccountIdUSD?: string | null;
  isActive: boolean;
}

export const CompanyConfigView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'company' | 'branches' | 'registers' | 'rules'>('company');
  const [loading, setLoading] = useState(false);

  // Permisos y Tasa Oficial de Cambio
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canEditRate =
    isSuperAdminRole(user?.role) ||
    hasPermission('pricing', 'exchange_rate') ||
    hasPermission('pricing', 'bulk_update') ||
    hasPermission('config', 'write');

  const { rate, source, updatedBy, updatedAt, history, isHistoryLoading, updateRate, fetchRate, fetchHistory } = useExchangeRateStore();
  const [showRateModal, setShowRateModal] = useState(false);
  const [showRateHistoryModal, setShowRateHistoryModal] = useState(false);
  const [formRate, setFormRate] = useState(rate.toString());
  const [formSource, setFormSource] = useState(source);
  const [formNotes, setFormNotes] = useState('');
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
      toast.error('Ingrese una tasa de cambio válida mayor a 0');
      return;
    }
    setIsUpdatingRate(true);
    try {
      await updateRate(parsed, formSource, formNotes);
      toast.success(`Tasa oficial actualizada a Bs. ${formatExchangeRate(parsed, 4)} por USD`);
      setShowRateModal(false);
      setFormNotes('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar la tasa';
      toast.error(msg);
    } finally {
      setIsUpdatingRate(false);
    }
  };

  // Estados de datos
  const [company, setCompany] = useState<UpdateCompanyInput>({
    legalName: 'CORPORACION VENEZOLANA ERO C.A.',
    tradeName: 'ERO DISTRIBUCION',
    rif: 'J-12345678-9',
    fiscalAddress: 'Av. Francisco de Miranda, Torre Cavendes, Piso 8, Chacao, Caracas, Venezuela',
    phone: '+58 212 555-0199',
    email: 'administracion@erove.com',
    isSpecialTaxpayer: true,
    ivaRetentionRate: 75.0,
    currencyBase: 'USD',
    currencySecondary: 'VES',
  });

  const [branches, setBranches] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [rules, setRules] = useState<UpdateBusinessRulesInput>({
    allowCreditSales: true,
    requireApprovalDiscount: true,
    maxDiscountAllowed: 10.0,
    posInvoiceMode: 'normal_printer',
    taxAffectsFinalPrice: true,
    enforceCreditLimit: true,
    retentionPeriodYears: 5,
  });

  // Modales
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);

  // Cajas registradoras (POS)
  const [registers, setRegisters] = useState<CashRegisterConfigItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editingRegisterId, setEditingRegisterId] = useState<string | null>(null);
  const [registerForm, setRegisterForm] = useState({
    branchId: '',
    code: '',
    name: '',
    isFiscal: false,
    fiscalPrinterSerial: '',
    defaultBankAccountIdVES: '',
    defaultBankAccountIdUSD: '',
    isActive: true,
  });
  const [isSavingRegister, setIsSavingRegister] = useState(false);

  // Formularios de modales
  const [branchForm, setBranchForm] = useState<BranchInput>({
    code: '',
    name: '',
    address: '',
    phone: '',
    isMain: false,
    isActive: true,
  });

  const [warehouseForm, setWarehouseForm] = useState<WarehouseInput>({
    branchId: '',
    code: '',
    name: '',
    isDefault: false,
    isActive: true,
  });

  const fetchConfigData = async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const [compRes, branchRes, whRes, rulesRes, regRes] = await Promise.all([
        fetch('/api/config/company', { headers }),
        fetch('/api/config/branches', { headers }),
        fetch('/api/config/warehouses', { headers }),
        fetch('/api/config/business-rules', { headers }),
        fetch('/api/pos/registers', { headers }),
      ]);

      if (compRes.ok) {
        const d = await compRes.json();
        if (d.success && d.data) setCompany(d.data);
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
        if (d.success && d.data) setWarehouses(d.data);
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
        const bankRes = await fetch('/api/treasury/accounts', { headers });
        if (bankRes.ok) {
          const d = await bankRes.json();
          if (d.success && Array.isArray(d.data)) setBankAccounts(d.data);
        }
      } catch {
        // Ignorar si tesorería no responde
      }
    } catch {
      toast.error('Error al sincronizar configuración con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateRegister = () => {
    setEditingRegisterId(null);
    setRegisterForm({
      branchId: branches[0]?.id || '',
      code: '',
      name: '',
      isFiscal: false,
      fiscalPrinterSerial: '',
      defaultBankAccountIdVES: '',
      defaultBankAccountIdUSD: '',
      isActive: true,
    });
    setShowRegisterModal(true);
  };

  const handleOpenEditRegister = (reg: CashRegisterConfigItem) => {
    setEditingRegisterId(reg.id);
    setRegisterForm({
      branchId: reg.branchId,
      code: reg.code,
      name: reg.name,
      isFiscal: reg.invoiceMode === 'fiscal_printer',
      fiscalPrinterSerial: reg.fiscalPrinterSerial || '',
      defaultBankAccountIdVES: reg.defaultBankAccountIdVES || '',
      defaultBankAccountIdUSD: reg.defaultBankAccountIdUSD || '',
      isActive: reg.isActive,
    });
    setShowRegisterModal(true);
  };

  const handleSaveRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.branchId || !registerForm.code.trim() || !registerForm.name.trim()) {
      toast.error('Sucursal, código y nombre de caja son obligatorios');
      return;
    }
    if (registerForm.isFiscal && !registerForm.fiscalPrinterSerial.trim()) {
      toast.error('El serial de la impresora fiscal es obligatorio si la caja es fiscal');
      return;
    }

    setIsSavingRegister(true);
    try {
      const payload = {
        branchId: registerForm.branchId,
        code: registerForm.code.trim().toUpperCase(),
        name: registerForm.name.trim(),
        invoiceMode: registerForm.isFiscal ? 'fiscal_printer' : 'normal_printer',
        fiscalPrinterSerial: registerForm.isFiscal ? registerForm.fiscalPrinterSerial.trim().toUpperCase() : null,
        defaultBankAccountIdVES: registerForm.defaultBankAccountIdVES || null,
        defaultBankAccountIdUSD: registerForm.defaultBankAccountIdUSD || null,
        isActive: registerForm.isActive,
      };

      const url = editingRegisterId ? `/api/pos/registers/${editingRegisterId}` : '/api/pos/registers';
      const method = editingRegisterId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Error al guardar caja registradora');
      }

      toast.success(editingRegisterId ? 'Caja registradora actualizada' : 'Caja registradora creada con éxito');
      setShowRegisterModal(false);
      fetchConfigData();
    } catch (err: any) {
      toast.error(err.message || 'Error de red al guardar caja');
    } finally {
      setIsSavingRegister(false);
    }
  };

  const handleToggleRegisterActive = async (reg: CashRegisterConfigItem) => {
    try {
      const res = await fetch(`/api/pos/registers/${reg.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ isActive: !reg.isActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Error al cambiar estado de la caja');
      }
      toast.success(`Caja ${reg.code} ${!reg.isActive ? 'activada' : 'desactivada'} exitosamente`);
      fetchConfigData();
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar estado de la caja');
    }
  };

  useEffect(() => {
    fetchConfigData();
  }, []);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/config/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(company),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Perfil fiscal y datos de empresa actualizados');
      } else {
        toast.error(data.error?.message || 'Error al guardar empresa');
      }
    } catch {
      toast.error('Error de red al actualizar perfil de empresa');
    }
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/config/business-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rules),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Reglas de negocio empresariales actualizadas');
      } else {
        toast.error(data.error?.message || 'Error al guardar reglas');
      }
    } catch {
      toast.error('Error de red al actualizar reglas de negocio');
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.code || !branchForm.name) {
      toast.error('Código y nombre de sucursal obligatorios');
      return;
    }
    try {
      const res = await fetch('/api/config/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branchForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Sucursal ${branchForm.code} creada con éxito`);
        setShowBranchModal(false);
        setBranchForm({ code: '', name: '', address: '', phone: '', isMain: false, isActive: true });
        fetchConfigData();
      } else {
        toast.error(data.error?.message || 'Error al crear sucursal');
      }
    } catch {
      toast.error('Error de red al crear sucursal');
    }
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseForm.code || !warehouseForm.name || !warehouseForm.branchId) {
      toast.error('Sucursal, código y nombre de depósito son obligatorios');
      return;
    }
    try {
      const res = await fetch('/api/config/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(warehouseForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Depósito ${warehouseForm.code} creado con éxito`);
        setShowWarehouseModal(false);
        setWarehouseForm((prev) => ({ ...prev, code: '', name: '', isDefault: false }));
        fetchConfigData();
      } else {
        toast.error(data.error?.message || 'Error al crear depósito');
      }
    } catch {
      toast.error('Error de red al crear depósito');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
            Configuración Empresarial & Operativa
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Gestión de perfil fiscal SENIAT, sucursales, almacenes y reglas de control comercial
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-neutral-100 p-1 rounded-lg border border-neutral-200">
          <button
            onClick={() => setActiveTab('company')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'company'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Perfil Empresa</span>
          </button>

          <button
            onClick={() => setActiveTab('branches')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'branches'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>Sucursales & Almacenes</span>
          </button>

          <button
            onClick={() => setActiveTab('registers')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'registers'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Cajas / POS</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'rules'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Reglas de Negocio</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-32 bg-neutral-200 animate-pulse rounded-lg" />
          <div className="h-64 bg-neutral-200 animate-pulse rounded-lg" />
        </div>
      ) : activeTab === 'company' ? (
        /* TAB 1: PERFIL EMPRESA */
        <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
          <form onSubmit={handleSaveCompany} className="space-y-6">
            <div className="border-b border-neutral-200 pb-4">
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sky-600" />
                Identificación Fiscal & SENIAT
              </h2>
              <p className="text-xs text-neutral-500 mt-1">
                Datos emitidos en facturación, libros tributarios y comprobantes de retención
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Razón Social *
                </label>
                <Input
                  value={company.legalName}
                  onChange={(e) => setCompany({ ...company, legalName: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Nombre Comercial
                </label>
                <Input
                  value={company.tradeName || ''}
                  onChange={(e) => setCompany({ ...company, tradeName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  RIF (Registro de Información Fiscal) *
                </label>
                <Input
                  value={company.rif}
                  onChange={(e) => setCompany({ ...company, rif: e.target.value.toUpperCase() })}
                  placeholder="J-12345678-9"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Dirección Fiscal Legal *
                </label>
                <Input
                  value={company.fiscalAddress}
                  onChange={(e) => setCompany({ ...company, fiscalAddress: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Teléfono Principal
                </label>
                <Input
                  value={company.phone || ''}
                  onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Correo Electrónico
                </label>
                <Input
                  type="email"
                  value={company.email || ''}
                  onChange={(e) => setCompany({ ...company, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Moneda Base de Registro
                </label>
                <select
                  value={company.currencyBase}
                  onChange={(e) => setCompany({ ...company, currencyBase: e.target.value as 'USD' | 'VES' })}
                  className="w-full h-9 rounded-lg border border-neutral-300 bg-white px-3 text-xs text-neutral-900 focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <option value="USD">USD - Dólares Americanos</option>
                  <option value="VES">VES - Bolívares Digitales</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Moneda Secundaria de Referencia
                </label>
                <select
                  value={company.currencySecondary}
                  onChange={(e) => setCompany({ ...company, currencySecondary: e.target.value as 'USD' | 'VES' })}
                  className="w-full h-9 rounded-lg border border-neutral-300 bg-white px-3 text-xs text-neutral-900 focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <option value="VES">VES - Bolívares Digitales</option>
                  <option value="USD">USD - Dólares Americanos</option>
                </select>
              </div>
            </div>

            {/* Tasa Oficial de Cambio (BCV) */}
            <div className="bg-sky-50/60 p-4 rounded-lg border border-sky-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-sky-100 rounded-lg text-sky-700 mt-0.5">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      Tasa de Cambio Oficial (BCV)
                    </h3>
                    <Badge variant="info">Sincronización Centralizada</Badge>
                  </div>
                  <p className="text-xs text-neutral-600 mt-1">
                    Valor actual del dólar estadounidense aplicado para presupuestos, facturación y POS:
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="font-mono text-base font-extrabold text-neutral-900">
                      Bs. {formatExchangeRate(rate, 4)} <span className="text-xs font-normal text-neutral-500">/ USD</span>
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Fuente: {source}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-1">
                    Última actualización: {new Date(updatedAt).toLocaleString()} por {updatedBy}
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
                  className="flex items-center gap-1.5 bg-white shadow-xs"
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
                    className="flex items-center gap-1.5 bg-white shadow-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Actualizar Tasa</span>
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 text-neutral-500 rounded-lg border border-neutral-200 text-xs">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Solo lectura (No autorizado)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Configuración SENIAT */}
            <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200 space-y-4">
              <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
                Régimen Impositivo SENIAT
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isSpecialTaxpayer"
                    checked={company.isSpecialTaxpayer}
                    onChange={(e) => setCompany({ ...company, isSpecialTaxpayer: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300"
                  />
                  <label htmlFor="isSpecialTaxpayer" className="text-xs text-neutral-700 cursor-pointer">
                    <span className="font-semibold block">Contribuyente Especial SENIAT</span>
                    <span className="text-neutral-500">Agente de retención de IVA e ISLR calificado</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Porcentaje de Retención de IVA por Defecto
                  </label>
                  <select
                    value={company.ivaRetentionRate}
                    onChange={(e) => setCompany({ ...company, ivaRetentionRate: Number(e.target.value) })}
                    className="w-full h-9 rounded-lg border border-neutral-300 bg-white px-3 text-xs text-neutral-900 focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <option value={75}>75% (General Contribuyentes Especiales)</option>
                    <option value={100}>100% (Casos especiales / Sin RIF en comprobante)</option>
                    <option value={0}>0% (No aplica retención)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="primary" className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </Button>
            </div>
          </form>
        </div>
      ) : activeTab === 'branches' ? (
        /* TAB 2: SUCURSALES & ALMACENES */
        <div className="space-y-6">
          {/* Sucursales */}
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-sky-600" />
                  Sucursales Habilitadas
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Establecimientos comerciales y centros de operación multi-sucursal
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => setShowBranchModal(true)}
                className="flex items-center gap-2 text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Sucursal</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((b) => (
                <div key={b.id} className="border border-neutral-200 rounded-lg p-4 bg-neutral-50/50">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[11px] font-mono font-bold text-sky-600">{b.code}</span>
                      <h3 className="text-xs font-bold text-neutral-900 mt-0.5">{b.name}</h3>
                    </div>
                    {b.isMain && <Badge variant="info">Sede Principal</Badge>}
                  </div>
                  <p className="text-xs text-neutral-500 mt-2 line-clamp-2">{b.address || 'Sin dirección fiscal registrada'}</p>
                  <div className="mt-3 pt-3 border-t border-neutral-200 flex justify-between items-center text-[11px] text-neutral-600">
                    <span>{b.phone || 'Sin teléfono'}</span>
                    <span className="font-semibold text-neutral-700">{b.warehousesCount || 0} Almacenes</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Almacenes */}
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-sky-600" />
                  Depósitos & Almacenes Físicos
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Ubicaciones de control de existencias, piso de venta y traslados
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => setShowWarehouseModal(true)}
                className="flex items-center gap-2 text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Depósito</span>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                  <tr>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Nombre del Depósito</th>
                    <th className="py-2.5 px-3">Sucursal Asignada</th>
                    <th className="py-2.5 px-3">Condición</th>
                    <th className="py-2.5 px-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {warehouses.map((w) => (
                    <tr key={w.id} className="hover:bg-neutral-50">
                      <td className="py-2 px-3 font-mono font-bold text-neutral-900">{w.code}</td>
                      <td className="py-2 px-3 text-neutral-900 font-medium">{w.name}</td>
                      <td className="py-2 px-3 text-neutral-600">{w.branchName || w.branchCode}</td>
                      <td className="py-2 px-3">
                        {w.isDefault ? (
                          <Badge variant="success">Predeterminado</Badge>
                        ) : (
                          <span className="text-neutral-400">Secundario</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={w.isActive ? 'neutral' : 'danger'}>
                          {w.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'registers' ? (
        /* TAB 3: CAJAS / PUNTOS DE VENTA */
        <div className="space-y-6">
          <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-neutral-200">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-sky-600" />
                  Cajas Registradoras y Puntos de Venta (POS)
                </h2>
                <p className="text-xs text-neutral-500 mt-1">
                  Configure cada caja registradora, estableciendo si cuenta con impresora fiscal homologada conectada (SENIAT) o si opera en modalidad no fiscal con ticket de entrega.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={handleOpenCreateRegister}
                className="flex items-center gap-2 text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Caja Registradora</span>
              </Button>
            </div>

            {registers.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 flex flex-col items-center">
                <CreditCard className="w-10 h-10 mb-2 stroke-1 text-neutral-300" />
                <p className="text-sm font-semibold text-neutral-700">No hay cajas registradoras configuradas</p>
                <p className="text-xs text-neutral-400 mt-1 max-w-sm">
                  Cree una caja para habilitar el cobro en el Punto de Venta y defina si posee impresora fiscal conectada.
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
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                    <tr>
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Nombre de la Caja</th>
                      <th className="py-2.5 px-3">Sucursal Asignada</th>
                      <th className="py-2.5 px-3">Impresora Fiscal / Modalidad</th>
                      <th className="py-2.5 px-3">Cuentas Bancarias Predeterminadas</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {registers.map((r) => {
                      const isFiscal = r.invoiceMode === 'fiscal_printer';
                      const accVES = bankAccounts.find((a) => a.id === r.defaultBankAccountIdVES);
                      const accUSD = bankAccounts.find((a) => a.id === r.defaultBankAccountIdUSD);
                      return (
                        <tr key={r.id} className="hover:bg-neutral-50">
                          <td className="py-2.5 px-3 font-mono font-bold text-neutral-900">{r.code}</td>
                          <td className="py-2.5 px-3 text-neutral-900 font-medium">{r.name}</td>
                          <td className="py-2.5 px-3 text-neutral-600">{r.branchName || 'Sucursal Principal'}</td>
                          <td className="py-2.5 px-3">
                            {isFiscal ? (
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="success" className="font-mono text-[10px] w-fit flex items-center gap-1">
                                  <Printer className="w-3 h-3" />
                                  Fiscal: {r.fiscalPrinterSerial || 'Conectada'}
                                </Badge>
                                <span className="text-[10px] text-neutral-400">
                                  Factura Fiscal Homologada SENIAT
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="neutral" className="text-[10px] w-fit flex items-center gap-1">
                                  <Printer className="w-3 h-3" />
                                  No Fiscal
                                </Badge>
                                <span className="text-[10px] text-neutral-400">
                                  Pregunta impresión de ticket de venta
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-col gap-1 text-[11px]">
                              <span className="text-neutral-700">
                                <strong className="font-semibold text-neutral-500">VES:</strong>{' '}
                                {accVES ? `${accVES.bankName} (${accVES.accountNumber.slice(-4)})` : <span className="text-neutral-400 italic">No configurada</span>}
                              </span>
                              <span className="text-neutral-700">
                                <strong className="font-semibold text-neutral-500">USD:</strong>{' '}
                                {accUSD ? `${accUSD.bankName} (${accUSD.accountNumber.slice(-4)})` : <span className="text-neutral-400 italic">No configurada</span>}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant={r.isActive ? 'neutral' : 'danger'}>
                              {r.isActive ? 'Activa' : 'Inactiva'}
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
                                title={r.isActive ? 'Desactivar caja' : 'Activar caja'}
                                className={`h-7 px-2 text-xs ${r.isActive ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}
                              >
                                {r.isActive ? 'Desactivar' : 'Activar'}
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
      ) : (
        /* TAB 4: REGLAS DE NEGOCIO */
        <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
          <form onSubmit={handleSaveRules} className="space-y-6">
            <div className="border-b border-neutral-200 pb-4">
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-sky-600" />
                Políticas de Control Comercial y Facturación
              </h2>
              <p className="text-xs text-neutral-500 mt-1">
                Restricciones de crédito, autorizaciones de descuento y modo de impresión fiscal
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ventas a Crédito */}
              <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="allowCreditSales"
                    checked={rules.allowCreditSales}
                    onChange={(e) => setRules({ ...rules, allowCreditSales: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 mt-0.5"
                  />
                  <label htmlFor="allowCreditSales" className="text-xs cursor-pointer">
                    <span className="font-bold text-neutral-900 block">Habilitar Facturación a Crédito</span>
                    <span className="text-neutral-500">
                      Permite generar facturas comerciales con fecha de vencimiento y registro en cuentas por cobrar
                    </span>
                  </label>
                </div>

                <div className="flex items-start gap-3 pt-2 border-t border-neutral-200">
                  <input
                    type="checkbox"
                    id="enforceCreditLimit"
                    checked={rules.enforceCreditLimit}
                    onChange={(e) => setRules({ ...rules, enforceCreditLimit: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 mt-0.5"
                  />
                  <label htmlFor="enforceCreditLimit" className="text-xs cursor-pointer">
                    <span className="font-bold text-neutral-900 block">Validación Estricta de Límite de Crédito</span>
                    <span className="text-neutral-500">
                      Bloquea automáticamente la venta si la deuda acumulada del cliente excede su límite
                    </span>
                  </label>
                </div>
              </div>

              {/* Descuentos & Aprobaciones */}
              <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="requireApprovalDiscount"
                    checked={rules.requireApprovalDiscount}
                    onChange={(e) => setRules({ ...rules, requireApprovalDiscount: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 mt-0.5"
                  />
                  <label htmlFor="requireApprovalDiscount" className="text-xs cursor-pointer">
                    <span className="font-bold text-neutral-900 block">Exigir Aprobación de Descuento</span>
                    <span className="text-neutral-500">
                      Requiere confirmación de supervisor cuando el descuento comercial sobrepase el límite máximo
                    </span>
                  </label>
                </div>

                <div className="pt-2 border-t border-neutral-200">
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Descuento Máximo Permitido sin Aprobación (%)
                  </label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={rules.maxDiscountAllowed}
                    onChange={(e) => setRules({ ...rules, maxDiscountAllowed: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Modo de Facturación POS */}
              <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
                <h3 className="text-xs font-bold text-neutral-900">Modo de Facturación de Caja / POS</h3>
                <p className="text-xs text-neutral-500">
                  Mecanismo de expedición de tickets y facturas en los puntos de venta
                </p>

                <select
                  value={rules.posInvoiceMode}
                  onChange={(e) => setRules({ ...rules, posInvoiceMode: e.target.value as any })}
                  className="w-full h-9 rounded-lg border border-neutral-300 bg-white px-3 text-xs text-neutral-900 focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <option value="normal_printer">Impresora Estándar / Formato Digital PDF</option>
                  <option value="fiscal_printer">Impresora Fiscal Homologada SENIAT</option>
                  <option value="electronic">Facturación Electrónica en Línea</option>
                </select>
              </div>

              {/* Auditoría y Retención */}
              <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
                <h3 className="text-xs font-bold text-neutral-900">Período de Retención Fiscal de Auditoría</h3>
                <p className="text-xs text-neutral-500">
                  Lapso legal de conservación inmutable de bitácoras de auditoría y libros SENIAT
                </p>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="5"
                    max="15"
                    value={rules.retentionPeriodYears}
                    onChange={(e) => setRules({ ...rules, retentionPeriodYears: Number(e.target.value) })}
                    className="w-24"
                  />
                  <span className="text-xs text-neutral-600 font-medium">Años (Mínimo legal: 5 años)</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="primary" className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                <span>Guardar Reglas de Negocio</span>
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Nueva Sucursal */}
      <Modal
        isOpen={showBranchModal}
        onClose={() => setShowBranchModal(false)}
        title="Registrar Nueva Sucursal"
      >
        <form onSubmit={handleCreateBranch} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Código *</label>
              <Input
                placeholder="SUC-03"
                value={branchForm.code}
                onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Nombre *</label>
              <Input
                placeholder="Sucursal Valencia"
                value={branchForm.name}
                onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Dirección Fiscal</label>
            <Input
              placeholder="Zona Industrial El Recreo, Valencia"
              value={branchForm.address || ''}
              onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Teléfono</label>
            <Input
              placeholder="+58 241 888-0011"
              value={branchForm.phone || ''}
              onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="branchIsMain"
              checked={branchForm.isMain}
              onChange={(e) => setBranchForm({ ...branchForm, isMain: e.target.checked })}
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300"
            />
            <label htmlFor="branchIsMain" className="text-xs text-neutral-700 cursor-pointer">
              Definir como Sede Principal
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200">
            <Button type="button" variant="outline" onClick={() => setShowBranchModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Guardar Sucursal
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Nuevo Almacén */}
      <Modal
        isOpen={showWarehouseModal}
        onClose={() => setShowWarehouseModal(false)}
        title="Registrar Nuevo Almacén / Depósito"
      >
        <form onSubmit={handleCreateWarehouse} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Sucursal Asignada *</label>
            <select
              value={warehouseForm.branchId}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, branchId: e.target.value })}
              className="w-full h-9 rounded-lg border border-neutral-300 bg-white px-3 text-xs text-neutral-900 focus-visible:ring-2 focus-visible:ring-sky-500"
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
              <label className="block text-xs font-medium text-neutral-700 mb-1">Código Depósito *</label>
              <Input
                placeholder="ALM-02"
                value={warehouseForm.code}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value.toUpperCase() })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Nombre Depósito *</label>
              <Input
                placeholder="Almacén de Refrigerados"
                value={warehouseForm.name}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="warehouseIsDefault"
              checked={warehouseForm.isDefault}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, isDefault: e.target.checked })}
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300"
            />
            <label htmlFor="warehouseIsDefault" className="text-xs text-neutral-700 cursor-pointer">
              Establecer como almacén predeterminado para ventas y compras
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200">
            <Button type="button" variant="outline" onClick={() => setShowWarehouseModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Guardar Depósito
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
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              Esta tasa se guardará en base de datos MySQL con fecha efectiva e historial de auditoría, aplicándose de manera global a todos los módulos.
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
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
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Fuente o Referencia Oficial
              </label>
              <Input
                value={formSource}
                onChange={(e) => setFormSource(e.target.value)}
                placeholder="Banco Central de Venezuela (BCV)"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
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
                {isUpdatingRate ? 'Guardando...' : 'Aplicar Tasa Oficial'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal para ver historial de tasas oficiales en base de datos */}
      {showRateHistoryModal && (
        <Modal
          isOpen={showRateHistoryModal}
          onClose={() => setShowRateHistoryModal(false)}
          title="Historial de Tasas de Cambio Oficiales en Base de Datos"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>{history.length} registros guardados en MySQL</span>
              <button
                type="button"
                onClick={() => fetchHistory()}
                className="text-sky-600 hover:text-sky-800 font-medium cursor-pointer"
              >
                Refrescar historial
              </button>
            </div>

            {isHistoryLoading ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                Cargando historial de base de datos...
              </div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 rounded-lg">
                No se encontraron registros de tasas de cambio en base de datos.
              </div>
            ) : (
              <div className="overflow-x-auto border border-neutral-200 rounded-lg max-h-72">
                <table className="w-full text-xs text-left">
                  <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200 text-[10px] uppercase font-semibold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Fecha Efectiva</th>
                      <th className="py-2.5 px-3 text-right">Tasa Oficial (Bs.)</th>
                      <th className="py-2.5 px-3">Fuente</th>
                      <th className="py-2.5 px-3">Registrado Por</th>
                      <th className="py-2.5 px-3">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {history.map((h, i) => (
                      <tr key={h.id || i} className="hover:bg-neutral-50/60">
                        <td className="py-2 px-3 font-mono text-neutral-700 font-medium">
                          {h.effectiveDate}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-neutral-900">
                          Bs. {formatExchangeRate(h.rate, 4)}
                        </td>
                        <td className="py-2 px-3 text-neutral-600 truncate max-w-[140px]">
                          {h.source}
                        </td>
                        <td className="py-2 px-3 text-neutral-500 truncate max-w-[120px]">
                          {h.updatedBy}
                        </td>
                        <td className="py-2 px-3 text-neutral-400 text-[11px] truncate max-w-[140px]">
                          {h.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-neutral-100">
              <Button type="button" variant="outline" onClick={() => setShowRateHistoryModal(false)}>
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
          title={editingRegisterId ? 'Editar Caja Registradora' : 'Registrar Nueva Caja Registradora'}
        >
          <form onSubmit={handleSaveRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Sucursal Asignada *
              </label>
              <select
                value={registerForm.branchId}
                onChange={(e) => setRegisterForm({ ...registerForm, branchId: e.target.value })}
                className="w-full h-9 rounded-lg border border-neutral-300 bg-white px-3 text-xs text-neutral-900 focus-visible:ring-2 focus-visible:ring-sky-500"
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
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Código de Caja *
                </label>
                <Input
                  placeholder="CAJA-01"
                  value={registerForm.code}
                  onChange={(e) => setRegisterForm({ ...registerForm, code: e.target.value.toUpperCase() })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Nombre / Descripción *
                </label>
                <Input
                  placeholder="Caja Principal Mostrador"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Configuración de Impresora Fiscal */}
            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
              <label className="block text-xs font-bold text-neutral-900">
                ¿Tiene impresora fiscal conectada?
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  className={`p-3 rounded-lg border cursor-pointer flex flex-col gap-1 transition-colors ${
                    registerForm.isFiscal
                      ? 'border-sky-500 bg-sky-50/40 text-neutral-900 ring-1 ring-sky-500'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Printer className="w-3.5 h-3.5 text-emerald-600" />
                      Sí, Impresora Fiscal
                    </span>
                    <input
                      type="radio"
                      name="isFiscalRadio"
                      checked={registerForm.isFiscal}
                      onChange={() => setRegisterForm({ ...registerForm, isFiscal: true })}
                      className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                    />
                  </div>
                  <span className="text-[11px] text-neutral-500">
                    Modo Fiscal SENIAT con serial y emisión de libro tributario
                  </span>
                </label>

                <label
                  className={`p-3 rounded-lg border cursor-pointer flex flex-col gap-1 transition-colors ${
                    !registerForm.isFiscal
                      ? 'border-sky-500 bg-sky-50/40 text-neutral-900 ring-1 ring-sky-500'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-neutral-600" />
                      No, Sin Impresora Fiscal
                    </span>
                    <input
                      type="radio"
                      name="isFiscalRadio"
                      checked={!registerForm.isFiscal}
                      onChange={() => setRegisterForm({ ...registerForm, isFiscal: false })}
                      className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                    />
                  </div>
                  <span className="text-[11px] text-neutral-500">
                    Modo No Fiscal: preguntará si desea imprimir ticket al cobrar
                  </span>
                </label>
              </div>

              {registerForm.isFiscal && (
                <div className="pt-2 border-t border-neutral-200">
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Serial de la Impresora Fiscal SENIAT *
                  </label>
                  <Input
                    placeholder="ej: Z1B89201928 / Z5A8812341"
                    value={registerForm.fiscalPrinterSerial}
                    onChange={(e) => setRegisterForm({ ...registerForm, fiscalPrinterSerial: e.target.value.toUpperCase() })}
                    required={registerForm.isFiscal}
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Ingrese el número de serie troquelado en la máquina fiscal homologada ante el SENIAT.
                  </p>
                </div>
              )}

              {!registerForm.isFiscal && (
                <div className="pt-2 border-t border-neutral-200">
                  <p className="text-[11px] text-neutral-600 bg-sky-50/50 p-2 rounded-lg border border-sky-100">
                    <strong>Comportamiento del POS:</strong> Al finalizar cada venta en esta caja, la pantalla preguntará al cajero si desea imprimir un ticket de venta para el cliente o continuar directamente con la siguiente transacción.
                  </p>
                </div>
              )}
            </div>

            {/* Cuentas Bancarias Predeterminadas para el Cierre de Caja */}
            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
              <label className="block text-xs font-bold text-neutral-900">
                Cuentas Bancarias de Tesorería Predeterminadas para Depósito
              </label>
              <p className="text-[11px] text-neutral-500">
                Estas cuentas se preseleccionarán automáticamente al realizar el arqueo y cierre de turno en esta caja.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 mb-1">
                    Cuenta Predeterminada VES (Bolívares)
                  </label>
                  <select
                    value={registerForm.defaultBankAccountIdVES}
                    onChange={(e) => setRegisterForm({ ...registerForm, defaultBankAccountIdVES: e.target.value })}
                    className="w-full h-9 rounded-lg border border-neutral-300 bg-white px-3 text-xs text-neutral-900 focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <option value="">-- Sin cuenta predeterminada VES --</option>
                    {bankAccounts
                      .filter((a) => a.currency === 'VES')
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.bankName} - {a.accountNumber.slice(-4)} (Saldo: {formatMoneyVES(a.currentBalance)})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 mb-1">
                    Cuenta Predeterminada USD (Divisas Custodia)
                  </label>
                  <select
                    value={registerForm.defaultBankAccountIdUSD}
                    onChange={(e) => setRegisterForm({ ...registerForm, defaultBankAccountIdUSD: e.target.value })}
                    className="w-full h-9 rounded-lg border border-neutral-300 bg-white px-3 text-xs text-neutral-900 focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <option value="">-- Sin cuenta predeterminada USD --</option>
                    {bankAccounts
                      .filter((a) => a.currency === 'USD')
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.bankName} - {a.accountNumber.slice(-4)} (Saldo: {formatMoneyUSD(a.currentBalance)})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="registerIsActive"
                checked={registerForm.isActive}
                onChange={(e) => setRegisterForm({ ...registerForm, isActive: e.target.checked })}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300"
              />
              <label htmlFor="registerIsActive" className="text-xs text-neutral-700 cursor-pointer">
                Caja registradora habilitada para turnos y ventas
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200">
              <Button type="button" variant="outline" onClick={() => setShowRegisterModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={isSavingRegister}>
                {isSavingRegister ? 'Guardando...' : editingRegisterId ? 'Actualizar Caja' : 'Crear Caja Registradora'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
