import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, Check, AlertCircle, LayoutGrid } from 'lucide-react';
import type { RestaurantTable } from '@ero/shared';

interface TableManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: RestaurantTable[];
  onRefresh: () => Promise<void>;
  token: string | null;
  activeBranchId: string | null;
}

export const TableManagementModal: React.FC<TableManagementModalProps> = ({
  isOpen,
  onClose,
  tables,
  onRefresh,
  token,
  activeBranchId,
}) => {
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form states
  const [tableNumber, setTableNumber] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [zone, setZone] = useState<string>('Salón Principal');
  const [capacity, setCapacity] = useState<number>(4);

  if (!isOpen) return null;

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(activeBranchId ? { 'x-branch-id': activeBranchId } : {}),
  });

  const resetForm = () => {
    setTableNumber('');
    setName('');
    setZone('Salón Principal');
    setCapacity(4);
    setEditingTable(null);
    setIsCreating(false);
    setErrorMessage(null);
  };

  const handleStartCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const handleStartEdit = (table: RestaurantTable) => {
    resetForm();
    setEditingTable(table);
    setTableNumber(table.table_number);
    setName(table.name);
    setZone(table.zone || 'Salón Principal');
    setCapacity(table.capacity || 4);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber.trim() || !name.trim()) {
      setErrorMessage('El número y nombre de mesa son obligatorios');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingTable) {
        // Actualizar mesa existente
        const res = await fetch(`/api/restaurant/tables/${editingTable.id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({
            table_number: tableNumber.trim(),
            name: name.trim(),
            zone: zone.trim(),
            capacity: Number(capacity),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || 'Error al actualizar la mesa');
        }
        setSuccessMessage('Mesa actualizada correctamente');
      } else {
        // Crear nueva mesa
        const res = await fetch('/api/restaurant/tables', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            table_number: tableNumber.trim(),
            name: name.trim(),
            zone: zone.trim(),
            capacity: Number(capacity),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || 'Error al crear la mesa');
        }
        setSuccessMessage('Mesa creada correctamente');
      }

      await onRefresh();
      resetForm();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar la operación';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (table: RestaurantTable) => {
    if (table.status !== 'AVAILABLE' || table.active_order_id) {
      setErrorMessage(`No se puede eliminar la ${table.name} porque se encuentra ocupada.`);
      return;
    }

    if (!window.confirm(`¿Estás seguro de eliminar la ${table.name} (${table.table_number})?`)) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/restaurant/tables/${table.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Error al eliminar mesa');
      }
      setSuccessMessage(`Mesa ${table.name} eliminada.`);
      await onRefresh();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar la mesa';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Administración de Mesas</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Messages */}
          {errorMessage && (
            <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-lg text-sm text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-lg text-sm text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form Create/Edit */}
          {(isCreating || editingTable) && (
            <form onSubmit={handleSave} className="bg-slate-800/80 p-4 border border-slate-700 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">
                  {editingTable ? `Editar Mesa: ${editingTable.name}` : 'Nueva Mesa de Restaurante'}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Número de Mesa *
                  </label>
                  <input
                    type="text"
                    required
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="Ej. M-01, T-05"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nombre Descriptivo *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Mesa 01 - Salón"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Zona / Ambiente
                  </label>
                  <select
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <option value="Salón Principal">Salón Principal</option>
                    <option value="Terraza">Terraza</option>
                    <option value="Barra">Barra</option>
                    <option value="VIP">VIP</option>
                    <option value="Jardín">Jardín</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Capacidad (Personas)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors focus-visible:ring-2 focus-visible:ring-slate-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {isSubmitting ? 'Guardando...' : editingTable ? 'Guardar Cambios' : 'Crear Mesa'}
                </button>
              </div>
            </form>
          )}

          {/* Action to create */}
          {!isCreating && !editingTable && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">
                Total de mesas configuradas: <strong className="text-white">{tables.length}</strong>
              </span>
              <button
                type="button"
                onClick={handleStartCreate}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Nueva Mesa</span>
              </button>
            </div>
          )}

          {/* Tables list */}
          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/90 text-xs text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Zona</th>
                  <th className="px-4 py-3">Capacidad</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tables.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No hay mesas registradas en esta sucursal.
                    </td>
                  </tr>
                ) : (
                  tables.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{t.table_number}</td>
                      <td className="px-4 py-3 text-slate-200">{t.name}</td>
                      <td className="px-4 py-3 text-slate-400">{t.zone}</td>
                      <td className="px-4 py-3 text-slate-400">{t.capacity} comensales</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            t.status === 'AVAILABLE'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                              : t.status === 'OCCUPIED'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                              : 'bg-indigo-950 text-indigo-400 border border-indigo-800/50'
                          }`}
                        >
                          {t.status === 'AVAILABLE'
                            ? 'Disponible'
                            : t.status === 'OCCUPIED'
                            ? 'Ocupada'
                            : 'Cuenta Pedida'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(t)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500"
                            title="Editar mesa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={t.status !== 'AVAILABLE' || !!t.active_order_id}
                            onClick={() => handleDelete(t)}
                            className="p-1.5 text-slate-400 hover:text-red-400 disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-red-500"
                            title={
                              t.status !== 'AVAILABLE'
                                ? 'No se puede eliminar una mesa ocupada'
                                : 'Eliminar mesa'
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-slate-500"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
