import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Search,
  Filter,
  RefreshCw,
  SlidersHorizontal,
  DollarSign,
  Percent,
  CheckCircle2,
  AlertCircle,
  Building2,
  ArrowUpDown,
  Smartphone,
  Wallet,
  Coins,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore, isSuperAdminRole } from '../../stores/authStore';
import { PaymentMethod, PaymentMethodInput } from '@ero/shared';

interface PaymentMethodsConfigViewProps {
  embedded?: boolean;
}

export const PaymentMethodsConfigView: React.FC<PaymentMethodsConfigViewProps> = ({
  embedded = false,
}) => {
  const { token, user, hasPermission } = useAuthStore();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'VES' | 'USD'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Debounce búsqueda (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Modal de Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCurrency, setFormCurrency] = useState<'USD' | 'VES'>('VES');
  const [formType, setFormType] = useState<'CASH' | 'CARD' | 'ELECTRONIC' | 'CREDIT' | 'OTHER'>('CARD');
  const [formAppliesIGTF, setFormAppliesIGTF] = useState(false);
  const [formRequiresReference, setFormRequiresReference] = useState(true);
  const [formRequiresBankAccount, setFormRequiresBankAccount] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(0);
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({});

  const canWrite =
    isSuperAdminRole(user?.role) ||
    hasPermission('config', 'write') ||
    hasPermission('config', 'update') ||
    hasPermission('config', 'create');

  const fetchMethods = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      // Consultamos tanto /api/config/payment-methods como fallback /api/pos/payment-methods?all=true
      let res = await fetch('/api/config/payment-methods?all=true', { headers });
      if (!res.ok) {
        res = await fetch('/api/pos/payment-methods?all=true', { headers });
      }

      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setMethods(json.data);
        }
      } else {
        toast.error('No se pudo cargar la configuración de medios de pago');
      }
    } catch {
      toast.error('Error de red al consultar medios de pago');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchMethods();
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormCode('');
    setFormName('');
    setFormCurrency('VES');
    setFormType('CARD');
    setFormAppliesIGTF(false);
    setFormRequiresReference(true);
    setFormRequiresBankAccount(false);
    setFormIsActive(true);
    setFormDisplayOrder(methods.length + 1);
    setErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: PaymentMethod) => {
    setEditingId(m.id || null);
    setFormCode(m.code);
    setFormName(m.name);
    setFormCurrency(m.currency);
    setFormType(m.type);
    setFormAppliesIGTF(Boolean(m.appliesIGTF));
    setFormRequiresReference(Boolean(m.requiresReference));
    setFormRequiresBankAccount(Boolean(m.requiresBankAccount));
    setFormIsActive(Boolean(m.isActive));
    setFormDisplayOrder(m.displayOrder ?? 0);
    setErrors({});
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errs: { code?: string; name?: string } = {};
    if (!formCode.trim()) {
      errs.code = 'El código interno es obligatorio';
    } else if (!/^[A-Z0-9_]+$/.test(formCode.trim().toUpperCase())) {
      errs.code = 'Solo se permiten letras mayúsculas, números y guiones bajos (_)';
    }

    if (!formName.trim()) {
      errs.name = 'El nombre descriptivo es obligatorio';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const payload: PaymentMethodInput = {
        code: formCode.trim().toUpperCase().replace(/\s+/g, '_'),
        name: formName.trim(),
        currency: formCurrency,
        type: formType,
        appliesIGTF: formAppliesIGTF,
        requiresReference: formRequiresReference,
        requiresBankAccount: formRequiresBankAccount,
        isActive: formIsActive,
        displayOrder: Number(formDisplayOrder) || 0,
      };

      let res: Response;
      if (editingId) {
        res = await fetch(`/api/config/payment-methods/${editingId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          res = await fetch(`/api/pos/payment-methods/${editingId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(payload),
          });
        }
      } else {
        res = await fetch('/api/config/payment-methods', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          res = await fetch('/api/pos/payment-methods', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          });
        }
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al guardar el medio de pago');
      }

      toast.success(
        editingId
          ? 'Medio de pago actualizado correctamente'
          : 'Medio de pago registrado exitosamente'
      );
      setIsModalOpen(false);
      fetchMethods();
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar la solicitud');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (m: PaymentMethod) => {
    if (!m.id || !canWrite) return;
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      let res = await fetch(`/api/config/payment-methods/${m.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ isActive: !m.isActive }),
      });
      if (!res.ok) {
        res = await fetch(`/api/pos/payment-methods/${m.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ isActive: !m.isActive }),
        });
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al cambiar estado');
      }

      toast.success(`Medio "${m.name}" ${!m.isActive ? 'activado' : 'desactivado'}`);
      fetchMethods();
    } catch (err: any) {
      toast.error(err.message || 'Error al cambiar estado del medio de pago');
    }
  };

  // Filtrado
  const filteredMethods = useMemo(() => {
    return methods.filter((m) => {
      // Búsqueda
      if (debouncedSearch) {
        const term = debouncedSearch.toLowerCase();
        const matchCode = m.code.toLowerCase().includes(term);
        const matchName = m.name.toLowerCase().includes(term);
        if (!matchCode && !matchName) return false;
      }

      // Moneda
      if (currencyFilter !== 'ALL' && m.currency !== currencyFilter) {
        return false;
      }

      // Tipo / Categoría
      if (typeFilter !== 'ALL' && m.type !== typeFilter) {
        return false;
      }

      // Estado
      if (statusFilter === 'ACTIVE' && !m.isActive) return false;
      if (statusFilter === 'INACTIVE' && m.isActive) return false;

      return true;
    });
  }, [methods, debouncedSearch, currencyFilter, typeFilter, statusFilter]);

  // Métricas
  const totalCount = methods.length;
  const activeCount = methods.filter((m) => m.isActive).length;
  const vesCount = methods.filter((m) => m.currency === 'VES').length;
  const igtfCount = methods.filter((m) => m.appliesIGTF).length;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'CARD':
        return 'Punto de Venta / Tarjeta';
      case 'ELECTRONIC':
        return 'Pago Móvil / Transferencia';
      case 'CASH':
        return 'Efectivo en Gaveta';
      case 'CREDIT':
        return 'Crédito / Financiamiento';
      default:
        return 'Otro Medio';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Principal (solo si no está embebido dentro de tabs) */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
                Configuración de Medios de Pago
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-bold bg-sky-100 text-sky-800 rounded-lg border border-sky-200">
                Módulo Configuración
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Catálogo oficial de medios de cobro autorizados para Puntos de Venta (POS), Arqueos y Facturación Comercial
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            {canWrite && (
              <Button size="sm" onClick={handleOpenCreate} className="text-xs">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Nuevo Medio de Pago
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Botón de acción si está embebido */}
      {embedded && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-neutral-200">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-sky-600" />
              Catálogo de Medios de Cobro & Pagos
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Administración centralizada de tarjetas, pago móvil, transferencias, divisas y recargo IGTF
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            {canWrite && (
              <Button size="sm" onClick={handleOpenCreate} className="text-xs">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Nuevo Medio de Pago
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Tarjetas de Métricas Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
              Total Medios
            </span>
            <div className="w-7 h-7 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-neutral-900">
            {totalCount}
          </div>
          <span className="text-[10px] text-neutral-400">Registrados en el sistema</span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
              Habilitados
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-emerald-700">
            {activeCount}
          </div>
          <span className="text-[10px] text-neutral-400">Disponibles en el POS</span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
              Bolívares (VES)
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
              <Coins className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-sky-700">
            {vesCount}
          </div>
          <span className="text-[10px] text-neutral-400">Moneda nacional</span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
              Con IGTF (3%)
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Percent className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-indigo-700">
            {igtfCount}
          </div>
          <span className="text-[10px] text-neutral-400">Aplica recargo fiscal</span>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          {/* Búsqueda */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código o nombre (ej. PAGO_MOVIL, CASHEA)..."
              className="w-full h-8 pl-8 pr-3 text-xs border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500 bg-white"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro Moneda */}
          <div>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value as any)}
              className="w-full h-8 px-2 text-xs border border-neutral-300 rounded-lg bg-white focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <option value="ALL">Todas las Monedas</option>
              <option value="VES">Bolívares (VES)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </div>

          {/* Filtro Estado */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full h-8 px-2 text-xs border border-neutral-300 rounded-lg bg-white focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="ACTIVE">Solo Activos</option>
              <option value="INACTIVE">Solo Inactivos</option>
            </select>
          </div>
        </div>

        {/* Filtros Rápidos por Categoría Operativa */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-100 text-[11px]">
          <span className="text-neutral-400 font-medium mr-1">Categoría:</span>
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'CARD', label: 'Tarjetas / POS' },
            { id: 'ELECTRONIC', label: 'Electrónico' },
            { id: 'CASH', label: 'Efectivo' },
            { id: 'CREDIT', label: 'Crédito' },
            { id: 'OTHER', label: 'Otros' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setTypeFilter(cat.id)}
              className={`px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                typeFilter === cat.id
                  ? 'bg-sky-600 text-white border-sky-600 font-bold'
                  : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
          {(searchTerm || currencyFilter !== 'ALL' || typeFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setCurrencyFilter('ALL');
                setTypeFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="ml-auto text-sky-600 hover:text-sky-800 text-[11px] font-medium underline cursor-pointer"
            >
              Restablecer filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Medios de Pago */}
      <div className="bg-white border border-neutral-200 rounded-lg shadow-xs overflow-hidden">
        {loading ? (
          /* Skeletons para carga sin Layout Shift */
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredMethods.length === 0 ? (
          /* Estado Vacío */
          <div className="text-center py-12 px-4 space-y-3">
            <div className="w-12 h-12 rounded-lg bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                No se encontraron medios de pago
              </h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                {searchTerm || currencyFilter !== 'ALL' || typeFilter !== 'ALL' || statusFilter !== 'ALL'
                  ? 'No hay registros que coincidan con los criterios de búsqueda o filtros seleccionados.'
                  : 'Aún no se han configurado medios de pago en la empresa.'}
              </p>
            </div>
            {canWrite && !searchTerm && currencyFilter === 'ALL' && typeFilter === 'ALL' && (
              <Button size="sm" onClick={handleOpenCreate} className="mt-2 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Registrar Primer Medio
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-neutral-50 text-neutral-600 uppercase text-[10px] tracking-wider border-b border-neutral-200 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">Ord.</th>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Nombre del Medio</th>
                  <th className="py-2.5 px-3">Moneda</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3">IGTF</th>
                  <th className="py-2.5 px-3">Ref. Bancaria</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredMethods.map((m) => (
                  <tr key={m.id || m.code} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono text-neutral-500">
                      {m.displayOrder ?? 0}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-neutral-900">
                      {m.code}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-neutral-900">
                      {m.name}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-lg text-[10px] font-bold border ${
                          m.currency === 'USD'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-sky-50 text-sky-800 border-sky-200'
                        }`}
                      >
                        {m.currency}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-neutral-600">
                      {getTypeLabel(m.type)}
                    </td>
                    <td className="py-2.5 px-3">
                      {m.appliesIGTF ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          +3% IGTF
                        </span>
                      ) : (
                        <span className="text-neutral-400 text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {m.requiresReference ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-lg text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          Obligatoria
                        </span>
                      ) : (
                        <span className="text-neutral-400 text-[11px]">Opcional</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(m)}
                        disabled={!canWrite}
                        className={`cursor-pointer transition-opacity ${!canWrite ? 'opacity-70 cursor-not-allowed' : ''}`}
                        title={
                          !canWrite
                            ? 'Sin permisos de edición'
                            : m.isActive
                            ? 'Clic para desactivar método en el POS'
                            : 'Clic para activar método en el POS'
                        }
                      >
                        <Badge variant={m.isActive ? 'success' : 'neutral'}>
                          {m.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {canWrite ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEdit(m)}
                          className="h-7 px-2 text-xs"
                        >
                          <Edit2 className="w-3 h-3 mr-1 text-neutral-600" />
                          Editar
                        </Button>
                      ) : (
                        <span className="text-neutral-400 text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Crear / Editar Medio de Pago */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Editar Medio de Pago' : 'Nuevo Medio de Pago'}
        subtitle="Configure los parámetros fiscales, tipo de divisa y reglas operativas para cobros"
        icon={<CreditCard className="w-5 h-5 text-sky-600" />}
        maxWidth="max-w-xl"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button form="paymentMethodConfigForm" type="submit" size="sm" disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Guardar Medio de Pago
                </>
              )}
            </Button>
          </div>
        }
      >
        <form id="paymentMethodConfigForm" onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Identificación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Código Interno <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formCode}
                onChange={(e) => {
                  setFormCode(e.target.value.toUpperCase());
                  if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
                }}
                placeholder="Ej: CASHEA, PAGO_MOVIL, BIOPAGO"
                className={`w-full h-8 px-2.5 border rounded-lg font-mono font-bold text-xs focus-visible:ring-2 focus-visible:ring-sky-500 bg-white ${
                  errors.code ? 'border-red-500 ring-1 ring-red-500' : 'border-neutral-300'
                }`}
                disabled={Boolean(editingId && ['CASH_USD', 'CASH_VES'].includes(formCode))}
              />
              {errors.code ? (
                <span className="text-[10px] text-red-600 mt-0.5 block">{errors.code}</span>
              ) : (
                <span className="text-[10px] text-neutral-400 mt-0.5 block">
                  Identificador único en mayúsculas sin espacios
                </span>
              )}
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Nombre Descriptivo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Ej: Tarjeta de Débito / POS"
                className={`w-full h-8 px-2.5 border rounded-lg text-xs focus-visible:ring-2 focus-visible:ring-sky-500 bg-white ${
                  errors.name ? 'border-red-500 ring-1 ring-red-500' : 'border-neutral-300'
                }`}
              />
              {errors.name ? (
                <span className="text-[10px] text-red-600 mt-0.5 block">{errors.name}</span>
              ) : (
                <span className="text-[10px] text-neutral-400 mt-0.5 block">
                  Etiqueta visual mostrada al cajero y en reportes
                </span>
              )}
            </div>
          </div>

          {/* Moneda y Categoría */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Moneda Base</label>
              <select
                value={formCurrency}
                onChange={(e) => {
                  const curr = e.target.value as 'USD' | 'VES';
                  setFormCurrency(curr);
                  if (curr === 'USD') setFormAppliesIGTF(true);
                  else setFormAppliesIGTF(false);
                }}
                className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs bg-white focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <option value="VES">Bolívares (VES)</option>
                <option value="USD">Dólares / Divisas (USD)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Categoría Operativa
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as any)}
                className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs bg-white focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <option value="CARD">Tarjeta (Punto de Venta Débito/Crédito)</option>
                <option value="ELECTRONIC">Electrónico (Pago Móvil / Transferencia)</option>
                <option value="CASH">Efectivo Físico en Gaveta</option>
                <option value="CREDIT">Crédito / Financiamiento (Cashea, Cuotas)</option>
                <option value="OTHER">Otro Medio Especial</option>
              </select>
            </div>
          </div>

          {/* Orden de visualización */}
          <div>
            <label className="block font-semibold text-neutral-700 mb-1">
              Orden de Visualización
            </label>
            <input
              type="number"
              min="0"
              value={formDisplayOrder}
              onChange={(e) => setFormDisplayOrder(parseInt(e.target.value) || 0)}
              className="w-full sm:w-32 h-8 px-2.5 border border-neutral-300 rounded-lg text-xs font-mono focus-visible:ring-2 focus-visible:ring-sky-500 bg-white"
            />
            <span className="text-[10px] text-neutral-400 mt-0.5 block">
              Prioridad en la botonera de cobro del POS (menor número = primero)
            </span>
          </div>

          {/* Reglas Operativas y Fiscales */}
          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2.5">
            <span className="font-semibold text-neutral-800 block text-[11px] uppercase tracking-wider">
              Políticas Operativas & SENIAT:
            </span>

            <div className="space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-neutral-700">
                <input
                  type="checkbox"
                  checked={formAppliesIGTF}
                  onChange={(e) => setFormAppliesIGTF(e.target.checked)}
                  className="mt-0.5 rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <span className="font-medium block text-neutral-900">
                    Aplica Alícuota IGTF (3%)
                  </span>
                  <span className="text-[10px] text-neutral-500 block">
                    Grava con el 3% de IGTF cuando se efectúe el pago en divisas según la Ley del Impuesto a las Grandes Transacciones Financieras.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-neutral-700">
                <input
                  type="checkbox"
                  checked={formRequiresReference}
                  onChange={(e) => setFormRequiresReference(e.target.checked)}
                  className="mt-0.5 rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <span className="font-medium block text-neutral-900">
                    Exigir Referencia Bancaria / Lote Obligatorio
                  </span>
                  <span className="text-[10px] text-neutral-500 block">
                    Obliga al cajero a capturar el número de comprobante o aprobación antes de asentar el cobro.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-neutral-700">
                <input
                  type="checkbox"
                  checked={formRequiresBankAccount}
                  onChange={(e) => setFormRequiresBankAccount(e.target.checked)}
                  className="mt-0.5 rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <span className="font-medium block text-neutral-900">
                    Vincular a Cuenta Bancaria de Tesorería
                  </span>
                  <span className="text-[10px] text-neutral-500 block">
                    Asocia los ingresos de este medio de cobro al módulo de Tesorería y Conciliación Bancaria.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-neutral-700">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="mt-0.5 rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <span className="font-medium block text-neutral-900">
                    Método Activo y Disponible
                  </span>
                  <span className="text-[10px] text-neutral-500 block">
                    Si se desactiva, no se mostrará como opción de cobro en terminales de caja.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
