import React from 'react';
import { ArrowUpRight, ArrowDownRight, RefreshCw, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useExchangeRateStore, BcvLiveData } from '../stores/exchangeRateStore';
import { toast } from 'sonner';

interface BcvRateAutoSyncModalProps {
  isOpen: boolean;
  bcvData: BcvLiveData | null;
  onClose: () => void;
}

export const BcvRateAutoSyncModal: React.FC<BcvRateAutoSyncModalProps> = ({
  isOpen,
  bcvData,
  onClose,
}) => {
  const syncWithBcv = useExchangeRateStore((s) => s.syncWithBcv);
  const isBcvSyncing = useExchangeRateStore((s) => s.isBcvSyncing);

  if (!isOpen || !bcvData) return null;

  const handleSync = async () => {
    try {
      await syncWithBcv();
      toast.success(
        `Tasa oficial actualizada automáticamente a Bs. ${bcvData.bcvRate.toFixed(4)} por USD`
      );
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error al sincronizar la tasa con el BCV');
    }
  };

  const isIncrease = bcvData.difference > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bcv-sync-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4"
    >
      <div className="w-full max-w-md bg-white rounded-lg border border-neutral-200 p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-50 text-sky-600 rounded-lg shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 id="bcv-sync-title" className="text-sm font-bold text-neutral-900">
                Nueva Tasa Oficial BCV Detectada
              </h3>
              <p className="text-xs text-neutral-500">
                Publicación oficial del Banco Central de Venezuela
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content notice */}
        <p className="text-xs text-neutral-600 leading-relaxed">
          Se ha detectado una actualización en la tasa oficial del dólar en el portal del BCV que
          difiere de la configurada actualmente en el sistema.
        </p>

        {/* Comparison Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Tasa Actual */}
          <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg flex flex-col gap-1">
            <span className="text-[11px] font-medium text-neutral-500">Tasa en Sistema</span>
            <span className="text-base font-bold font-mono text-neutral-700">
              Bs. {bcvData.currentSystemRate.toFixed(4)}
            </span>
            <span className="text-[10px] text-neutral-400">Configuración actual</span>
          </div>

          {/* Nueva Tasa BCV */}
          <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-lg flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-sky-800">Nueva Tasa BCV</span>
            <span className="text-base font-bold font-mono text-sky-700">
              Bs. {bcvData.bcvRate.toFixed(4)}
            </span>
            <div className="flex items-center gap-1 text-[10px] font-medium">
              {isIncrease ? (
                <>
                  <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700 font-mono">
                    +{bcvData.difference.toFixed(4)}
                  </span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-3 h-3 text-red-600" />
                  <span className="text-red-700 font-mono">
                    {bcvData.difference.toFixed(4)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Fecha valor & Fuente */}
        <div className="text-xs bg-neutral-50 border border-neutral-200 rounded-lg p-3 flex flex-col gap-1 text-neutral-600">
          <div className="flex justify-between items-center">
            <span className="text-neutral-500 font-medium">Fecha Valor:</span>
            <span className="font-semibold text-neutral-800">
              {bcvData.bcvFormattedDate || bcvData.bcvEffectiveDate}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-500 font-medium">Fuente:</span>
            <span className="font-semibold text-neutral-800">{bcvData.source}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isBcvSyncing}
            className="px-4 py-2 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-sky-500 transition-colors cursor-pointer disabled:opacity-50"
          >
            Ahora no
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={isBcvSyncing}
            className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 focus-visible:ring-2 focus-visible:ring-sky-500 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isBcvSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Actualizando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Actualizar Tasa Ahora</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
