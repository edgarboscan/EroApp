import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, subtitle, action, children, className = '', ...props }) => {
  return (
    <div className={`bg-white border border-neutral-200 rounded-lg p-5 shadow-sm ${className}`} {...props}>
      {(title || subtitle || action) && (
        <div className="flex items-center justify-between mb-4 border-b border-neutral-100 pb-3">
          <div>
            {title && <h3 className="text-base font-semibold text-neutral-900">{title}</h3>}
            {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
