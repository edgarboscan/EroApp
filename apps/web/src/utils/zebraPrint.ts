/**
 * Utilidades para comunicación directa con impresoras Zebra (ZPL-II)
 * Soporta Zebra Browser Print (localhost:9100), Socket TCP en Red (/api/inventory/print-raw),
 * Spooler de Windows y WebUSB nativo para Chrome/Edge.
 */

import { LabelPrintConfig } from './barcode';

export interface ZebraPrintResult {
  success: boolean;
  message: string;
  method?: string;
}

/**
 * Envío directo a Zebra usando el servicio oficial Zebra Browser Print (Windows / macOS)
 */
export async function printViaZebraBrowserPrint(zpl: string): Promise<ZebraPrintResult> {
  const endpoints = ['http://127.0.0.1:9100', 'http://localhost:9100', 'https://localhost:9101'];

  let activeBaseUrl = '';
  let defaultDevice: any = null;

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const res = await fetch(`${url}/default?type=printer`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        if (text && text.trim() && !text.includes('No printer')) {
          try {
            defaultDevice = JSON.parse(text);
            activeBaseUrl = url;
            break;
          } catch {
            // El servicio puede devolver el nombre plano
            defaultDevice = { name: text.trim(), uid: text.trim(), connection: 'usb', deviceType: 'printer', version: 2 };
            activeBaseUrl = url;
            break;
          }
        }
      }
    } catch {
      // Probar siguiente puerto/host
    }
  }

  if (!activeBaseUrl || !defaultDevice) {
    throw new Error(
      'No se detectó el servicio Zebra Browser Print en ejecución en este equipo. Asegúrese de tener instalada y abierta la aplicación Zebra Browser Print.'
    );
  }

  // Enviar comandos ZPL a la impresora detectada
  const writeRes = await fetch(`${activeBaseUrl}/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      device: defaultDevice,
      data: zpl,
    }),
  });

  if (!writeRes.ok) {
    throw new Error(`Zebra Browser Print respondió con error: ${writeRes.statusText}`);
  }

  return {
    success: true,
    message: `Etiquetas enviadas correctamente a la impresora Zebra (${defaultDevice.name || 'Zebra USB'}).`,
    method: 'Zebra Browser Print',
  };
}

/**
 * Envío directo a través de la API por Socket TCP de Red (Puerto RAW 9100)
 */
export async function printViaNetworkSocket(
  zpl: string,
  host: string,
  port = 9100,
  token?: string
): Promise<ZebraPrintResult> {
  if (!host || !host.trim()) {
    throw new Error('Debe especificar la dirección IP de la impresora Zebra en red.');
  }

  const res = await fetch('/api/inventory/print-raw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      host: host.trim(),
      port: Number(port) || 9100,
      data: zpl,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || 'No fue posible transmitir los comandos a la impresora Zebra en red.');
  }

  return {
    success: true,
    message: json.message || `Etiquetas enviadas a la impresora Zebra en ${host}:${port}.`,
    method: 'Red TCP Socket',
  };
}

/**
 * Envío directo a impresora instalada en Windows vía Backend
 */
export async function printViaWindowsPrinter(
  zpl: string,
  printerName: string,
  token?: string
): Promise<ZebraPrintResult> {
  if (!printerName || !printerName.trim()) {
    throw new Error('Debe indicar el nombre exacto de la impresora Zebra en Windows.');
  }

  const res = await fetch('/api/inventory/print-raw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      printerName: printerName.trim(),
      data: zpl,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || 'Fallo al imprimir en la impresora Zebra de Windows.');
  }

  return {
    success: true,
    message: json.message || `Etiquetas enviadas a la impresora "${printerName}".`,
    method: 'Windows Spooler',
  };
}

/**
 * Envío directo vía WebUSB (Sin instalar utilidades externas, solo para navegadores Chromium)
 */
export async function printViaWebUSB(zpl: string): Promise<ZebraPrintResult> {
  const navAny = navigator as any;
  if (!navAny.usb) {
    throw new Error('Su navegador no soporta WebUSB. Utilice Google Chrome o Microsoft Edge.');
  }

  // Filtrar dispositivos con Vendor ID de Zebra Technologies (0x0a5f) o seleccionar cualquiera
  const device = await navAny.usb.requestDevice({
    filters: [{ vendorId: 0x0a5f }],
  });

  if (!device) {
    throw new Error('No se seleccionó ningún dispositivo USB.');
  }

  await device.open();
  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }

  const iface = device.configuration.interfaces[0];
  await device.claimInterface(iface.interfaceNumber);

  // Buscar endpoint OUT
  const endpointOut = iface.alternate.endpoints.find((e: any) => e.direction === 'out');
  if (!endpointOut) {
    throw new Error('No se encontró el canal de salida USB de la impresora.');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(zpl);
  await device.transferOut(endpointOut.endpointNumber, data);

  await device.close();

  return {
    success: true,
    message: `Etiquetas enviadas por WebUSB a ${device.productName || 'Zebra Printer'}.`,
    method: 'WebUSB Directo',
  };
}

/**
 * Orquestador principal de impresión directa en Zebra
 */
export async function sendDirectToZebra(
  zpl: string,
  config: LabelPrintConfig,
  token?: string
): Promise<ZebraPrintResult> {
  const mode = config.zebraConnection || 'browser_print';

  switch (mode) {
    case 'browser_print': {
      try {
        return await printViaZebraBrowserPrint(zpl);
      } catch (err: any) {
        // Si Browser Print no está disponible, intentar fallback por red si hay IP configurada
        if (config.zebraIp) {
          try {
            return await printViaNetworkSocket(zpl, config.zebraIp, config.zebraPort || 9100, token);
          } catch {}
        }
        throw err;
      }
    }

    case 'network_ip': {
      return await printViaNetworkSocket(
        zpl,
        config.zebraIp || '192.168.1.200',
        config.zebraPort || 9100,
        token
      );
    }

    case 'windows_printer': {
      return await printViaWindowsPrinter(
        zpl,
        config.zebraPrinterName || 'ZTC GK420t',
        token
      );
    }

    case 'web_usb': {
      return await printViaWebUSB(zpl);
    }

    default:
      return await printViaZebraBrowserPrint(zpl);
  }
}
