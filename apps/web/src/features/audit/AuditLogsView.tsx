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
  Activity,
  Layers,
  Database,
  Users,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { AuditLogEntry } from '@ero/shared';
import { useAuthStore } from '../../stores/authStore';

export const AuditLogsView: React.FC = () => {
  const { token, activeBranchId } = useAuthStore();
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
      if (activeBranchId) params.append('branchId', activeBranchId);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(activeBranchId ? { 'X-Branch-Id': activeBranchId } : {}),
      };

      const res = await fetch(`/api/audit/logs?${params.toString()}`, { headers });
      if (res.status === 401) {
        toast.error('Sesión no autorizada o expirada. Por favor inicie sesión nuevamente.');
        return;
      }
      if (res.status === 403) {
        toast.error('No posee permisos suficientes para consultar la bitácora de auditoría.');
        return;
      }
      if (res.ok) {
        const d = await res.json();
        if (d.success && d.data) {
          setLogs(d.data);
        }
      } else {
        const d = await res.json().catch(() => null);
        toast.error(d?.error?.message || 'Error al cargar la bitácora de auditoría');
      }
    } catch {
      toast.error('Error de red al consultar la bitácora de auditoría');
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

  // KPIs
  const totalEvents = logs.length;
  const modulesCount = new Set(logs.map((l) => l.module)).size;
  const mutationsCount = logs.filter((l) =>
    ['create', 'update', 'delete', 'receipt', 'sale', 'transfer', 'adjust'].some((act) =>
      l.action.toLowerCase().includes(act)
    )
  ).length;
  const uniqueUsersCount = new Set(logs.map((l) => l.userName || 'Sistema')).size;

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
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Bitácora de Auditoría Integral (Audit Log)
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Registro cronológico inmutable de transacciones, mutaciones de datos
            y accesos al sistema
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="neutral">Retención Legal: 5 Años</Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Total Eventos
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#007BFF]/10 text-[#007BFF] dark:bg-[#3D91FF]/15 dark:text-[#3D91FF] flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-[#007BFF] dark:text-[#3D91FF] mt-2">
            {totalEvents}
          </p>
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5 block">
            Registros en el periodo
          </span>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#17A2B8] dark:border-l-[#38C9DD] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Módulos Activos
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#17A2B8]/10 text-[#17A2B8] dark:bg-[#38C9DD]/15 dark:text-[#38C9DD] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-[#17A2B8] dark:text-[#38C9DD] mt-2">
            {modulesCount}
          </p>
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5 block">
            Áreas del sistema con eventos
          </span>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#FFC107] dark:border-l-[#FBBF24] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Mutaciones de Datos
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#FFC107]/15 text-[#b28500] dark:bg-[#FBBF24]/15 dark:text-[#FBBF24] flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-[#b28500] dark:text-[#FBBF24] mt-2">
            {mutationsCount}
          </p>
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5 block">
            Creaciones, ediciones y bajas
          </span>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Operadores Auditados
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#28A745]/10 text-[#28A745] dark:bg-[#4ADE80]/15 dark:text-[#4ADE80] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-[#28A745] dark:text-[#4ADE80] mt-2">
            {uniqueUsersCount}
          </p>
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5 block">
            Usuarios con actividad
          </span>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white dark:bg-[#1E1F21] border border-gray-200 dark:border-gray-800 rounded-lg p-4 shadow-xs">
        <form
          onSubmit={handleSearch}
          className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Módulo del Sistema
            </label>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-[#007BFF] dark:focus-visible:ring-[#3D91FF]"
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
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Búsqueda (ID, Entidad, IP)
            </label>
            <div className="relative">
              <Input
                placeholder="Buscar por documento, entidad o dirección IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
              <Search className="w-4 h-4 text-neutral-400 dark:text-neutral-500 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              variant="primary"
              className="w-full text-xs flex items-center justify-center gap-2"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filtrar Registros</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Tabla de Auditoría */}
      <div className="bg-white dark:bg-[#1E1F21] border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden shadow-xs">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-[#F4F6F9] dark:bg-[#18191A] flex justify-between items-center">
          <h2 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-[#007BFF] dark:text-[#3D91FF]" />
            Eventos Registrados
          </h2>
          <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
            {logs.length} eventos listados
          </span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            <div className="h-10 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-lg" />
            <div className="h-10 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-lg" />
            <div className="h-10 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-lg" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheck className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
            <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
              No se encontraron eventos de auditoría
            </p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
              Intente cambiar los filtros o el rango de búsqueda
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-600">
              <thead className="bg-[#F4F6F9] dark:bg-[#18191A] text-neutral-700 dark:text-neutral-300 uppercase font-semibold text-[10px] tracking-wider border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
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
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-100 dark:border-gray-800/80 hover:bg-[#F4F6F9] dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-[11px] text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("es-VE")}
                    </td>
                    <td className="py-3 px-4 font-medium text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
                      <span>{log.userName || "Sistema"}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={getModuleBadgeVariant(log.module)}>
                        {log.module}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-neutral-800 dark:text-neutral-200">
                      {log.action}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {log.entity}:{" "}
                      </span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                        {log.entityId || "N/A"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-500 dark:text-neutral-400 font-mono text-[11px]">
                      {log.ipAddress || "127.0.0.1"}
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
          <div className="grid grid-cols-2 gap-3 p-3 border-b border-sky-200 dark:border-sky-800 bg-sky-50/60 dark:bg-sky-950/30">
            <div>
              <span className="text-neutral-500 dark:text-neutral-400 block">
                Entidad afectada:
              </span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100">
                {selectedLog?.entity} ({selectedLog?.entityId})
              </span>
            </div>
            <div>
              <span className="text-neutral-500 dark:text-neutral-400 block">
                Usuario ejecutor:
              </span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100">
                {selectedLog?.userName}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 dark:text-neutral-400 block">
                Dirección IP:
              </span>
              <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">
                {selectedLog?.ipAddress}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 dark:text-neutral-400 block">
                Agente de Navegador:
              </span>
              <span className="text-neutral-700 dark:text-neutral-300 truncate block">
                {selectedLog?.userAgent}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Antes */}
            <div>
              <div className="flex items-center gap-1.5 font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Estado Previo (Before)</span>
              </div>
              <pre className="bg-neutral-900 dark:bg-neutral-950 text-neutral-200 p-3 rounded-lg overflow-x-auto text-[11px] font-mono h-48 border border-neutral-800">
                {selectedLog?.beforeJson
                  ? JSON.stringify(selectedLog.beforeJson, null, 2)
                  : "// Sin estado anterior (Creación nueva)"}
              </pre>
            </div>

            {/* Después */}
            <div>
              <div className="flex items-center gap-1.5 font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Estado Posterior (After)</span>
              </div>
              <pre className="bg-neutral-900 dark:bg-neutral-950 text-neutral-200 p-3 rounded-lg overflow-x-auto text-[11px] font-mono h-48 border border-neutral-800">
                {selectedLog?.afterJson
                  ? JSON.stringify(selectedLog.afterJson, null, 2)
                  : "// Sin cambios registrados"}
              </pre>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <Button variant="outline" onClick={() => setSelectedLog(null)}>
              Cerrar Inspección
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
