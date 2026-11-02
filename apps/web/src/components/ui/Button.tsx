import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const variantStyles = {
    primary:
      'bg-[#007BFF] hover:bg-[#0069d9] text-white dark:bg-[#3D91FF] dark:hover:bg-[#297be6] dark:text-white focus-visible:ring-[#007BFF] dark:focus-visible:ring-[#3D91FF] shadow-xs',
    secondary:
      'bg-[#17A2B8] hover:bg-[#138496] text-white dark:bg-[#38C9DD] dark:hover:bg-[#26b3c7] dark:text-neutral-950 focus-visible:ring-[#17A2B8] dark:focus-visible:ring-[#38C9DD] shadow-xs',
    outline:
      'border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1E1F21] text-[#333333] dark:text-[#E0E0E0] hover:bg-gray-50 dark:hover:bg-neutral-800 focus-visible:ring-[#007BFF] dark:focus-visible:ring-[#3D91FF]',
    danger:
      'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-xs',
    ghost:
      'text-[#333333] dark:text-[#E0E0E0] hover:bg-gray-100 dark:hover:bg-neutral-800 focus-visible:ring-[#007BFF] dark:focus-visible:ring-[#3D91FF]',
  };

  const sizeStyles = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-12 px-6 text-base gap-2.5',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      ) : null}
      {children}
    </button>
  );
};
