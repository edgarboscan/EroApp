import Swal, { SweetAlertIcon } from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

export interface ConfirmQuestionOptions {
  title: string;
  text?: string;
  html?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  isDestructive?: boolean;
  icon?: SweetAlertIcon;
}

/**
 * Instancia preconfigurada de SweetAlert2 con estilos alineados al diseño ERP
 * (Tailwind CSS, radio unificado rounded-lg, paleta neutral + acento sky-700 / red-600)
 */
export const erpSwal = Swal.mixin({
  buttonsStyling: false,
  reverseButtons: true,
  focusCancel: false,
  showCancelButton: true,
  customClass: {
    popup:
      'rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl p-6 text-neutral-900 dark:text-neutral-100 max-w-md w-full',
    title: 'text-base font-bold text-neutral-900 dark:text-neutral-100 pt-1 pb-1 text-center',
    htmlContainer: 'text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed my-2 text-center',
    actions:
      'flex items-center justify-end gap-2 w-full mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800',
    confirmButton:
      'inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 cursor-pointer shadow-xs',
    cancelButton:
      'inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400 cursor-pointer',
  },
});

/**
 * Diálogo de confirmación / pregunta con SweetAlert2
 */
export async function showConfirmQuestion(options: ConfirmQuestionOptions): Promise<boolean> {
  const {
    title,
    text,
    html,
    confirmButtonText = 'Confirmar',
    cancelButtonText = 'Cancelar',
    isDestructive = false,
    icon = 'question',
  } = options;

  const result = await erpSwal.fire({
    title,
    text,
    html,
    icon,
    confirmButtonText,
    cancelButtonText,
    customClass: {
      popup:
        'rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl p-6 text-neutral-900 dark:text-neutral-100 max-w-md w-full',
      title: 'text-base font-bold text-neutral-900 dark:text-neutral-100 pt-1 pb-1 text-center',
      htmlContainer: 'text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed my-2 text-center',
      actions:
        'flex items-center justify-end gap-2 w-full mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800',
      confirmButton: isDestructive
        ? 'inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer shadow-xs'
        : 'inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 cursor-pointer shadow-xs',
      cancelButton:
        'inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400 cursor-pointer',
    },
  });

  return Boolean(result.isConfirmed);
}

/**
 * Alerta SweetAlert cuando se intenta abandonar la página con productos en el carrito de facturación
 */
export async function showLeaveCartAlert(): Promise<boolean> {
  return showConfirmQuestion({
    title: '¿Deseas salir y descartar la venta?',
    html: '<strong>Atención:</strong> Existen productos cargados en el carrito de facturación.<br/><br/>Si cambias de página se cancelará el proceso de facturación en curso.',
    icon: 'warning',
    confirmButtonText: 'Sí, salir y descartar',
    cancelButtonText: 'Continuar facturando',
    isDestructive: true,
  });
}

/**
 * Alerta SweetAlert para confirmar el vaciado del carrito de compras
 */
export async function showClearCartAlert(): Promise<boolean> {
  return showConfirmQuestion({
    title: '¿Vaciar carrito de compras?',
    text: '¿Está seguro de que desea vaciar todos los productos del carrito actual?',
    icon: 'warning',
    confirmButtonText: 'Sí, vaciar carrito',
    cancelButtonText: 'Cancelar',
    isDestructive: true,
  });
}

/**
 * Alerta SweetAlert para anulación o acciones destructivas
 */
export async function showDestructiveConfirm(
  title: string,
  text: string,
  confirmButtonText = 'Sí, anular'
): Promise<boolean> {
  return showConfirmQuestion({
    title,
    text,
    icon: 'warning',
    confirmButtonText,
    cancelButtonText: 'Cancelar',
    isDestructive: true,
  });
}

export default erpSwal;
