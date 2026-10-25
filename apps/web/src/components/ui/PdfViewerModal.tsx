import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { FileText, Printer, FileDown, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
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
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      subtitle={subtitle}
      icon={<FileText className="w-5 h-5 text-sky-600 dark:text-sky-400" />}
      maxWidth="max-w-5xl"
      className="h-[92vh]"
      contentClassName="p-2 sm:p-3 overflow-hidden relative flex flex-col flex-1 bg-neutral-100 dark:bg-neutral-950"
      headerActions={
        <div className="flex items-center gap-2">
          {activeBlobUrl && (
            <a
              href={activeBlobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-sky-500 cursor-pointer transition-colors"
              title="Abrir en pestaña nueva"
            >
              <ExternalLink className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
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
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full text-xs text-neutral-500 dark:text-neutral-400">
          <span className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>Documento Oficial Certificado ERO ERP VE</span>
          </span>
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cerrar (Esc)
          </Button>
        </div>
      }
    >
      <div className="w-full h-full flex flex-col">
        {loading ? (
          <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
            <Loader2 className="w-8 h-8 text-sky-600 dark:text-sky-400 animate-spin" />
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Generando documento oficial en formato PDF...
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm text-center">
              Estructurando encabezados fiscales, numeración de páginas y formato homologado.
            </p>
          </div>
        ) : error ? (
          <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-white dark:bg-neutral-900 rounded-lg border border-red-200 dark:border-red-900/50 p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <p className="text-sm font-bold text-red-700 dark:text-red-400">No se pudo generar el documento</p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-md">{error}</p>
            <Button variant="outline" size="sm" onClick={loadPdf} className="mt-2">
              Reintentar generación
            </Button>
          </div>
        ) : activeBlobUrl ? (
          <iframe
            ref={iframeRef}
            src={activeBlobUrl}
            className="w-full h-full rounded-lg border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs"
            title={title}
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
            <FileText className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm font-medium">Documento no disponible</p>
          </div>
        )}
      </div>
    </Modal>
  );
};
