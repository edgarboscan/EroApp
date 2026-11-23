import React from 'react';

interface BadgeProps {
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children, className = '' }) => {
  const variantStyles = {
    neutral:
      'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700 font-medium',
    success:
      'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-semibold',
    warning:
      'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-semibold',
    danger:
      'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-semibold',
    info:
      'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800 font-semibold',
    primary:
      'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800 font-semibold',
    secondary:
      'bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800 font-semibold',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs border ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
};
