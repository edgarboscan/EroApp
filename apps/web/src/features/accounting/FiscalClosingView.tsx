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
      const res = await fetch(`/api/accounting/inflation/calculate?year=2026&month=10`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setInflationResult(json.data);
          toast.success('Ajuste por inflación (VEN-NIF B-10) calculado');
        }
      }
    } catch {
      toast.error('Error al calcular ajuste por inflación');
    } finally {
      setIsCalculatingInflation(false);
    }
  };

  const getMonthName = (m: number) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[m - 1] || `Mes ${m}`;
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#333333] dark:text-[#E0E0E0] flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#007BFF] dark:text-[#3D91FF]" />
            Control de Cierres, Auditoría y Ajustes VEN-NIF
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Bloqueo mensual de períodos contables, reexpresión por inflación (REI) y regularización cambiaria BCV
          </p>
        </div>
      </div>

      {/* Sección 1: Control de Períodos Fiscales Mensuales */}
      <Card className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-[#333333] dark:text-[#E0E0E0] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#007BFF] dark:text-[#3D91FF]" />
              Períodos Fiscales Mensuales del Ejercicio 2026
            </h2>
            <p className="text-xs text-gray-500">
              El bloqueo de un período impide asentar comprobantes retroactivos sin autorización especial
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {periods.map((p) => {
            const isOpen = p.status === 'OPEN';
            const isLocked = p.status === 'LOCKED';

            return (
              <div
                key={p.id}
                className={`p-3.5 rounded-lg border flex flex-col justify-between transition-colors ${
                  isLocked
                    ? 'bg-gray-50/70 dark:bg-gray-800/30 border-gray-300 dark:border-gray-700'
                    : 'bg-white dark:bg-[#242526] border-blue-200 dark:border-blue-900/40 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm text-[#333333] dark:text-[#E0E0E0]">
                      {getMonthName(p.month)} {p.year}
                    </span>
                    <Badge variant={isLocked ? 'danger' : isOpen ? 'success' : 'warning'} className="text-[10px]">
                      {isLocked ? 'Bloqueado' : isOpen ? 'Abierto' : 'Cerrado'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {p.startDate} al {p.endDate}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                  <span className="text-[10px] text-gray-400">
                    {p.closedByName ? `Por: ${p.closedByName}` : 'Sin cierre'}
                  </span>
                  <div>
                    {isLocked ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdatePeriodStatus(p.id, 'OPEN')}
                        className="text-xs py-0.5 px-2 h-7 rounded text-green-600 border-green-300 hover:bg-green-50"
                        title="Desbloquear período para permitir asientos"
                      >
                        <Unlock className="w-3.5 h-3.5 mr-1" />
                        Abrir
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdatePeriodStatus(p.id, 'LOCKED')}
                        className="text-xs py-0.5 px-2 h-7 rounded text-red-600 border-red-300 hover:bg-red-50"
                        title="Bloquear período contra modificaciones"
                      >
                        <Lock className="w-3.5 h-3.5 mr-1" />
                        Bloquear
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Sección 2: Ajuste por Fluctuación Cambiaria Oficial (BCV) */}
      <Card className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-base font-bold text-[#333333] dark:text-[#E0E0E0] flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-[#17A2B8] dark:text-[#38C9DD]" />
              Ajuste por Diferencia en Cambio Oficial (Tasa BCV)
            </h2>
            <p className="text-xs text-gray-500">
              Valora saldos de cuentas en moneda extranjera (Caja USD, Custodia, Clientes y Proveedores) a la tasa de cierre
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-gray-600 dark:text-gray-300">Tasa BCV Cierre:</span>
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
              Serie oficial utilizada para el Ajuste por Inflación según Norma VEN-NIF B-10
            </p>
          </div>

          <Button
            onClick={handleCalculateInflation}
            disabled={isCalculatingInflation}
            className="bg-[#28A745] hover:bg-green-600 text-white text-xs rounded-lg"
          >
            {isCalculatingInflation ? 'Calculando...' : 'Calcular REI (VEN-NIF B-10)'}
          </Button>
        </div>

        {inflationResult && (
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800 space-y-2 text-xs">
            <div className="flex justify-between items-center font-bold">
              <span className="text-[#333333] dark:text-[#E0E0E0]">
                Factor de Inflación Acumulado: {inflationResult.factor.toFixed(4)} (INPC Cierre {inflationResult.inpcClosing} / Base {inflationResult.inpcBase})
              </span>
              <span className="font-mono text-[#28A745] text-sm">
                REI Neto del Ejercicio: {formatMoneyVES(inflationResult.netReiResultVes)}
              </span>
            </div>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-[#242526]">
              {inpcList.slice(0, 8).map((inpc) => (
                <tr key={inpc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-2 px-4 font-mono font-medium">{inpc.year}</td>
                  <td className="py-2 px-4">{getMonthName(inpc.month)}</td>
                  <td className="py-2 px-4 text-right font-mono font-bold text-[#007BFF] dark:text-[#3D91FF]">
                    {inpc.inpcValue.toFixed(2)}
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-gray-600 dark:text-gray-300">
                    +{inpc.variationMonthly.toFixed(2)}%
                  </td>
                  <td className="py-2 px-4 text-center text-gray-400 font-mono">
                    {inpc.publishedDate || 'Oficial BCV'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
export default FiscalClosingView;
