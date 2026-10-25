import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Check, AlertCircle } from 'lucide-react';
import type { RestaurantTable } from '@ero/shared';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

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
  const [tableToDelete, setTableToDelete] = useState<RestaurantTable | null>(null);

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

  const confirmDelete = async () => {
    if (!tableToDelete) return;
    if (tableToDelete.status !== 'AVAILABLE' || tableToDelete.active_order_id) {
      setErrorMessage(`No se puede eliminar la ${tableToDelete.name} porque se encuentra ocupada.`);
      setTableToDelete(null);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/restaurant/tables/${tableToDelete.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Error al eliminar mesa');
      }
      setSuccessMessage(`Mesa ${tableToDelete.name} eliminada.`);
      setTableToDelete(null);
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Administración de Mesas"
      subtitle="Configuración de planos, zonas y capacidades de mesas por sucursal"
      size="4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Total mesas: <strong className="text-neutral-800 dark:text-neutral-200">{tables.length}</strong>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Messages */}
        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Delete Confirmation Banner */}
        {tableToDelete && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between gap-3 text-xs">
            <div className="text-amber-800 dark:text-amber-200">
              ¿Confirmas la eliminación de la <strong>{tableToDelete.name} ({tableToDelete.table_number})</strong>?
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setTableToDelete(null)}>
                Cancelar
              </Button>
              <Button size="sm" variant="danger" disabled={isSubmitting} onClick={confirmDelete}>
                {isSubmitting ? 'Eliminando...' : 'Sí, Eliminar'}
              </Button>
            </div>
          </div>
        )}

        {/* Form Create/Edit */}
        {(isCreating || editingTable) && (
          <form onSubmit={handleSave} className="bg-neutral-50 dark:bg-neutral-800/60 p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {editingTable ? `Editar Mesa: ${editingTable.name}` : 'Nueva Mesa de Restaurante'}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Número de Mesa *
                </label>
                <input
                  type="text"
                  required
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Ej. M-01, T-05"
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 text-sm focus-visible:ring-2 focus-visible:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Nombre Descriptivo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Mesa 01 - Salón"
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 text-sm focus-visible:ring-2 focus-visible:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Zona / Ambiente
                </label>
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 text-sm focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <option value="Salón Principal">Salón Principal</option>
                  <option value="Terraza">Terraza</option>
                  <option value="Barra">Barra</option>
                  <option value="VIP">VIP</option>
                  <option value="Jardín">Jardín</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Capacidad (Personas)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 text-sm focus-visible:ring-2 focus-visible:ring-sky-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetForm}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Guardando...' : editingTable ? 'Guardar Cambios' : 'Crear Mesa'}
              </Button>
            </div>
          </form>
        )}

        {/* Action to create */}
        {!isCreating && !editingTable && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Total configuradas: <strong className="text-neutral-900 dark:text-neutral-100">{tables.length}</strong>
            </span>
            <Button
              type="button"
              size="sm"
              onClick={handleStartCreate}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Agregar Nueva Mesa</span>
            </Button>
          </div>
        )}

        {/* Tables list */}
        <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Zona</th>
                <th className="px-4 py-3">Capacidad</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700 text-neutral-800 dark:text-neutral-200">
              {tables.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400">
                    No hay mesas registradas en esta sucursal.
                  </td>
                </tr>
              ) : (
                tables.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-neutral-900 dark:text-neutral-100">{t.table_number}</td>
                    <td className="px-4 py-3 text-neutral-800 dark:text-neutral-200 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{t.zone}</td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{t.capacity} personas</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium ${
                          t.status === 'AVAILABLE'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : t.status === 'OCCUPIED'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                            : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800'
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
                          className="p-1.5 text-neutral-400 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-sky-500 cursor-pointer"
                          title="Editar mesa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={t.status !== 'AVAILABLE' || !!t.active_order_id}
                          onClick={() => setTableToDelete(t)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-30 disabled:hover:text-neutral-400 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer"
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
    </Modal>
  );
};
