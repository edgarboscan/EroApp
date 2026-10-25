import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Edit, X, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { formatPercent } from '../../utils/formatters';
import { Modal } from '../../components/ui/Modal';

interface TaxRate {
  id: string;
  code: string;
  name: string;
  rate: number;
  type: string;
  isActive: boolean;
}

export const TaxRatesView: React.FC = () => {
  const [taxRates] = useState<TaxRate[]>([
    { id: 't1', code: 'IVA_16', name: 'IVA Alícuota General (16%)', rate: 16.0, type: 'IVA', isActive: true },
    { id: 't2', code: 'IVA_08', name: 'IVA Alícuota Reducida (8%)', rate: 8.0, type: 'IVA', isActive: true },
    { id: 't3', code: 'IGTF_03', name: 'IGTF Transacciones en Divisas (3%)', rate: 3.0, type: 'IGTF', isActive: true },
    { id: 't4', code: 'EXENTO', name: 'Productos y Servicios Exentos', rate: 0.0, type: 'EXENTO', isActive: true },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTax, setSelectedTax] = useState<TaxRate | null>(null);
  const [newRate, setNewRate] = useState<number>(16);
  const [affectsFinalPrice, setAffectsFinalPrice] = useState(false);
  const [reason, setReason] = useState('');

  const handleOpenModal = (tax: TaxRate) => {
    setSelectedTax(tax);
    setNewRate(tax.rate);
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Tasas de Impuestos & Reglas Fiscales</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Administración de alícuotas de IVA, IGTF y políticas de absorción o afectación en precio final
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {taxRates.map((t) => (
          <Card key={t.id} className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Badge variant={t.type === 'IVA' ? 'info' : t.type === 'IGTF' ? 'warning' : 'neutral'}>
                  {t.type}
                </Badge>
                <span className="text-xs font-mono text-neutral-400">{t.code}</span>
              </div>
              <h3 className="text-sm font-bold text-neutral-900">{t.name}</h3>
              <div className="text-3xl font-black text-sky-700 mt-3">{formatPercent(t.rate)}</div>
            </div>

            <div className="pt-4 mt-4 border-t border-neutral-100 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => handleOpenModal(t)}>
                <Edit className="w-3.5 h-3.5 mr-1" />
                Modificar Tasa
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal de Modificación de Tasa */}
      {selectedTax && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Modificar Tasa: ${selectedTax.name}`}
          subtitle="Ajuste de alícuota tributaria y recálculo automático de precios"
          size="lg"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  toast.success('Tasa actualizada y recálculo de precios ejecutado exitosamente.');
                  setIsModalOpen(false);
                }}
              >
                Aplicar Cambio & Recalcular
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Tasa Actual (%)" value={`${selectedTax.rate}%`} disabled />
              <Input
                label="Nueva Tasa (%)"
                type="number"
                value={newRate}
                onChange={(e) => setNewRate(Number(e.target.value))}
              />
            </div>

            {/* Regla de negocio tributaria */}
            <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    ¿Afecta el precio final al público?
                  </span>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {affectsFinalPrice
                      ? 'Los productos aumentarán su PVP al cliente final.'
                      : 'El PVP se mantendrá igual. La empresa absorberá el cambio en su margen reduciendo la base imponible.'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={affectsFinalPrice}
                  onChange={(e) => setAffectsFinalPrice(e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded mt-0.5 cursor-pointer accent-sky-600"
                />
              </div>
            </div>

            <Input
              label="Motivo del Cambio (Requerido por Auditoría)"
              placeholder="Ej: Reforma tributaria según Providencia Administrativa..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};
