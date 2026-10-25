import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  size?: ModalSize;
  headerActions?: React.ReactNode;
  contentClassName?: string;
  className?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  full: 'max-w-7xl',
};

/**
 * Hook para permitir cerrar cualquier modal con la tecla Escape
 */
export const useEscapeKey = (onClose: () => void, isOpen: boolean = true) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  description,
  icon,
  children,
  footer,
  maxWidth,
  size = 'xl',
  headerActions,
  contentClassName = '',
  className = '',
}) => {
  const resolvedMaxWidth = maxWidth || sizeClasses[size] || 'max-w-xl';
  useEscapeKey(onClose, isOpen);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-neutral-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div
        className="fixed inset-0 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`relative w-full ${resolvedMaxWidth} max-h-[92vh] bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden z-10 my-auto text-neutral-900 dark:text-neutral-100 ${className}`}
      >
        {/* Header Fijo (Pinned) */}
        <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-white dark:bg-neutral-900">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            {icon && <div className="text-sky-600 dark:text-sky-400 shrink-0">{icon}</div>}
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">{title}</h3>
              {(subtitle || description) && <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">{subtitle || description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:ring-2 focus-visible:ring-sky-500"
              title="Cerrar modal (Esc)"
              aria-label="Cerrar ventana modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Scrollable */}
        <div className={`flex-1 overflow-y-auto p-4 sm:p-5 ${contentClassName}`}>
          {children}
        </div>

        {/* Footer Fijo (Pinned) */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 shrink-0 bg-white dark:bg-neutral-900 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
