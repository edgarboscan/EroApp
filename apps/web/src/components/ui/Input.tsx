import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-neutral-700 tracking-wide">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`h-10 px-3 text-sm bg-white border rounded-lg text-neutral-900 placeholder:text-neutral-400 transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:bg-neutral-100 disabled:cursor-not-allowed ${
            error
              ? 'border-red-500 focus-visible:ring-red-500'
              : 'border-neutral-300 focus-visible:ring-sky-500 hover:border-neutral-400'
          } ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-red-600 font-medium">{error}</span>}
        {helperText && !error && <span className="text-xs text-neutral-500">{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
