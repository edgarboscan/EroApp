import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { FileText, Printer, FileDown, ExternalLink, X, Loader2, AlertCircle } from 'lucide-react';
import { useEscapeKey } from './Modal';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';

export interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  endpoint?: string | null;
  pdfBlobUrl?: string | null;
  filename?: string;
  token?: string | null;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  endpoint,
  pdfBlobUrl: externalBlobUrl,
  filename,
  token,
}) => {
  const [internalBlobUrl, setInternalBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeBlobUrl = externalBlobUrl || internalBlobUrl;
  const effectiveToken = token ?? useAuthStore.getState().token;

  const loadPdf = async () => {
    if (!endpoint) return;
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (effectiveToken) {
        headers['Authorization'] = `Bearer ${effectiveToken}`;
      }
      const res = await fetch(endpoint, { headers });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let errMsg = 'Error al generar el documento PDF';
        try {
          const json = JSON.parse(text);
          errMsg = json.error?.message || json.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setInternalBlobUrl(url);
    } catch (err: any) {
      setError(err.message || 'No se pudo cargar el documento PDF');
      toast.error('Error al generar la vista previa del PDF');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (endpoint && !externalBlobUrl) {
        loadPdf();
      }
    } else {
      if (internalBlobUrl) {
        URL.revokeObjectURL(internalBlobUrl);
        setInternalBlobUrl(null);
      }
      setError(null);
    }
  }, [isOpen, endpoint, externalBlobUrl]);

  const handleClose = () => {
    if (internalBlobUrl) {
      URL.revokeObjectURL(internalBlobUrl);
      setInternalBlobUrl(null);
    }
    onClose();
  };

  useEscapeKey(handleClose, isOpen);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch {}
    }
    if (activeBlobUrl) {
      const win = window.open(activeBlobUrl, '_blank');
      win?.focus();
      win?.print();
    }
  };

  const handleDownload = async () => {
    if (!activeBlobUrl && !endpoint) return;
    setDownloading(true);
    try {
      let downloadUrl = activeBlobUrl;
      let shouldRevoke = false;

      if (!downloadUrl && endpoint) {
        const headers: Record<string, string> = {};
        if (effectiveToken) headers['Authorization'] = `Bearer ${effectiveToken}`;
        const res = await fetch(endpoint, { headers });
        if (!res.ok) throw new Error('Error al descargar el PDF');
        const blob = await res.blob();
        downloadUrl = URL.createObjectURL(blob);
        shouldRevoke = true;
      }

      if (downloadUrl) {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename || `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (shouldRevoke) {
          URL.revokeObjectURL(downloadUrl);
        }
        toast.success('Documento PDF descargado correctamente');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al descargar el archivo PDF');
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg border border-neutral-200 shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera Pinned */}
        <div className="px-5 py-3 border-b border-neutral-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-neutral-900 leading-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeBlobUrl && (
              <a
                href={activeBlobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-400 cursor-pointer"
                title="Abrir en pestaña nueva"
              >
                <ExternalLink className="w-3.5 h-3.5 text-neutral-500" />
                <span>Pestaña</span>
              </a>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={!activeBlobUrl || loading}
              title="Imprimir documento"
            >
              <Printer className="w-3.5 h-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Imprimir</span>
            </Button>

            <Button
              size="sm"
              onClick={handleDownload}
              disabled={(!activeBlobUrl && !endpoint) || loading}
              isLoading={downloading}
              title="Descargar PDF"
            >
              <FileDown className="w-3.5 h-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Descargar PDF</span>
            </Button>

            <button
              type="button"
              onClick={handleClose}
              title="Cerrar ventana (Esc)"
              className="text-neutral-400 hover:text-neutral-600 p-1.5 rounded-lg hover:bg-neutral-100 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Visor PDF */}
        <div className="flex-1 bg-neutral-100 p-2 sm:p-3 overflow-hidden relative">
          {loading ? (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-white rounded-lg border border-neutral-200 p-6">
              <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
              <p className="text-sm font-semibold text-neutral-800">
                Generando documento oficial en formato PDF...
              </p>
              <p className="text-xs text-neutral-500 max-w-sm text-center">
                Estructurando encabezados fiscales, numeración de páginas y formato homologado.
              </p>
            </div>
          ) : error ? (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-white rounded-lg border border-red-200 p-6 text-center">
              <AlertCircle className="w-10 h-10 text-red-500" />
              <p className="text-sm font-bold text-red-700">No se pudo generar el documento</p>
              <p className="text-xs text-neutral-600 max-w-md">{error}</p>
              <Button variant="outline" size="sm" onClick={loadPdf} className="mt-2">
                Reintentar generación
              </Button>
            </div>
          ) : activeBlobUrl ? (
            <iframe
              ref={iframeRef}
              src={activeBlobUrl}
              className="w-full h-full rounded-lg border border-neutral-300 bg-white shadow-xs"
              title={title}
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-neutral-400 bg-white rounded-lg border border-neutral-200">
              <FileText className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm font-medium">Documento no disponible</p>
            </div>
          )}
        </div>

        {/* Pie de página Pinned */}
        <div className="px-5 py-2.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between text-xs text-neutral-500 shrink-0">
          <span className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Documento Oficial Certificado ERO ERP VE</span>
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleClose}>
              Cerrar (Esc)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
