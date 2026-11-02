import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, subtitle, action, children, className = '', ...props }) => {
  return (
    <div
      className={`bg-white dark:bg-[#1E1F21] border border-gray-200 dark:border-gray-800 rounded-lg p-5 shadow-xs text-[#333333] dark:text-[#E0E0E0] transition-colors ${className}`}
      {...props}
    >
      {(title || subtitle || action) && (
        <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-800/80 pb-3">
          <div>
            {title && <h3 className="text-base font-semibold text-[#333333] dark:text-[#E0E0E0]">{title}</h3>}
            {subtitle && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
