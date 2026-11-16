import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Printer, Copy, Check, Download, Tag, Settings, Sliders, RefreshCw, Network, Wifi, Globe, Cpu } from 'lucide-react';
import { toast } from 'sonner';
import {
  LabelPrintConfig,
  DEFAULT_LABEL_CONFIG,
  ProductLabelData,
  generateZpl,
  generateTspl,
  encodeCode128B,
} from '../../utils/barcode';
import { sendDirectToZebra } from '../../utils/zebraPrint';
import { useAuthStore } from '../../stores/authStore';
import { formatMoneyUSD, formatMoneyVES } from '../../utils/formatters';
import { useExchangeRateStore } from '../../stores/exchangeRateStore';

interface BarcodeLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  availablePresentations?: Array<any>;
  currentStock?: number;
}

const PRESET_SIZES = [
  { label: '50 x 30 mm (Estándar Retail)', width: 50, height: 30 },
  { label: '40 x 25 mm (Pequeña / Farmacia)', width: 40, height: 25 },
  { label: '58 x 40 mm (Mediana)', width: 58, height: 40 },
  { label: '100 x 50 mm (Almacén / Logística)', width: 100, height: 50 },
  { label: 'Personalizada', width: 0, height: 0 },
];

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  isOpen,
  onClose,
  product,
  availablePresentations = [],
  currentStock = 0,
}) => {
  const bcvRate = useExchangeRateStore((s) => s.rate) || 1;
  const token = useAuthStore((s) => s.token);

  // Cargar configuración guardada de localStorage o defaults
  const [config, setConfig] = useState<LabelPrintConfig>(() => {
    try {
      const saved = localStorage.getItem('ero_label_printer_config');
      if (saved) return { ...DEFAULT_LABEL_CONFIG, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_LABEL_CONFIG;
  });

  const [activeTab, setActiveTab] = useState<'preview' | 'zpl' | 'config'>('preview');
  const [selectedPresentationId, setSelectedPresentationId] = useState<string>('primary');
  const [copiedZpl, setCopiedZpl] = useState(false);
  const [isCustomSize, setIsCustomSize] = useState(false);
  const [isPrintingZebra, setIsPrintingZebra] = useState(false);
  const [isTestingZebra, setIsTestingZebra] = useState(false);

  // Probar conexión directa con la impresora Zebra enviando una etiqueta de test
  const handleTestZebraConnection = async () => {
    setIsTestingZebra(true);
    try {
      const testZpl = `^XA^PW350^LL160^CI28^FO20,20^A0N,24,24^FDCONEXION ZEBRA OK^FS^FO20,55^A0N,18,18^FDERO ERP - TEST PRINT^FS^FO20,85^BY1.5,2.5,35^BCN,35,Y,N,N^FDERO-OK^FS^XZ`;
      const res = await sendDirectToZebra(testZpl, config, token || undefined);
      toast.success(`Prueba exitosa: ${res.message}`);
    } catch (err: any) {
      toast.error(err?.message || 'No fue posible conectar con la impresora Zebra');
    } finally {
      setIsTestingZebra(false);
    }
  };

  useEffect(() => {
    setSelectedPresentationId('primary');
  }, [product?.sku, product?.id]);

  // Resolver datos del producto o presentación seleccionada
  const activeLabelData: ProductLabelData | null = useMemo(() => {
    if (!product) return null;

    // Normalizar precio base del producto
    const rawProdPriceUSD = Number(
      (typeof product.priceUSD === 'number' && !isNaN(product.priceUSD) ? product.priceUSD : null) ??
      (typeof product.basePrice === 'number' && !isNaN(product.basePrice) ? product.basePrice : null) ??
      (typeof product.price === 'number' && !isNaN(product.price) ? product.price : null) ??
      0
    );
    const rawProdPriceVES = Number(
      (typeof product.priceVES === 'number' && !isNaN(product.priceVES) ? product.priceVES : null) ??
      (rawProdPriceUSD * bcvRate)
    );

    const baseData: ProductLabelData = {
      name: product.name || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      priceUSD: rawProdPriceUSD,
      priceVES: rawProdPriceVES,
      presentationName: product.presentationName || undefined,
    };

    if (selectedPresentationId === 'primary') return baseData;

    const pres = availablePresentations.find(
      (p: any) => (p.id || p.presentationId) === selectedPresentationId
    );
    if (!pres) return baseData;

    const multiplier = Number(pres.multiplier) || 1;
    const presPriceUSD = Number(
      (typeof pres.price === 'number' && !isNaN(pres.price) ? pres.price : null) ??
      (typeof pres.basePrice === 'number' && !isNaN(pres.basePrice) ? pres.basePrice : null) ??
      (rawProdPriceUSD * multiplier)
    );
    const presPriceVES = Number(
      (typeof pres.priceVES === 'number' && !isNaN(pres.priceVES) ? pres.priceVES : null) ??
      (presPriceUSD * bcvRate)
    );

    return {
      name: `${product.name} (${pres.name})`,
      sku: pres.sku || product.sku || '',
      barcode: pres.barcode || product.barcode || '',
      priceUSD: presPriceUSD,
      priceVES: presPriceVES,
      presentationName: pres.name,
    };
  }, [product, selectedPresentationId, availablePresentations, bcvRate]);

  if (!isOpen || !activeLabelData) return null;

  const currentBarcode = activeLabelData.barcode || activeLabelData.sku || '00000000';
  const barcodePattern = encodeCode128B(currentBarcode);

  // Guardar configuración como predeterminada
  const handleSaveDefaultConfig = () => {
    try {
      localStorage.setItem('ero_label_printer_config', JSON.stringify(config));
      toast.success('Configuración de etiquetas guardada como predeterminada');
    } catch {
      toast.error('No se pudo guardar en el almacenamiento local');
    }
  };

  // Copiar código ZPL al portapapeles
  const handleCopyZpl = () => {
    const zpl = generateZpl(activeLabelData, config);
    navigator.clipboard.writeText(zpl);
    setCopiedZpl(true);
    toast.success('Código ZPL copiado al portapapeles');
    setTimeout(() => setCopiedZpl(false), 2000);
  };

  // Descargar archivo .zpl
  const handleDownloadZpl = () => {
    const zpl = generateZpl(activeLabelData, config);
    const blob = new Blob([zpl], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etiqueta_${activeLabelData.sku || 'zebra'}.zpl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Archivo .zpl descargado');
  };

  // Envío directo de comandos ZPL a impresora Zebra (sin previsualización ni ventanas emergentes)
  const handleDirectZebraPrint = async () => {
    if (!activeLabelData) return;
    setIsPrintingZebra(true);
    try {
      const zpl = generateZpl(activeLabelData, config);
      const res = await sendDirectToZebra(zpl, config, token || undefined);
      toast.success(res.message);
    } catch (err: any) {
      toast.error(err?.message || 'Error al conectar con la impresora Zebra');
    } finally {
      setIsPrintingZebra(false);
    }
  };

  // Impresión de etiquetas
  const handlePrintLabels = () => {
    if (config.printerType === 'zpl') {
      handleDirectZebraPrint();
      return;
    }

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '350px';
    printFrame.style.height = '350px';
    printFrame.style.border = '0';
    printFrame.style.opacity = '0.01';
    printFrame.style.pointerEvents = 'none';
    printFrame.style.zIndex = '-9999';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (!frameDoc) {
      window.print();
      return;
    }

    const labelHtml = document.getElementById('barcode-label-render-box')?.innerHTML || '';
    const numCopies = Math.max(1, config.copies);

    let allLabelsHtml = '';
    for (let i = 0; i < numCopies; i++) {
      allLabelsHtml += `
        <div class="label-page">
          ${labelHtml}
        </div>
      `;
    }

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Etiquetas - ${activeLabelData.sku}</title>
          <style>
            @page {
              size: ${config.widthMm}mm ${config.heightMm}mm;
              margin: 0mm;
            }
            *, *::before, *::after {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              color: #000000 !important;
              background-color: transparent !important;
              visibility: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              font-family: Arial, Helvetica, sans-serif !important;
            }
            .label-page {
              width: ${config.widthMm}mm !important;
              height: ${config.heightMm}mm !important;
              padding: 1.5mm !important;
              page-break-after: always !important;
              break-after: page !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: center !important;
              text-align: center !important;
              overflow: hidden !important;
            }
            .label-page:last-child {
              page-break-after: avoid !important;
              break-after: avoid !important;
            }
            .comp-name {
              font-size: 8px !important;
              font-weight: 700 !important;
              text-transform: uppercase !important;
              line-height: 1.1 !important;
              margin-bottom: 1px !important;
            }
            .prod-name {
              font-size: 9px !important;
              font-weight: 700 !important;
              line-height: 1.1 !important;
              max-height: 20px !important;
              overflow: hidden !important;
            }
            .barcode-box {
              margin: 2px 0 !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: center !important;
              width: 100% !important;
            }
            .barcode-box svg {
              display: block !important;
              max-width: 95% !important;
              height: ${config.heightMm <= 25 ? '24px' : '36px'} !important;
              margin: 0 auto !important;
            }
            .barcode-num {
              font-family: monospace, monospace !important;
              font-size: 8px !important;
              letter-spacing: 1px !important;
              display: block !important;
              text-align: center !important;
              margin-top: 1px !important;
              width: 100% !important;
            }
            .sku-line {
              font-family: monospace, monospace !important;
              font-size: 7.5px !important;
              color: #222 !important;
              display: block !important;
              text-align: center !important;
              margin-top: 1px !important;
              width: 100% !important;
            }
            .price-line {
              font-size: 11px !important;
              font-weight: 800 !important;
              line-height: 1.2 !important;
              display: block !important;
              text-align: center !important;
              margin-top: 2px !important;
              width: 100% !important;
            }
          </style>
        </head>
        <body>
          ${allLabelsHtml}
        </body>
      </html>
    `);
    frameDoc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch {
        window.print();
      } finally {
        setTimeout(() => {
          try {
            printFrame.remove();
          } catch {}
        }, 1500);
      }
    }, 250);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Impresión de Etiquetas de Código de Barras"
      subtitle={`Producto: ${activeLabelData.name} • SKU: ${activeLabelData.sku}`}
      icon={<Tag className="w-5 h-5 text-sky-600" />}
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" size="sm" onClick={handleSaveDefaultConfig} title="Recordar esta configuración de etiqueta">
            <Sliders className="w-3.5 h-3.5 mr-1 text-neutral-500" />
            Guardar Configuración
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
            {config.printerType === 'zpl' ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyZpl}
                  title="Copiar código ZPL al portapapeles para utilidades externas"
                >
                  {copiedZpl ? (
                    <Check className="w-4 h-4 mr-1.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4 mr-1.5" />
                  )}
                  {copiedZpl ? 'ZPL Copiado' : 'Copiar Comandos ZPL'}
                </Button>

                <Button
                  size="sm"
                  disabled={isPrintingZebra}
                  onClick={handleDirectZebraPrint}
                  className="bg-sky-600 hover:bg-sky-700 text-white"
                  title="Enviar ZPL directamente a la impresora Zebra sin previsualización"
                >
                  {isPrintingZebra ? (
                    <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Printer className="w-4 h-4 mr-1.5" />
                  )}
                  {isPrintingZebra
                    ? 'Enviando a Zebra...'
                    : `Imprimir en Zebra (${config.copies} ${config.copies === 1 ? 'etiqueta' : 'etiquetas'})`}
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={handlePrintLabels}>
                <Printer className="w-4 h-4 mr-1.5" />
                Imprimir ({config.copies} {config.copies === 1 ? 'etiqueta' : 'etiquetas'})
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Selector de Pestañas */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-700">
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`py-2 px-4 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'preview'
                ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
            }`}
          >
            Vista Previa de Etiqueta
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`py-2 px-4 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'config'
                ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
            }`}
          >
            Configuración de Impresora
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('zpl')}
            className={`py-2 px-4 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'zpl'
                ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
            }`}
          >
            Código Nativo (ZPL / TSPL)
          </button>
        </div>

        {/* ========================================================================= */}
        {/* PESTAÑA 1: VISTA PREVIA Y CONTROLES BÁSICOS                              */}
        {/* ========================================================================= */}
        {activeTab === 'preview' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            {/* Controles de Renglón y Copias */}
            <div className="md:col-span-5 space-y-3">
              {availablePresentations.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Presentación a Imprimir
                  </label>
                  <select
                    value={selectedPresentationId}
                    onChange={(e) => setSelectedPresentationId(e.target.value)}
                    className="w-full h-9 px-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200"
                  >
                    <option value="primary">Unidad Base ({product?.sku || 'Base'})</option>
                    {availablePresentations.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.barcode ? `[${p.barcode}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Medidas de Etiqueta Rápidas */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Tamaño de Etiqueta
                </label>
                <select
                  value={isCustomSize ? 'custom' : `${config.widthMm}x${config.heightMm}`}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setIsCustomSize(true);
                    } else {
                      setIsCustomSize(false);
                      const [w, h] = val.split('x').map(Number);
                      setConfig({ ...config, widthMm: w, heightMm: h });
                    }
                  }}
                  className="w-full h-9 px-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200"
                >
                  {PRESET_SIZES.map((s, idx) => (
                    <option key={idx} value={s.width === 0 ? 'custom' : `${s.width}x${s.height}`}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {isCustomSize && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-0.5">Ancho (mm)</label>
                    <input
                      type="number"
                      min="20"
                      max="120"
                      value={config.widthMm}
                      onChange={(e) => setConfig({ ...config, widthMm: Number(e.target.value) || 50 })}
                      className="w-full h-8 px-2 border rounded-lg border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-0.5">Alto (mm)</label>
                    <input
                      type="number"
                      min="15"
                      max="150"
                      value={config.heightMm}
                      onChange={(e) => setConfig({ ...config, heightMm: Number(e.target.value) || 30 })}
                      className="w-full h-8 px-2 border rounded-lg border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                    />
                  </div>
                </div>
              )}

              {/* Cantidad de Copias */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Cantidad de Etiquetas a Imprimir
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={config.copies}
                    onChange={(e) => setConfig({ ...config, copies: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    className="w-24 h-9 px-3 font-mono font-bold text-center border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                  />
                  {currentStock > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setConfig({ ...config, copies: Math.round(currentStock) })}
                      className="text-[11px] h-9"
                    >
                      Stock ({Math.round(currentStock)})
                    </Button>
                  )}
                  <div className="flex gap-1">
                    {[1, 5, 10, 20].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setConfig({ ...config, copies: n })}
                        className="px-2 py-1 text-[11px] rounded bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                      >
                        +{n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modo de Impresión Seleccionado */}
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg border border-neutral-200 dark:border-neutral-700 space-y-1">
                <div className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center justify-between">
                  <span>Modo de Salida:</span>
                  <span className="text-sky-600 uppercase font-mono text-[11px]">
                    {config.printerType === 'zpl' ? 'Zebra ZPL (Directo)' : config.printerType === 'tspl' ? 'TSPL / TSC' : 'Driver Windows / Térmica'}
                  </span>
                </div>
                <p className="text-[10px] text-neutral-500">
                  {config.printerType === 'zpl'
                    ? 'Genera lenguaje de comandos Zebra para envío por red, USB virtual o Zebra Setup Utilities.'
                    : 'Usa la ventana de impresión del navegador calibrada al rollo adhesivo de la impresora.'}
                </p>
              </div>
            </div>

            {/* Vista Previa Visual de la Etiqueta */}
            <div className="md:col-span-7 flex flex-col items-center justify-center p-6 bg-neutral-100 dark:bg-neutral-950/70 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <span className="text-[11px] font-semibold text-neutral-500 mb-2">
                Previsualización a escala ({config.widthMm}mm x {config.heightMm}mm)
              </span>

              {/* Contenedor de la etiqueta */}
              <div
                id="barcode-label-render-box"
                style={{
                  width: `${config.widthMm * 5.2}px`,
                  minHeight: `${config.heightMm * 5.2}px`,
                  maxWidth: '100%',
                }}
                className="bg-white text-black p-3 rounded shadow-md border border-neutral-300 flex flex-col items-center justify-between text-center select-none"
              >
                {/* Nombre de Empresa */}
                {config.showCompanyName && (
                  <div className="comp-name font-bold text-[10px] uppercase text-neutral-800 tracking-tight leading-tight w-full truncate">
                    {config.companyName || 'DISTRIBUIDORA ERO VE C.A.'}
                  </div>
                )}

                {/* Nombre del Producto */}
                {config.showProductName && (
                  <div className="prod-name font-bold text-xs text-neutral-900 leading-tight w-full line-clamp-2 my-0.5">
                    {activeLabelData.name}
                  </div>
                )}

                {/* Código de Barras SVG generado y SKU */}
                <div className="barcode-box my-1 w-full flex flex-col items-center justify-center">
                  <svg
                    viewBox={`0 0 ${barcodePattern.length || 100} 40`}
                    className="w-full"
                    style={{ height: config.heightMm <= 25 ? '26px' : '38px' }}
                    preserveAspectRatio="none"
                  >
                    {barcodePattern.split('').map((bit, i) =>
                      bit === '1' ? (
                        <rect
                          key={i}
                          x={i}
                          y={0}
                          width={1}
                          height={40}
                          fill="#000000"
                        />
                      ) : null
                    )}
                  </svg>
                  {config.showBarcodeNumber && (
                    <span className="barcode-num font-mono text-[10px] font-semibold tracking-wider text-neutral-900 mt-0.5 block text-center">
                      {currentBarcode}
                    </span>
                  )}
                  {config.showSku && activeLabelData.sku && (
                    <span className="sku-line text-[9px] text-neutral-700 font-mono mt-0.5 block text-center truncate max-w-full">
                      SKU: {activeLabelData.sku}
                    </span>
                  )}
                </div>

                {/* Precios */}
                {(config.showPriceUSD || config.showPriceVES) && (
                  <div className="price-line w-full flex items-center justify-center gap-1 font-bold mt-0.5">
                    {config.showPriceUSD && (
                      <span className="text-sm font-extrabold text-neutral-900">
                        {formatMoneyUSD(activeLabelData.priceUSD)}
                      </span>
                    )}
                    {config.showPriceVES && (
                      <span className="text-[10px] text-neutral-600 font-normal">
                        ({formatMoneyVES(activeLabelData.priceVES)})
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-4 text-[11px] text-neutral-500">
                <Printer className="w-3.5 h-3.5" />
                <span>Compatible con Zebra GK420t, ZD220, ZD230, TSC, Xprinter y térmicas USB</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 2: CONFIGURACIÓN AVANZADA DE IMPRESORA                            */}
        {/* ========================================================================= */}
        {activeTab === 'config' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Tipo de Impresora / Lenguaje
                </label>
                <select
                  value={config.printerType}
                  onChange={(e) => setConfig({ ...config, printerType: e.target.value as any })}
                  className="w-full h-9 px-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200"
                >
                  <option value="web_driver">Driver de Windows / Genérica Térmica (Recomendado)</option>
                  <option value="zpl">Zebra ZPL (Directo a Impresora / Red / Socket)</option>
                  <option value="tspl">TSC / Gprinter (Lenguaje TSPL)</option>
                  <option value="epl">Zebra EPL (Modelos Clásicos Eltron)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Resolución / Densidad (DPI)
                </label>
                <select
                  value={config.dpi}
                  onChange={(e) => setConfig({ ...config, dpi: Number(e.target.value) as any })}
                  className="w-full h-9 px-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200"
                >
                  <option value={203}>203 DPI (8 dots/mm - Zebra GK420t, ZD220, ZD230)</option>
                  <option value={300}>300 DPI (12 dots/mm - Zebra ZD421, GX430t)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Nombre de la Empresa en Encabezado
              </label>
              <input
                type="text"
                value={config.companyName}
                onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200"
              />
            </div>

            {/* Checkboxes de campos visibles */}
            <div className="space-y-2">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300 block">
                Campos a Imprimir en la Etiqueta
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-lg border border-neutral-200 dark:border-neutral-700">
                <label className="flex items-center gap-2 cursor-pointer text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={config.showCompanyName}
                    onChange={(e) => setConfig({ ...config, showCompanyName: e.target.checked })}
                    className="rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>Encabezado Empresa</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={config.showProductName}
                    onChange={(e) => setConfig({ ...config, showProductName: e.target.checked })}
                    className="rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>Nombre del Producto</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={config.showBarcodeNumber}
                    onChange={(e) => setConfig({ ...config, showBarcodeNumber: e.target.checked })}
                    className="rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>Texto Numérico del Código</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={config.showPriceUSD}
                    onChange={(e) => setConfig({ ...config, showPriceUSD: e.target.checked })}
                    className="rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>Precio en Dólares ($)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={config.showPriceVES}
                    onChange={(e) => setConfig({ ...config, showPriceVES: e.target.checked })}
                    className="rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>Precio en Bolívares (Bs.)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={config.showSku}
                    onChange={(e) => setConfig({ ...config, showSku: e.target.checked })}
                    className="rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>Código SKU (debajo del código de barras)</span>
                </label>
              </div>
            </div>

            {/* Opciones Especiales para Zebra ZPL */}
            {config.printerType === 'zpl' && (
              <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    Método de Conexión y Envío a Zebra
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isTestingZebra}
                    onClick={handleTestZebraConnection}
                    className="h-7 text-xs"
                  >
                    {isTestingZebra ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Printer className="w-3.5 h-3.5 mr-1 text-sky-600" />}
                    {isTestingZebra ? 'Probando...' : 'Probar Impresora'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      Canal de Conexión
                    </label>
                    <select
                      value={config.zebraConnection || 'browser_print'}
                      onChange={(e) => setConfig({ ...config, zebraConnection: e.target.value as any })}
                      className="w-full h-8 px-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200"
                    >
                      <option value="browser_print">Zebra Browser Print (Localhost:9100 / USB / LAN)</option>
                      <option value="network_ip">Red TCP Socket (IP Directa en Red Puerto 9100)</option>
                      <option value="windows_printer">Cola de Impresión de Windows (Spooler Local)</option>
                      <option value="web_usb">WebUSB Nativo (Chrome / Edge USB)</option>
                    </select>
                  </div>

                  {config.zebraConnection === 'network_ip' && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          Dirección IP
                        </label>
                        <input
                          type="text"
                          placeholder="192.168.1.200"
                          value={config.zebraIp || ''}
                          onChange={(e) => setConfig({ ...config, zebraIp: e.target.value })}
                          className="w-full h-8 px-2 font-mono text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          Puerto RAW
                        </label>
                        <input
                          type="number"
                          value={config.zebraPort || 9100}
                          onChange={(e) => setConfig({ ...config, zebraPort: Number(e.target.value) || 9100 })}
                          className="w-full h-8 px-2 font-mono text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                        />
                      </div>
                    </div>
                  )}

                  {config.zebraConnection === 'windows_printer' && (
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                        Nombre de Impresora en Windows
                      </label>
                      <input
                        type="text"
                        placeholder="ZTC GK420t"
                        value={config.zebraPrinterName || ''}
                        onChange={(e) => setConfig({ ...config, zebraPrinterName: e.target.value })}
                        className="w-full h-8 px-2 text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                      />
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-neutral-500">
                  {config.zebraConnection === 'browser_print'
                    ? 'Zebra Browser Print comunica directamente su navegador con impresoras Zebra USB o locales sin abrir diálogos de impresión.'
                    : config.zebraConnection === 'network_ip'
                    ? 'Envía los comandos ZPL directamente a la IP de la impresora por el puerto 9100 sin necesidad de software intermediario.'
                    : config.zebraConnection === 'windows_printer'
                    ? 'Envía los comandos directamente a la cola de la impresora instalada en Windows.'
                    : 'Permite seleccionar el dispositivo USB de Zebra directamente desde el navegador.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 3: CÓDIGO NATIVO ZPL / TSPL                                       */}
        {/* ========================================================================= */}
        {activeTab === 'zpl' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                Código de Comandos ZPL-II ({config.dpi} DPI - {config.widthMm}x{config.heightMm}mm)
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleDownloadZpl}>
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Descargar .zpl
                </Button>
                <Button size="sm" onClick={handleCopyZpl}>
                  {copiedZpl ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copiedZpl ? 'Copiado' : 'Copiar ZPL'}
                </Button>
              </div>
            </div>

            <pre className="p-3 bg-neutral-900 text-emerald-400 rounded-lg font-mono text-[11px] overflow-x-auto max-h-64 leading-tight border border-neutral-800">
              {generateZpl(activeLabelData, config)}
            </pre>

            <div className="text-[11px] text-neutral-500 space-y-1">
              <p className="font-semibold text-neutral-700 dark:text-neutral-300">¿Cómo usar este código ZPL en Zebra?</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Envíelo directamente a la IP de la impresora Zebra en el puerto 9100 mediante Raw Socket.</li>
                <li>O ábralo con <strong>Zebra Setup Utilities</strong> en la opción &quot;Enviar archivo a impresora&quot;.</li>
                <li>O use el comando de Windows: <code>copy /b etiqueta.zpl \\\\localhost\\Zebra_GK420</code>.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
