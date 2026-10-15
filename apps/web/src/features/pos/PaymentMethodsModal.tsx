import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import {
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  DollarSign,
  Percent,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { PaymentMethod } from '@ero/shared';

interface PaymentMethodsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMethodsUpdated?: () => void;
}

export const PaymentMethodsModal: React.FC<PaymentMethodsModalProps> = ({
  isOpen,
  onClose,
  onMethodsUpdated,
}) => {
  const { token } = useAuthStore();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'VES'>('VES');
  const [type, setType] = useState<'CASH' | 'CARD' | 'ELECTRONIC' | 'CREDIT' | 'OTHER'>('CARD');
  const [appliesIGTF, setAppliesIGTF] = useState(false);
  const [requiresReference, setRequiresReference] = useState(true);
  const [requiresBankAccount, setRequiresBankAccount] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      fetchMethods();
    }
  }, [isOpen]);

  const fetchMethods = async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch('/api/pos/payment-methods', { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setMethods(json.data);
        }
      }
    } catch {
      toast.error('Error al cargar la lista de medios de pago');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setCode('');
    setName('');
    setCurrency('VES');
    setType('CARD');
    setAppliesIGTF(false);
    setRequiresReference(true);
    setRequiresBankAccount(false);
    setIsActive(true);
    setDisplayOrder(methods.length + 1);
    setIsEditing(true);
  };

  const handleOpenEdit = (m: PaymentMethod) => {
    setEditingId(m.id || null);
    setCode(m.code);
    setName(m.name);
    setCurrency(m.currency);
    setType(m.type);
    setAppliesIGTF(Boolean(m.appliesIGTF));
    setRequiresReference(Boolean(m.requiresReference));
    setRequiresBankAccount(Boolean(m.requiresBankAccount));
    setIsActive(Boolean(m.isActive));
    setDisplayOrder(m.displayOrder ?? 0);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.error('El código y el nombre del método de pago son requeridos');
      return;
    }

    setSaving(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const payload = {
        code: code.trim().toUpperCase().replace(/\s+/g, '_'),
        name: name.trim(),
        currency,
        type,
        appliesIGTF,
        requiresReference,
        requiresBankAccount,
        isActive,
        displayOrder: Number(displayOrder) || 0,
      };

      let res;
      if (editingId) {
        res = await fetch(`/api/pos/payment-methods/${editingId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/pos/payment-methods', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al guardar método de pago');
      }

      toast.success(editingId ? 'Método de pago actualizado' : 'Método de pago creado con éxito');
      setIsEditing(false);
      fetchMethods();
      if (onMethodsUpdated) onMethodsUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar la solicitud');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (m: PaymentMethod) => {
    if (!m.id) return;
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch(`/api/pos/payment-methods/${m.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ isActive: !m.isActive }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al alternar estado');
      }
      toast.success(`Método ${m.name} ${!m.isActive ? 'activado' : 'desactivado'}`);
      fetchMethods();
      if (onMethodsUpdated) onMethodsUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Error al alternar estado');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                Configuración de Medios de Pago
              </h3>
              <p className="text-xs text-neutral-500">
                Administre tarjetas de débito/crédito, pagos electrónicos y métodos personalizados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {!isEditing ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-600 font-medium">
                  {methods.length} métodos de pago configurados
                </span>
                <Button size="sm" onClick={handleOpenCreate}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Nuevo Medio de Pago
                </Button>
              </div>

              {loading ? (
                <div className="space-y-2 py-6 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-sky-600 mx-auto" />
                  <span className="text-xs text-neutral-500">Cargando métodos de pago...</span>
                </div>
              ) : methods.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 text-xs">
                  No hay métodos de pago registrados.
                </div>
              ) : (
                <div className="border border-neutral-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-50 text-neutral-600 uppercase text-[10px] tracking-wider border-b border-neutral-200">
                      <tr>
                        <th className="py-2.5 px-3">Código</th>
                        <th className="py-2.5 px-3">Nombre</th>
                        <th className="py-2.5 px-3">Moneda</th>
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3">IGTF</th>
                        <th className="py-2.5 px-3">Ref.</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                        <th className="py-2.5 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {methods.map((m) => (
                        <tr key={m.id || m.code} className="hover:bg-neutral-50/70">
                          <td className="py-2.5 px-3 font-mono font-bold text-neutral-800">
                            {m.code}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-neutral-900">
                            {m.name}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              m.currency === 'USD' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                            }`}>
                              {m.currency}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-neutral-600">
                            {m.type === 'CARD' ? 'Tarjeta / POS' :
                             m.type === 'CASH' ? 'Efectivo' :
                             m.type === 'ELECTRONIC' ? 'Electrónico' :
                             m.type === 'CREDIT' ? 'Crédito' : 'Otro'}
                          </td>
                          <td className="py-2.5 px-3">
                            {m.appliesIGTF ? (
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded">
                                +3%
                              </span>
                            ) : (
                              <span className="text-neutral-400 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {m.requiresReference ? (
                              <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded">
                                Oblig.
                              </span>
                            ) : (
                              <span className="text-neutral-400 text-[11px]">Opc.</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(m)}
                              className="cursor-pointer"
                              title={m.isActive ? 'Clic para desactivar' : 'Clic para activar'}
                            >
                              <Badge variant={m.isActive ? 'success' : 'neutral'}>
                                {m.isActive ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEdit(m)}
                              className="h-7 px-2 text-xs"
                            >
                              <Edit2 className="w-3 h-3 mr-1" />
                              Editar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            /* Formulario Crear / Editar */
            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="bg-sky-50 border border-sky-200 p-3 rounded-lg text-neutral-700">
                <span className="font-semibold block text-sky-900 mb-0.5">
                  {editingId ? 'Editar Método de Pago' : 'Nuevo Medio de Pago'}
                </span>
                <p className="text-[11px] text-sky-800">
                  Configure los atributos tributarios y operativos del medio de pago para el Punto de Venta (POS) y Arqueos.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Código Interno <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Ej: CREDIT_CARD, CASHEA, BIOPAGO"
                    className="w-full h-8 px-2.5 border border-neutral-300 rounded-lg font-mono font-bold text-xs focus-visible:ring-2 focus-visible:ring-sky-500"
                    disabled={Boolean(editingId && ['CASH_USD', 'CASH_VES'].includes(code))}
                  />
                  <span className="text-[10px] text-neutral-400 mt-0.5 block">
                    Identificador único sin espacios (letras mayúsculas y guiones bajos).
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Nombre Descriptivo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Punto de Venta / Crédito (Bs)"
                    className="w-full h-8 px-2.5 border border-neutral-300 rounded-lg text-xs focus-visible:ring-2 focus-visible:ring-sky-500"
                  />
                  <span className="text-[10px] text-neutral-400 mt-0.5 block">
                    Nombre visible para el cajero en el POS y reportes.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Moneda Base</label>
                  <select
                    value={currency}
                    onChange={(e) => {
                      const c = e.target.value as 'USD' | 'VES';
                      setCurrency(c);
                      if (c === 'USD') setAppliesIGTF(true);
                      else setAppliesIGTF(false);
                    }}
                    className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs bg-white focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <option value="VES">Bolívares (VES)</option>
                    <option value="USD">Dólares / Divisas (USD)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Categoría Operativa</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs bg-white focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <option value="CARD">Tarjeta (Punto de Venta Débito/Crédito)</option>
                    <option value="ELECTRONIC">Electrónico (Pago Móvil / Transferencia)</option>
                    <option value="CASH">Efectivo Físico en Gaveta</option>
                    <option value="CREDIT">Crédito / Financiamiento (Cashea, etc.)</option>
                    <option value="OTHER">Otro Medio Especial</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
                <span className="font-semibold text-neutral-800 block text-[11px]">
                  Reglas Fiscales y Operativas:
                </span>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-neutral-700">
                    <input
                      type="checkbox"
                      checked={appliesIGTF}
                      onChange={(e) => setAppliesIGTF(e.target.checked)}
                      className="rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>
                      Aplica IGTF 3% (Pagos en moneda extranjera sin intermediación del sistema financiero nacional)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-neutral-700">
                    <input
                      type="checkbox"
                      checked={requiresReference}
                      onChange={(e) => setRequiresReference(e.target.checked)}
                      className="rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>
                      Exigir número de referencia / lote bancario obligatorio al cajero
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-neutral-700">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>Método Activo y disponible para cobro en el POS</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Guardar Medio de Pago
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {!isEditing && (
          <div className="pt-2 border-t border-neutral-200 flex justify-end">
            <Button size="sm" variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
