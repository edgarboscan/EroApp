import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  History,
  Search,
  Filter,
  Eye,
  ShieldCheck,
  Calendar,
  User,
  Monitor,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { AuditLogEntry } from '@ero/shared';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModule, setSelectedModule] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal de inspección de JSON
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedModule) params.append('module', selectedModule);
      if (searchTerm) params.append('search', searchTerm);

      const res = await fetch(`/api/audit/logs?${params.toString()}`);
      if (res.ok) {
        const d = await res.json();
        if (d.success && d.data) {
          setLogs(d.data);
        }
      }
    } catch {
      toast.error('Error al cargar la bitácora de auditoría');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedModule]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const getModuleBadgeVariant = (module: string): 'neutral' | 'info' | 'warning' | 'success' | 'danger' => {
    switch (module) {
      case 'sales':
      case 'pos':
        return 'success';
      case 'purchases':
      case 'payables':
        return 'warning';
      case 'config':
      case 'audit':
        return 'danger';
      case 'inventory':
      case 'treasury':
        return 'info';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
            Bitácora de Auditoría Integral (Audit Log)
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Registro cronológico inmutable de transacciones, mutaciones de datos y accesos al sistema
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="neutral">
            Retención Legal: 5 Años
          </Badge>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm">
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Módulo del Sistema</label>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="w-full h-9 rounded-lg border border-neutral-300 bg-white px-3 text-xs text-neutral-900 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <option value="">Todos los Módulos</option>
              <option value="sales">Ventas & Cotizaciones</option>
              <option value="purchases">Compras & Abastecimiento</option>
              <option value="pos">Punto de Venta (POS)</option>
              <option value="inventory">Inventario & Kardex</option>
              <option value="treasury">Tesorería & Bancos</option>
              <option value="config">Configuración & Reglas</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-neutral-700 mb-1">Búsqueda (ID, Entidad, IP)</label>
            <div className="relative">
              <Input
                placeholder="Buscar por documento, entidad o dirección IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
              <Search className="w-4 h-4 text-neutral-400 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <Button type="submit" variant="primary" className="w-full text-xs flex items-center justify-center gap-2">
              <Filter className="w-3.5 h-3.5" />
              <span>Filtrar Registros</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Tabla de Auditoría */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex justify-between items-center">
          <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-sky-600" />
            Eventos Registrados
          </h2>
          <span className="text-xs text-neutral-500">{logs.length} eventos listados</span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            <div className="h-10 bg-neutral-200 animate-pulse rounded-lg" />
            <div className="h-10 bg-neutral-200 animate-pulse rounded-lg" />
            <div className="h-10 bg-neutral-200 animate-pulse rounded-lg" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheck className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-neutral-600">No se encontraron eventos de auditoría</p>
            <p className="text-[11px] text-neutral-400 mt-1">Intente cambiar los filtros o el rango de búsqueda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50/50 border-b border-neutral-200 text-neutral-600">
                <tr>
                  <th className="py-2.5 px-4">Fecha y Hora</th>
                  <th className="py-2.5 px-4">Usuario</th>
                  <th className="py-2.5 px-4">Módulo</th>
                  <th className="py-2.5 px-4">Acción</th>
                  <th className="py-2.5 px-4">Entidad / Referencia</th>
                  <th className="py-2.5 px-4">IP Origen</th>
                  <th className="py-2.5 px-4 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50">
                    <td className="py-3 px-4 font-mono text-[11px] text-neutral-700 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('es-VE')}
                    </td>
                    <td className="py-3 px-4 font-medium text-neutral-900 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{log.userName || 'Sistema'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={getModuleBadgeVariant(log.module)}>
                        {log.module}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-neutral-800">
                      {log.action}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-neutral-500">{log.entity}: </span>
                      <span className="font-mono font-bold text-neutral-900">{log.entityId || 'N/A'}</span>
                    </td>
                    <td className="py-3 px-4 text-neutral-500 font-mono text-[11px]">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedLog(log)}
                        className="text-[11px] h-7 px-2"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        <span>Ver JSON</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalle JSON */}
      <Modal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={`Inspección de Cambio - ${selectedLog?.module}.${selectedLog?.action}`}
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
            <div>
              <span className="text-neutral-500 block">Entidad afectada:</span>
              <span className="font-bold text-neutral-900">{selectedLog?.entity} ({selectedLog?.entityId})</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Usuario ejecutor:</span>
              <span className="font-bold text-neutral-900">{selectedLog?.userName}</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Dirección IP:</span>
              <span className="font-mono font-medium text-neutral-800">{selectedLog?.ipAddress}</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Agente de Navegador:</span>
              <span className="text-neutral-700 truncate block">{selectedLog?.userAgent}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Antes */}
            <div>
              <div className="flex items-center gap-1.5 font-bold text-neutral-700 mb-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Estado Previo (Before)</span>
              </div>
              <pre className="bg-neutral-900 text-neutral-200 p-3 rounded-lg overflow-x-auto text-[11px] font-mono h-48">
                {selectedLog?.beforeJson
                  ? JSON.stringify(selectedLog.beforeJson, null, 2)
                  : '// Sin estado anterior (Creación nueva)'}
              </pre>
            </div>

            {/* Después */}
            <div>
              <div className="flex items-center gap-1.5 font-bold text-neutral-700 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Estado Posterior (After)</span>
              </div>
              <pre className="bg-neutral-900 text-neutral-200 p-3 rounded-lg overflow-x-auto text-[11px] font-mono h-48">
                {selectedLog?.afterJson
                  ? JSON.stringify(selectedLog.afterJson, null, 2)
                  : '// Sin cambios registrados'}
              </pre>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-neutral-200">
            <Button variant="outline" onClick={() => setSelectedLog(null)}>
              Cerrar Inspección
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
