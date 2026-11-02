import { toast } from 'sonner';

/**
 * Descarga archivos de contabilidad (Excel .xlsx o CSV .csv) desde el backend
 */
export async function downloadAccountingFile(
  endpoint: string,
  filename: string,
  token: string | null
): Promise<void> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(endpoint, { headers });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let errMsg = 'Error al exportar el reporte contable';
      try {
        const json = JSON.parse(text);
        errMsg = json.error?.message || json.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success(`Archivo descargado con éxito: ${filename}`);
  } catch (err: any) {
    toast.error(err.message || 'Error al descargar archivo');
  }
}

