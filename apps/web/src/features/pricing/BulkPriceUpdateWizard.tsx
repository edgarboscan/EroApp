import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Check, ArrowRight, ArrowLeft, CheckCircle, Download } from 'lucide-react';

export const BulkPriceUpdateWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [criteria, setCriteria] = useState({
    productType: 'all',
    department: 'DEP-ALM',
    minPrice: '',
    maxPrice: '',
  });

  const [action, setAction] = useState({
    mode: 'percentage', // percentage, fixed_amount, margin_over_cost
    value: 10,
    roundingRule: 0.10, // 0.05, 0.10, 0.50, 1.00
    taxAffectsFinalPrice: false, // Regla de negocio solicitada
    priceMode: 'tax_exclusive',
    reason: 'Ajuste general por inflación / reposición de inventario',
  });

  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);

  // Simulación de Preview
  const previewItems = [
    {
      sku: 'HAR-PAN-01',
      name: 'Harina PAN Blanca 1Kg',
      department: 'Alimentos y Víveres',
      oldCost: 1.00,
      oldBase: 1.40,
      taxRate: 0,
      oldFinal: 1.40,
      newBase: 1.50,
      newFinal: 1.50,
      diff: '+0.10 (+7.1%)',
    },
    {
      sku: 'LEC-POL-01',
      name: 'Leche en Polvo Completa 1Kg',
      department: 'Alimentos y Víveres',
      oldCost: 6.50,
      oldBase: 9.20,
      taxRate: 16,
      oldFinal: 10.67,
      newBase: 10.10,
      newFinal: 11.72,
      diff: '+0.90 (+9.8%)',
    },
    {
      sku: 'ARR-PRI-01',
      name: 'Arroz Primor Tradicional 1Kg',
      department: 'Alimentos y Víveres',
      oldCost: 0.90,
      oldBase: 1.30,
      taxRate: 0,
      oldFinal: 1.30,
      newBase: 1.40,
      newFinal: 1.40,
      diff: '+0.10 (+7.7%)',
    },
  ];

  const handleExecute = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setExecutionResult({
        batchNumber: `LOTE-${Date.now().toString().slice(-6)}`,
        affectedCount: 28,
        appliedAt: new Date().toLocaleString('es-VE'),
      });
      setCurrentStep(5);
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Encabezado */}
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Cambio Masivo de Precios & Reglas Fiscales</h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          Asistente guiado para actualización de listas de precios con impacto tributario controlado
        </p>
      </div>

      {/* Stepper de Progreso */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
        {[
          { step: 1, label: 'Criterios de Selección' },
          { step: 2, label: 'Modo de Cambio' },
          { step: 3, label: 'Reglas Tributarias' },
          { step: 4, label: 'Vista Previa en Vivo' },
          { step: 5, label: 'Confirmación' },
        ].map((s) => (
          <div key={s.step} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                currentStep === s.step
                  ? 'bg-sky-600 text-white'
                  : currentStep > s.step
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-200 text-neutral-600'
              }`}
            >
              {currentStep > s.step ? <Check className="w-4 h-4" /> : s.step}
            </div>
            <span
              className={`text-xs font-medium hidden sm:inline ${
                currentStep === s.step ? 'text-neutral-900 font-semibold' : 'text-neutral-500'
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Contenido por Paso */}
      {currentStep === 1 && (
        <Card title="Paso 1: Definir Criterios de Selección" subtitle="Seleccione el universo de productos a modificar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-neutral-700">Departamento</label>
              <select
                value={criteria.department}
                onChange={(e) => setCriteria({ ...criteria, department: e.target.value })}
                className="w-full h-10 px-3 mt-1 text-sm bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <option value="ALL">Todos los Departamentos</option>
                <option value="DEP-ALM">Alimentos y Víveres</option>
                <option value="DEP-FER">Ferretería y Construcción</option>
                <option value="DEP-ELE">Electrónica y Tecnología</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700">Tipo de Producto</label>
              <select
                value={criteria.productType}
                onChange={(e) => setCriteria({ ...criteria, productType: e.target.value })}
                className="w-full h-10 px-3 mt-1 text-sm bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <option value="all">Todos los Tipos</option>
                <option value="physical">Físico / Terminado</option>
                <option value="service">Servicio</option>
                <option value="raw_material">Materia Prima</option>
              </select>
            </div>

            <Input
              label="Precio Base Mínimo ($)"
              placeholder="0.00"
              type="number"
              value={criteria.minPrice}
              onChange={(e) => setCriteria({ ...criteria, minPrice: e.target.value })}
            />

            <Input
              label="Precio Base Máximo ($)"
              placeholder="Sin límite"
              type="number"
              value={criteria.maxPrice}
              onChange={(e) => setCriteria({ ...criteria, maxPrice: e.target.value })}
            />
          </div>

          <div className="flex justify-end mt-6">
            <Button onClick={() => setCurrentStep(2)}>
              Siguiente: Modo de Cambio
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 2 && (
        <Card title="Paso 2: Modo de Actualización & Redondeo" subtitle="Defina la fórmula de ajuste de precios">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            {[
              { id: 'percentage', label: 'Porcentaje (+/- %)', desc: 'Ej: +10% sobre el precio actual' },
              { id: 'fixed_amount', label: 'Monto Fijo (+/- $)', desc: 'Ej: +0.50$ fijos a cada producto' },
              { id: 'margin_over_cost', label: 'Margen sobre Costo (%)', desc: 'Ej: Costo + 30% de ganancia' },
            ].map((m) => (
              <div
                key={m.id}
                onClick={() => setAction({ ...action, mode: m.id })}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  action.mode === m.id
                    ? 'border-sky-600 bg-sky-50/50 ring-2 ring-sky-500'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="text-sm font-semibold text-neutral-900">{m.label}</div>
                <div className="text-xs text-neutral-500 mt-1">{m.desc}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            <Input
              label={`Valor a Aplicar (${action.mode === 'fixed_amount' ? '$ USD' : '%'})`}
              type="number"
              value={action.value}
              onChange={(e) => setAction({ ...action, value: Number(e.target.value) })}
            />

            <div>
              <label className="text-xs font-semibold text-neutral-700">Regla de Redondeo Comercial</label>
              <select
                value={action.roundingRule}
                onChange={(e) => setAction({ ...action, roundingRule: Number(e.target.value) })}
                className="w-full h-10 px-3 mt-1 text-sm bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <option value="0">Sin redondeo (2 decimales exactos)</option>
                <option value="0.05">Redondear a múltiplos de 0.05$</option>
                <option value="0.10">Redondear a múltiplos de 0.10$</option>
                <option value="0.50">Redondear a múltiplos de 0.50$</option>
                <option value="1.00">Redondear al entero superior (1.00$)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6">
            <Button variant="outline" onClick={() => setCurrentStep(1)}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Atrás
            </Button>
            <Button onClick={() => setCurrentStep(3)}>
              Siguiente: Reglas Tributarias
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 3 && (
        <Card title="Paso 3: Reglas Tributarias (IVA & Precio Final)" subtitle="Controle la afectación del impuesto en el PVP">
          <div className="space-y-4 mt-2">
            {/* Toggle de Afectación al Precio Final */}
            <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50 flex items-start justify-between">
              <div className="max-w-xl">
                <span className="text-sm font-semibold text-neutral-900">¿Afecta el Precio Final al Público (PVP)?</span>
                <p className="text-xs text-neutral-500 mt-1">
                  Si está activado, el aumento incrementará el precio que paga el consumidor final. Si está desactivado, el cambio se absorbe dentro del margen de ganancia de la empresa sin variar el PVP de venta.
                </p>
              </div>
              <input
                type="checkbox"
                checked={action.taxAffectsFinalPrice}
                onChange={(e) => setAction({ ...action, taxAffectsFinalPrice: e.target.checked })}
                className="w-5 h-5 text-sky-600 rounded mt-1 cursor-pointer focus:ring-sky-500"
              />
            </div>

            <Input
              label="Motivo o Justificación del Cambio (Auditoría)"
              value={action.reason}
              onChange={(e) => setAction({ ...action, reason: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between mt-6">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Atrás
            </Button>
            <Button onClick={() => setCurrentStep(4)}>
              Siguiente: Simulación en Vivo
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 4 && (
        <Card title="Paso 4: Simulación en Vivo del Impacto" subtitle="Verifique los precios antes de confirmar">
          <div className="overflow-x-auto mt-2 border border-neutral-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 uppercase text-neutral-500">
                <tr>
                  <th className="py-2.5 px-3">SKU / Producto</th>
                  <th className="py-2.5 px-3">Costo</th>
                  <th className="py-2.5 px-3">Base Actual</th>
                  <th className="py-2.5 px-3">IVA</th>
                  <th className="py-2.5 px-3">PVP Actual</th>
                  <th className="py-2.5 px-3 text-sky-700 font-bold">Nueva Base</th>
                  <th className="py-2.5 px-3 text-sky-700 font-bold">Nuevo PVP</th>
                  <th className="py-2.5 px-3 text-right">Variación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {previewItems.map((it, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50/50">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-neutral-900">{it.name}</div>
                      <div className="text-[10px] text-neutral-400 font-mono">{it.sku}</div>
                    </td>
                    <td className="py-2.5 px-3 text-neutral-600">${it.oldCost.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-neutral-600">${it.oldBase.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-neutral-600">{it.taxRate}%</td>
                    <td className="py-2.5 px-3 text-neutral-600">${it.oldFinal.toFixed(2)}</td>
                    <td className="py-2.5 px-3 font-bold text-sky-700">${it.newBase.toFixed(2)}</td>
                    <td className="py-2.5 px-3 font-bold text-sky-700">${it.newFinal.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-emerald-600">{it.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-6">
            <Button variant="outline" onClick={() => setCurrentStep(3)}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Atrás
            </Button>
            <Button onClick={handleExecute} isLoading={isExecuting}>
              <CheckCircle className="w-4 h-4 mr-1.5" />
              Confirmar y Aplicar Lote
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 5 && executionResult && (
        <Card className="text-center py-8">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900">¡Lote de Precios Aplicado Exitosamente!</h2>
          <p className="text-xs text-neutral-500 mt-1">
            Se actualizaron <span className="font-semibold text-neutral-800">{executionResult.affectedCount} productos</span> en el catálogo activo.
          </p>

          <div className="inline-flex items-center gap-2 bg-neutral-100 px-3 py-1.5 rounded-lg text-xs font-mono text-neutral-700 my-4">
            <span>Número de Lote:</span>
            <span className="font-bold text-sky-700">{executionResult.batchNumber}</span>
          </div>

          <div className="flex items-center justify-center gap-3 mt-4">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-1.5" />
              Descargar Reporte (PDF/Excel)
            </Button>
            <Button size="sm" onClick={() => setCurrentStep(1)}>
              Nuevo Cambio de Precios
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
