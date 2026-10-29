import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { Check, ArrowRight, ArrowLeft, CheckCircle, FileText, AlertCircle, RefreshCw, DollarSign, Percent } from 'lucide-react';
import { formatMoneyUSD } from '../../utils/formatters';
import { useAuthStore } from '../../stores/authStore';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';
import { toast } from 'sonner';

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface PreviewItem {
  productId: string;
  sku: string;
  name: string;
  costPrice: number;
  oldBasePrice: number;
  newBasePrice: number;
  oldFinalPrice: number;
  newFinalPrice: number;
  taxRate: number;
  priceDifference: number;
  percentageChange: number;
  departmentName?: string;
  groupName?: string;
}

interface PreviewSummary {
  totalProductsMatched: number;
  avgPercentageChange: number;
  mode: string;
  value: number;
  roundingRule: number;
}

export const BulkPriceUpdateWizard: React.FC = () => {
  const token = useAuthStore((s) => s.token);
  const [currentStep, setCurrentStep] = useState(1);

  // Departamentos desde backend
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  // Criterios de Selección
  const [criteria, setCriteria] = useState({
    productType: 'all',
    department: 'ALL',
    minPrice: '',
    maxPrice: '',
  });

  // Acciones y Reglas de Negocio
  const [action, setAction] = useState({
    mode: 'percentage', // percentage, fixed_amount, margin_over_cost, absolute_price
    value: 10,
    roundingRule: 0.10, // 0, 0.05, 0.10, 0.50, 1.00
    taxAffectsFinalPrice: false, // Regla tributaria SENIAT
    priceMode: 'tax_exclusive',
    reason: 'Ajuste general por reposición de inventario e inflación',
  });

  // Preview State
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [previewSummary, setPreviewSummary] = useState<PreviewSummary | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    batchId: string;
    batchNumber: string;
    affectedCount: number;
    appliedAt: string;
  } | null>(null);

  // PDF Modal
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    endpoint: string | null;
    title: string;
    filename?: string;
  }>({
    isOpen: false,
    endpoint: null,
    title: '',
  });

  // Cargar departamentos reales
  useEffect(() => {
    const fetchDepartments = async () => {
      setLoadingDepartments(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch('/api/inventory/departments', { headers });
        if (res.ok) {
          const json = await res.json();
          setDepartments(Array.isArray(json.data) ? json.data : []);
        }
      } catch (err) {
        console.error('Error cargando departamentos:', err);
      } finally {
        setLoadingDepartments(false);
      }
    };
    fetchDepartments();
  }, [token]);

  // Ejecutar Simulación (Preview) al ingresar al paso 4
  const fetchPreview = useCallback(async () => {
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const payload = {
        criteria: {
          productType: criteria.productType as any,
          departmentIds: criteria.department !== 'ALL' ? [criteria.department] : undefined,
          minCurrentPrice: criteria.minPrice ? Number(criteria.minPrice) : undefined,
          maxCurrentPrice: criteria.maxPrice ? Number(criteria.maxPrice) : undefined,
        },
        action: {
          mode: action.mode as any,
          value: Number(action.value),
          roundingRule: Number(action.roundingRule),
          taxAffectsFinalPrice: action.taxAffectsFinalPrice,
          priceMode: action.priceMode as any,
          reason: action.reason.trim() || 'Ajuste general de precios',
        },
      };

      const res = await fetch('/api/pricing/bulk-update/preview', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error?.message || 'Error al generar la vista previa de precios');
      }

      const json = await res.json();
      const data = json.data;
      setPreviewItems(data.samplePreview || []);
      setPreviewSummary({
        totalProductsMatched: data.totalProductsMatched || 0,
        avgPercentageChange: data.summary?.avgPercentageChange || 0,
        mode: data.summary?.mode || action.mode,
        value: data.summary?.value || action.value,
        roundingRule: data.summary?.roundingRule || action.roundingRule,
      });
    } catch (err: any) {
      setPreviewError(err.message || 'Error al simular precios');
      toast.error(err.message || 'Error al simular precios');
    } finally {
      setLoadingPreview(false);
    }
  }, [token, criteria, action]);

  const handleStepChange = (targetStep: number) => {
    if (targetStep === 4) {
      fetchPreview();
    }
    setCurrentStep(targetStep);
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const payload = {
        criteria: {
          productType: criteria.productType as any,
          departmentIds: criteria.department !== 'ALL' ? [criteria.department] : undefined,
          minCurrentPrice: criteria.minPrice ? Number(criteria.minPrice) : undefined,
          maxCurrentPrice: criteria.maxPrice ? Number(criteria.maxPrice) : undefined,
        },
        action: {
          mode: action.mode as any,
          value: Number(action.value),
          roundingRule: Number(action.roundingRule),
          taxAffectsFinalPrice: action.taxAffectsFinalPrice,
          priceMode: action.priceMode as any,
          reason: action.reason.trim() || 'Ajuste masivo de precios',
        },
      };

      const res = await fetch('/api/pricing/bulk-update/execute', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error?.message || 'Error al ejecutar cambio masivo de precios');
      }

      const json = await res.json();
      const data = json.data;
      setExecutionResult({
        batchId: data.batchId,
        batchNumber: data.batchNumber,
        affectedCount: data.affectedCount,
        appliedAt: new Date(data.appliedAt || Date.now()).toLocaleString('es-VE'),
      });
      toast.success(`Lote ${data.batchNumber} aplicado exitosamente`);
      setCurrentStep(5);
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar la actualización masiva');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Encabezado */}
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          Cambio Masivo de Precios & Reglas Fiscales
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Asistente guiado para actualización de listas de precios con impacto tributario controlado (SENIAT) y redondeo comercial
        </p>
      </div>

      {/* Stepper de Progreso */}
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
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
                  : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              {currentStep > s.step ? <Check className="w-4 h-4" /> : s.step}
            </div>
            <span
              className={`text-xs font-medium hidden sm:inline ${
                currentStep === s.step
                  ? 'text-neutral-900 dark:text-neutral-100 font-semibold'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Paso 1: Criterios de Selección */}
      {currentStep === 1 && (
        <Card title="Paso 1: Definir Criterios de Selección" subtitle="Seleccione el universo de productos a modificar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Departamento</label>
              <select
                value={criteria.department}
                onChange={(e) => setCriteria({ ...criteria, department: e.target.value })}
                disabled={loadingDepartments}
                className="w-full h-10 px-3 mt-1 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <option value="ALL">Todos los Departamentos</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Tipo de Producto</label>
              <select
                value={criteria.productType}
                onChange={(e) => setCriteria({ ...criteria, productType: e.target.value })}
                className="w-full h-10 px-3 mt-1 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <option value="all">Todos los Tipos</option>
                <option value="physical">Físico / Terminado</option>
                <option value="service">Servicio</option>
                <option value="kit">Kit / Combo</option>
                <option value="raw_material">Materia Prima</option>
              </select>
            </div>

            <Input
              label="Precio Base Mínimo ($ USD)"
              placeholder="0.00"
              type="number"
              value={criteria.minPrice}
              onChange={(e) => setCriteria({ ...criteria, minPrice: e.target.value })}
            />

            <Input
              label="Precio Base Máximo ($ USD)"
              placeholder="Sin límite superior"
              type="number"
              value={criteria.maxPrice}
              onChange={(e) => setCriteria({ ...criteria, maxPrice: e.target.value })}
            />
          </div>

          <div className="flex justify-end mt-6">
            <Button onClick={() => handleStepChange(2)}>
              Siguiente: Modo de Cambio
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Paso 2: Modo de Actualización & Redondeo */}
      {currentStep === 2 && (
        <Card title="Paso 2: Modo de Actualización & Redondeo" subtitle="Defina la fórmula de ajuste de precios">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-2">
            {[
              { id: 'percentage', label: 'Porcentaje (+/- %)', desc: 'Ej: +10% sobre el precio actual' },
              { id: 'fixed_amount', label: 'Monto Fijo (+/- $)', desc: 'Ej: +0.50$ fijos a cada producto' },
              { id: 'margin_over_cost', label: 'Margen sobre Costo (%)', desc: 'Ej: Costo + 30% de ganancia' },
              { id: 'absolute_price', label: 'Precio Fijo Absoluto ($)', desc: 'Fija exactamente el mismo precio' },
            ].map((m) => (
              <div
                key={m.id}
                onClick={() => setAction({ ...action, mode: m.id })}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  action.mode === m.id
                    ? 'border-sky-600 bg-sky-50/50 dark:bg-sky-950/30 ring-2 ring-sky-500'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{m.label}</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{m.desc}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            <Input
              label={`Valor a Aplicar (${action.mode === 'fixed_amount' || action.mode === 'absolute_price' ? '$ USD' : '%'})`}
              type="number"
              value={action.value}
              onChange={(e) => setAction({ ...action, value: Number(e.target.value) })}
            />

            <div>
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Regla de Redondeo Comercial</label>
              <select
                value={action.roundingRule}
                onChange={(e) => setAction({ ...action, roundingRule: Number(e.target.value) })}
                className="w-full h-10 px-3 mt-1 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
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
            <Button variant="outline" onClick={() => handleStepChange(1)}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Atrás
            </Button>
            <Button onClick={() => handleStepChange(3)}>
              Siguiente: Reglas Tributarias
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Paso 3: Reglas Tributarias */}
      {currentStep === 3 && (
        <Card title="Paso 3: Reglas Tributarias (IVA & Precio Final)" subtitle="Controle la afectación del impuesto en el PVP según normativa SENIAT">
          <div className="space-y-4 mt-2">
            <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-start justify-between">
              <div className="max-w-xl">
                <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  ¿Afecta el Precio Final al Público (PVP)?
                </span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
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
              label="Motivo o Justificación del Cambio (Auditoría Fiscal)"
              value={action.reason}
              onChange={(e) => setAction({ ...action, reason: e.target.value })}
              placeholder="Ej: Reposición de inventario con nueva tasa BCV o incremento de costos"
            />
          </div>

          <div className="flex items-center justify-between mt-6">
            <Button variant="outline" onClick={() => handleStepChange(2)}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Atrás
            </Button>
            <Button onClick={() => handleStepChange(4)}>
              Siguiente: Simulación en Vivo
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Paso 4: Simulación en Vivo */}
      {currentStep === 4 && (
        <Card title="Paso 4: Simulación en Vivo del Impacto" subtitle="Verifique los nuevos precios y márgenes antes de confirmar la ejecución">
          {loadingPreview ? (
            <div className="py-8 space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm text-neutral-500">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                <span>Consultando productos y calculando simulación tributaria...</span>
              </div>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : previewError ? (
            <div className="py-6 text-center text-red-600 dark:text-red-400 flex flex-col items-center">
              <AlertCircle className="w-8 h-8 mb-2" />
              <p className="text-sm font-semibold">{previewError}</p>
              <Button size="sm" variant="outline" onClick={fetchPreview} className="mt-3">
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Reintentar Simulación
              </Button>
            </div>
          ) : (
            <div>
              {/* Tarjetas de Resumen */}
              {previewSummary && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">Productos Coincidentes</span>
                    <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                      {previewSummary.totalProductsMatched} artículos
                    </div>
                  </div>
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">Variación Promedio</span>
                    <div className="text-lg font-bold text-sky-600">
                      {previewSummary.avgPercentageChange > 0 ? `+${previewSummary.avgPercentageChange}%` : `${previewSummary.avgPercentageChange}%`}
                    </div>
                  </div>
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">Regla de Redondeo</span>
                    <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                      {previewSummary.roundingRule === 0 ? 'Sin Redondeo' : `Múltiplos de $${previewSummary.roundingRule}`}
                    </div>
                  </div>
                </div>
              )}

              {/* Tabla de Productos Simulados */}
              <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 uppercase text-neutral-500 dark:text-neutral-400">
                    <tr>
                      <th className="py-2.5 px-3">SKU / Producto</th>
                      <th className="py-2.5 px-3">Costo</th>
                      <th className="py-2.5 px-3">Base Actual</th>
                      <th className="py-2.5 px-3">IVA</th>
                      <th className="py-2.5 px-3">PVP Actual</th>
                      <th className="py-2.5 px-3 text-sky-700 dark:text-sky-400 font-bold">Nueva Base</th>
                      <th className="py-2.5 px-3 text-sky-700 dark:text-sky-400 font-bold">Nuevo PVP</th>
                      <th className="py-2.5 px-3 text-right">Variación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {previewItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-neutral-500 dark:text-neutral-400">
                          No se encontraron productos que coincidan con los criterios seleccionados.
                        </td>
                      </tr>
                    ) : (
                      previewItems.map((it) => (
                        <tr key={it.productId} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-neutral-900 dark:text-neutral-100">{it.name}</div>
                            <div className="text-[10px] text-neutral-400 font-mono">
                              {it.sku} {it.departmentName && `• ${it.departmentName}`}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-300">{formatMoneyUSD(it.costPrice)}</td>
                          <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-300">{formatMoneyUSD(it.oldBasePrice)}</td>
                          <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-300">{it.taxRate}%</td>
                          <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-300">{formatMoneyUSD(it.oldFinalPrice)}</td>
                          <td className="py-2.5 px-3 font-bold text-sky-700 dark:text-sky-400">{formatMoneyUSD(it.newBasePrice)}</td>
                          <td className="py-2.5 px-3 font-bold text-sky-700 dark:text-sky-400">{formatMoneyUSD(it.newFinalPrice)}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                            {it.priceDifference >= 0 ? `+${it.priceDifference.toFixed(2)}$` : `${it.priceDifference.toFixed(2)}$`} ({it.percentageChange > 0 ? `+${it.percentageChange}%` : `${it.percentageChange}%`})
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-6">
            <Button variant="outline" onClick={() => handleStepChange(3)}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Atrás
            </Button>
            <Button onClick={handleExecute} isLoading={isExecuting} disabled={previewItems.length === 0 || loadingPreview}>
              <CheckCircle className="w-4 h-4 mr-1.5" />
              Confirmar y Aplicar Lote en Base de Datos
            </Button>
          </div>
        </Card>
      )}

      {/* Paso 5: Confirmación de Lote */}
      {currentStep === 5 && executionResult && (
        <Card className="text-center py-8">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">¡Lote de Precios Aplicado Exitosamente!</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Se actualizaron <span className="font-semibold text-neutral-800 dark:text-neutral-200">{executionResult.affectedCount} productos</span> en el catálogo activo de la empresa.
          </p>

          <div className="inline-flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-lg text-xs font-mono text-neutral-700 dark:text-neutral-300 my-4">
            <span>Número de Lote:</span>
            <span className="font-bold text-sky-700 dark:text-sky-400">{executionResult.batchNumber}</span>
          </div>

          <div className="flex items-center justify-center gap-3 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPdfModal({
                  isOpen: true,
                  endpoint: `/api/pricing/bulk-update/batches/${executionResult.batchId || executionResult.batchNumber}/pdf`,
                  title: `Reporte de Lote de Precios ${executionResult.batchNumber}`,
                  filename: `reporte_lote_precios_${executionResult.batchNumber}.pdf`,
                });
              }}
            >
              <FileText className="w-4 h-4 mr-1.5 text-sky-600" />
              Ver / Descargar Reporte PDF
            </Button>
            <Button size="sm" onClick={() => handleStepChange(1)}>
              Nuevo Cambio de Precios
            </Button>
          </div>
        </Card>
      )}

      {/* Modal Visor / Descarga PDF de Modificación de Precios */}
      <PdfViewerModal
        isOpen={pdfModal.isOpen}
        onClose={() => setPdfModal((prev) => ({ ...prev, isOpen: false }))}
        title={pdfModal.title}
        endpoint={pdfModal.endpoint}
        filename={pdfModal.filename}
      />
    </div>
  );
};
