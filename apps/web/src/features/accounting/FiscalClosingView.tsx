import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import {
  Lock,
  Unlock,
  TrendingUp,
  ArrowRightLeft,
  Calendar,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  ShieldCheck,
  RefreshCw,
  SlidersHorizontal,
  Plus,
  Trash2,
  BookOpen,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { useExchangeRateStore } from '../../stores/exchangeRateStore';
import { formatMoneyVES, formatMoneyUSD } from '@ero/shared';

interface FiscalPeriod {
  id: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
  closedAt: string | null;
  closedByName: string | null;
}

interface InpcItem {
  id: string;
  year: number;
  month: number;
  inpcValue: number;
  variationMonthly: number;
  publishedDate: string | null;
}

export const FiscalClosingView: React.FC = () => {
  const token = useAuthStore((s) => s.token);
  const currentBcvRate = useExchangeRateStore((s) => s.rate);

  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [inpcList, setInpcList] = useState<InpcItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulación de Diferencia en Cambio
  const [exchangeDiffResult, setExchangeDiffResult] = useState<any | null>(null);
  const [rateForDiff, setRateForDiff] = useState<number>(currentBcvRate || 75.5);
  const [isCalculatingDiff, setIsCalculatingDiff] = useState(false);

  // Simulación de Ajuste por Inflación
  const [inflationResult, setInflationResult] = useState<any | null>(null);
  const [isCalculatingInflation, setIsCalculatingInflation] = useState(false);
  const [targetYear, setTargetYear] = useState<number>(new Date().getFullYear());
  const [targetMonth, setTargetMonth] = useState<number>(new Date().getMonth() + 1);
  const [baseYear, setBaseYear] = useState<number>(new Date().getFullYear());
  const [baseMonth, setBaseMonth] = useState<number>(1);
  const [manualBaseInpc, setManualBaseInpc] = useState<string>('');

  // Modal de Registro/Edición de INPC Oficial BCV
  const [isInpcModalOpen, setIsInpcModalOpen] = useState(false);
  const [isSavingInpc, setIsSavingInpc] = useState(false);
  const [inpcForm, setInpcForm] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    inpcValue: '',
    variationMonthly: '',
    publishedDate: new Date().toISOString().split('T')[0],
  });

  // Modal / Acción Sembrar Plan de Cuentas Estándar
  const [isSeedingAccounts, setIsSeedingAccounts] = useState(false);

  useEffect(() => {
    fetchPeriods();
    fetchInpc();
  }, []);

  const fetchPeriods = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounting/periods', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setPeriods(json.data);
        }
      }
    } catch {
      toast.error('Error al cargar períodos fiscales');
    } finally {
      setLoading(false);
    }
  };

  const fetchInpc = async () => {
    try {
      const res = await fetch('/api/accounting/inflation/indices', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setInpcList(json.data);
        }
      }
    } catch {
      // Ignorar fallas silenciosas
    }
  };

  const handleUpdatePeriodStatus = async (periodId: string, newStatus: 'OPEN' | 'CLOSED' | 'LOCKED') => {
    try {
      const res = await fetch(`/api/accounting/periods/${periodId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Período fiscal actualizado a: ${newStatus}`);
        fetchPeriods();
      } else {
        toast.error(json.error?.message || 'Error al actualizar período');
      }
    } catch {
      toast.error('Error de red al actualizar estado del período');
    }
  };

  const handleCalculateExchangeDiff = async () => {
    setIsCalculatingDiff(true);
    try {
      const res = await fetch(`/api/accounting/exchange-diff/calculate?rateBcv=${rateForDiff}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setExchangeDiffResult(json.data);
          toast.success('Cálculo de fluctuación cambiaria completado');
        }
      }
    } catch {
      toast.error('Error al calcular diferencia en cambio');
    } finally {
      setIsCalculatingDiff(false);
    }
  };

  const handleCalculateInflation = async () => {
    setIsCalculatingInflation(true);
    try {
      const queryParams = new URLSearchParams({
        year: String(targetYear),
        month: String(targetMonth),
        baseYear: String(baseYear),
        baseMonth: String(baseMonth),
      });
      if (manualBaseInpc && parseFloat(manualBaseInpc) > 0) {
        queryParams.append('manualBaseInpc', manualBaseInpc);
      }

      const res = await fetch(`/api/accounting/inflation/calculate?${queryParams.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setInflationResult(json.data);
        toast.success('Ajuste por inflación (VEN-NIF B-10) calculado');
      } else {
        toast.error(json.error?.message || 'Error al calcular ajuste por inflación');
      }
    } catch {
      toast.error('Error al calcular ajuste por inflación');
    } finally {
      setIsCalculatingInflation(false);
    }
  };

  const handleSaveInpc = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(inpcForm.inpcValue);
    if (isNaN(val) || val <= 0) {
      toast.error('Ingrese un valor de INPC válido mayor a cero');
      return;
    }

    setIsSavingInpc(true);
    try {
      const res = await fetch('/api/accounting/inflation/indices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          year: Number(inpcForm.year),
          month: Number(inpcForm.month),
          inpcValue: val,
          variationMonthly: inpcForm.variationMonthly ? parseFloat(inpcForm.variationMonthly) : 0,
          publishedDate: inpcForm.publishedDate || undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || 'Índice INPC guardado');
        setIsInpcModalOpen(false);
        setInpcForm({
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          inpcValue: '',
          variationMonthly: '',
          publishedDate: new Date().toISOString().split('T')[0],
        });
        fetchInpc();
      } else {
        toast.error(json.error?.message || 'Error al guardar índice INPC');
      }
    } catch {
      toast.error('Error de red al guardar índice INPC');
    } finally {
      setIsSavingInpc(false);
    }
  };

  const handleDeleteInpc = async (id: string, label: string) => {
    try {
      const res = await fetch(`/api/accounting/inflation/indices/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Índice ${label} eliminado`);
        fetchInpc();
      } else {
        toast.error(json.error?.message || 'Error al eliminar índice');
      }
    } catch {
      toast.error('Error al eliminar índice INPC');
    }
  };

  const handleSeedDefaultChart = async () => {
    setIsSeedingAccounts(true);
    try {
      const res = await fetch('/api/accounting/accounts/seed-default', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || 'Plan de cuentas estándar sembrado');
        fetchPeriods();
      } else {
        toast.error(json.error?.message || 'Error al inicializar catálogo');
      }
    } catch {
      toast.error('Error al sembrar catálogo contable');
    } finally {
      setIsSeedingAccounts(false);
    }
  };

  const getMonthName = (m: number) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    return months[m - 1] || `Mes ${m}`;
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#333333] dark:text-[#E0E0E0] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#007BFF] dark:text-[#3D91FF]" />
            Control de Cierres, Auditoría y Ajustes VEN-NIF
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Bloqueo mensual de períodos contables, reexpresión por inflación (REI) y regularización cambiaria BCV
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSeedDefaultChart}
            disabled={isSeedingAccounts}
            variant="outline"
            className="text-xs rounded-lg flex items-center gap-1.5 border-gray-300 dark:border-gray-700"
          >
            <BookOpen className="w-4 h-4 text-[#007BFF]" />
            {isSeedingAccounts ? 'Inicializando...' : 'Verificar Catálogo VEN-NIF'}
          </Button>
        </div>
      </div>

      {/* Sección 1: Control de Períodos Fiscales Mensuales */}
      <Card className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-[#333333] dark:text-[#E0E0E0] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#007BFF] dark:text-[#3D91FF]" />
              Períodos Fiscales Mensuales del Ejercicio {periods[0]?.year || new Date().getFullYear()}
            </h2>
            <p className="text-xs text-gray-500">
              El bloqueo de un período impide asentar comprobantes retroactivos sin autorización especial
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {periods.map((p) => {
            const isOpen = p.status === 'OPEN';
            const isClosed = p.status === 'CLOSED';
            const isLocked = p.status === 'LOCKED';

            return (
              <div
                key={p.id}
                className={`p-4 rounded-lg border transition-all ${
                  isOpen
                    ? 'border-blue-200 bg-blue-50/30 dark:bg-blue-950/20 dark:border-blue-900'
                    : isClosed
                      ? 'border-amber-200 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-900'
                      : 'border-gray-200 bg-gray-50/60 dark:bg-gray-800/40 dark:border-gray-800'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-sm text-[#333333] dark:text-[#E0E0E0]">
                      {getMonthName(p.month)} {p.year}
                    </h3>
                    <span className="text-[11px] text-gray-500 font-mono">
                      {p.startDate.slice(5)} al {p.endDate.slice(5)}
                    </span>
                  </div>
                  <Badge
                    variant={isOpen ? 'info' : isClosed ? 'warning' : 'neutral'}
                    className="text-[10px] px-1.5 py-0.5 rounded-lg"
                  >
                    {isOpen ? 'Abierto' : isClosed ? 'Cerrado' : 'Bloqueado'}
                  </Badge>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-1.5">
                  {isOpen && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2 text-amber-600 hover:text-amber-700 rounded-lg flex items-center gap-1"
                      onClick={() => handleUpdatePeriodStatus(p.id, 'CLOSED')}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Cerrar
                    </Button>
                  )}
                  {isClosed && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2 text-emerald-600 hover:text-emerald-700 rounded-lg flex items-center gap-1"
                        onClick={() => handleUpdatePeriodStatus(p.id, 'OPEN')}
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        Reabrir
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2 text-red-600 hover:text-red-700 rounded-lg flex items-center gap-1"
                        onClick={() => handleUpdatePeriodStatus(p.id, 'LOCKED')}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Bloquear
                      </Button>
                    </>
                  )}
                  {isLocked && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2 text-blue-600 hover:text-blue-700 rounded-lg flex items-center gap-1"
                      onClick={() => handleUpdatePeriodStatus(p.id, 'OPEN')}
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      Desbloquear
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Sección 2: Regularización por Fluctuación Cambiaria */}
      <Card className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-base font-bold text-[#333333] dark:text-[#E0E0E0] flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-[#17A2B8] dark:text-[#20C997]" />
              Ajuste por Diferencia en Cambio (Cuentas en Divisas)
            </h2>
            <p className="text-xs text-gray-500">
              Revalúa los saldos de bancos y cuentas por cobrar/pagar en USD a la tasa oficial BCV de cierre
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Tasa BCV Cierre:</span>
              <Input
                type="number"
                step="0.01"
                value={rateForDiff}
                onChange={(e) => setRateForDiff(parseFloat(e.target.value) || 1)}
                className="w-28 text-xs font-mono rounded-lg"
              />
            </div>
            <Button
              onClick={handleCalculateExchangeDiff}
              disabled={isCalculatingDiff}
              className="bg-[#17A2B8] hover:bg-cyan-600 text-white text-xs rounded-lg"
            >
              {isCalculatingDiff ? 'Calculando...' : 'Simular Diferencia Cambiaria'}
            </Button>
          </div>
        </div>

        {exchangeDiffResult && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-200 dark:border-gray-800 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-gray-700 dark:text-gray-300">
                Resultado Neto de Fluctuación Cambiaria:
              </span>
              <span
                className={`text-sm font-bold font-mono ${
                  exchangeDiffResult.isNetGain ? 'text-[#28A745]' : 'text-red-500'
                }`}
              >
                {exchangeDiffResult.isNetGain ? 'Ganancia Cambiaria: ' : 'Pérdida Cambiaria: '}
                {formatMoneyVES(Math.abs(exchangeDiffResult.netDifferenceVes))}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#F4F6F9] dark:bg-[#18191A] font-semibold text-gray-600">
                  <tr>
                    <th className="py-2 px-3">Cuenta Extranjera</th>
                    <th className="py-2 px-3 text-right">Saldo en Divisas (USD)</th>
                    <th className="py-2 px-3 text-right">Saldo Actual (VES)</th>
                    <th className="py-2 px-3 text-right">Saldo Revaluado BCV</th>
                    <th className="py-2 px-3 text-right">Ajuste Requerido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {exchangeDiffResult.accounts.map((acc: any) => (
                    <tr key={acc.id}>
                      <td className="py-2 px-3 font-mono">
                        {acc.code} - {acc.name}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{formatMoneyUSD(acc.currentBalanceUsd)}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatMoneyVES(acc.currentBalanceVes)}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatMoneyVES(acc.targetBalanceVes)}</td>
                      <td
                        className={`py-2 px-3 text-right font-mono font-bold ${
                          acc.isGain ? 'text-[#28A745]' : 'text-red-500'
                        }`}
                      >
                        {acc.isGain ? '+' : ''}{formatMoneyVES(acc.differenceVes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Sección 3: Índices INPC del BCV y Motor VEN-NIF B-10 */}
      <Card className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-base font-bold text-[#333333] dark:text-[#E0E0E0] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#28A745] dark:text-[#4ADE80]" />
              Índice Nacional de Precios al Consumidor (INPC - BCV) & Reexpresión
            </h2>
            <p className="text-xs text-gray-500">
              Serie oficial del Banco Central de Venezuela para el Ajuste por Inflación según Norma VEN-NIF B-10
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsInpcModalOpen(true)}
              variant="outline"
              className="text-xs rounded-lg flex items-center gap-1.5 border-gray-300 dark:border-gray-700"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              Registrar INPC BCV
            </Button>
          </div>
        </div>

        {/* Panel de Configuración de Reexpresión */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-200 dark:border-gray-800 space-y-3">
          <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
            Parámetros de Reexpresión y Cierre Contable:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                Año Cierre
              </label>
              <Input
                type="number"
                value={targetYear}
                onChange={(e) => setTargetYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                className="text-xs font-mono rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                Mes Cierre
              </label>
              <select
                value={targetMonth}
                onChange={(e) => setTargetMonth(parseInt(e.target.value, 10))}
                className="w-full text-xs py-2 px-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m} - {getMonthName(m)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                Año Base
              </label>
              <Input
                type="number"
                value={baseYear}
                onChange={(e) => setBaseYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                className="text-xs font-mono rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                Mes Base
              </label>
              <select
                value={baseMonth}
                onChange={(e) => setBaseMonth(parseInt(e.target.value, 10))}
                className="w-full text-xs py-2 px-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m} - {getMonthName(m)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Button
                onClick={handleCalculateInflation}
                disabled={isCalculatingInflation}
                className="w-full bg-[#28A745] hover:bg-green-600 text-white text-xs rounded-lg"
              >
                {isCalculatingInflation ? 'Calculando...' : 'Calcular REI (VEN-NIF)'}
              </Button>
            </div>
          </div>
        </div>

        {inflationResult && (
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800 space-y-2 text-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-bold">
              <span className="text-[#333333] dark:text-[#E0E0E0]">
                Factor de Inflación Acumulado: {Number(inflationResult.factor).toFixed(4)} (INPC Cierre {inflationResult.inpcClosing} / Base {inflationResult.inpcBase})
              </span>
              <span className="font-mono text-[#28A745] text-sm">
                REI Neto del Ejercicio: {formatMoneyVES(inflationResult.netReiResultVes)}
              </span>
            </div>

            {inflationResult.reexpressions && inflationResult.reexpressions.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-emerald-100/60 dark:bg-emerald-900/30 text-gray-700 dark:text-gray-300">
                    <tr>
                      <th className="py-2 px-3">Cuenta No Monetaria</th>
                      <th className="py-2 px-3 text-right">Saldo Histórico (VES)</th>
                      <th className="py-2 px-3 text-right">Saldo Reexpresado (VES)</th>
                      <th className="py-2 px-3 text-right">Ajuste REI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-200 dark:divide-emerald-800">
                    {inflationResult.reexpressions.map((r: any) => (
                      <tr key={r.id}>
                        <td className="py-1.5 px-3 font-mono">
                          {r.code} - {r.name}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono">{formatMoneyVES(r.historicalBalance)}</td>
                        <td className="py-1.5 px-3 text-right font-mono">{formatMoneyVES(r.reexpressedBalance)}</td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-emerald-600">
                          {formatMoneyVES(r.adjustment)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#F4F6F9] dark:bg-[#18191A] font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="py-2.5 px-4">Año / Período</th>
                <th className="py-2.5 px-4">Mes</th>
                <th className="py-2.5 px-4 text-right">Valor INPC Oficial (BCV)</th>
                <th className="py-2.5 px-4 text-right">Variación Mensual (%)</th>
                <th className="py-2.5 px-4 text-center">Fecha Publicación</th>
                <th className="py-2.5 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-[#242526]">
              {inpcList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    No hay índices INPC registrados. Haga clic en &quot;Registrar INPC BCV&quot; para ingresar los valores oficiales.
                  </td>
                </tr>
              ) : (
                inpcList.map((inpc) => (
                  <tr key={inpc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-2 px-4 font-mono font-medium">{inpc.year}</td>
                    <td className="py-2 px-4">{getMonthName(inpc.month)}</td>
                    <td className="py-2 px-4 text-right font-mono font-bold text-[#007BFF] dark:text-[#3D91FF]">
                      {inpc.inpcValue.toFixed(4)}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-gray-600 dark:text-gray-300">
                      +{inpc.variationMonthly.toFixed(2)}%
                    </td>
                    <td className="py-2 px-4 text-center text-gray-400 font-mono">
                      {inpc.publishedDate || 'Oficial BCV'}
                    </td>
                    <td className="py-2 px-4 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteInpc(inpc.id, `${inpc.year}-${inpc.month}`)}
                        className="text-red-500 hover:text-red-700 h-6 w-6 p-0 rounded-lg inline-flex items-center justify-center"
                        title="Eliminar índice"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal para Registrar/Editar INPC Oficial del BCV */}
      {isInpcModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#242526] rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-base font-bold text-[#333333] dark:text-[#E0E0E0] flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#28A745]" />
                Registrar Índice Oficial INPC (BCV)
              </h3>
              <button
                onClick={() => setIsInpcModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInpc} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Año Fiscal
                  </label>
                  <Input
                    type="number"
                    value={inpcForm.year}
                    onChange={(e) => setInpcForm({ ...inpcForm, year: parseInt(e.target.value, 10) || 2026 })}
                    required
                    className="font-mono rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Mes
                  </label>
                  <select
                    value={inpcForm.month}
                    onChange={(e) => setInpcForm({ ...inpcForm, month: parseInt(e.target.value, 10) })}
                    className="w-full py-2 px-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m} - {getMonthName(m)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Valor Oficial INPC (BCV)
                </label>
                <Input
                  type="number"
                  step="0.0001"
                  placeholder="Ej: 1245.8900"
                  value={inpcForm.inpcValue}
                  onChange={(e) => setInpcForm({ ...inpcForm, inpcValue: e.target.value })}
                  required
                  className="font-mono rounded-lg"
                />
                <span className="text-[10px] text-gray-500">
                  Valor publicado por el Banco Central de Venezuela para el mes
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Variación Mensual (%)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ej: 1.50"
                    value={inpcForm.variationMonthly}
                    onChange={(e) => setInpcForm({ ...inpcForm, variationMonthly: e.target.value })}
                    className="font-mono rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fecha Publicación
                  </label>
                  <Input
                    type="date"
                    value={inpcForm.publishedDate}
                    onChange={(e) => setInpcForm({ ...inpcForm, publishedDate: e.target.value })}
                    className="rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInpcModalOpen(false)}
                  className="rounded-lg text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingInpc}
                  className="bg-[#28A745] hover:bg-green-600 text-white rounded-lg text-xs"
                >
                  {isSavingInpc ? 'Guardando...' : 'Guardar Índice BCV'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default FiscalClosingView;
