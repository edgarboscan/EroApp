import React from 'react';
import { ArrowUpRight, ArrowDownRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useExchangeRateStore, BcvLiveData } from '../stores/exchangeRateStore';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva Tasa Oficial BCV Detectada"
      subtitle="Publicación oficial del Banco Central de Venezuela"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isBcvSyncing}
          >
            Ahora no
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSync}
            disabled={isBcvSyncing}
          >
            {isBcvSyncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Actualizando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Actualizar Tasa Ahora
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
          Se ha detectado una actualización en la tasa oficial del dólar en el portal del BCV que
          difiere de la configurada actualmente en el sistema.
        </p>

        {/* Comparison Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Tasa Actual */}
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 rounded-lg flex flex-col gap-1">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Tasa en Sistema</span>
            <span className="text-base font-bold font-mono text-neutral-700 dark:text-neutral-200">
              Bs. {bcvData.currentSystemRate.toFixed(4)}
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Configuración actual</span>
          </div>

          {/* Nueva Tasa BCV */}
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 rounded-lg flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-neutral-900 dark:text-neutral-100">Nueva Tasa BCV</span>
            <span className="text-base font-bold font-mono text-neutral-900 dark:text-neutral-100">
              Bs. {bcvData.bcvRate.toFixed(4)}
            </span>
            <div className="flex items-center gap-1 text-[10px] font-medium">
              {isIncrease ? (
                <>
                  <ArrowUpRight className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-300 font-mono">
                    +{bcvData.difference.toFixed(4)}
                  </span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-3 h-3 text-red-600 dark:text-red-400" />
                  <span className="text-red-700 dark:text-red-300 font-mono">
                    {bcvData.difference.toFixed(4)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Fecha valor & Fuente */}
        <div className="text-xs bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 flex flex-col gap-1 text-neutral-600 dark:text-neutral-300">
          <div className="flex justify-between items-center">
            <span className="text-neutral-500 dark:text-neutral-400 font-medium">Fecha Valor:</span>
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
              {bcvData.bcvFormattedDate || bcvData.bcvEffectiveDate}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-500 dark:text-neutral-400 font-medium">Fuente:</span>
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{bcvData.source}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
