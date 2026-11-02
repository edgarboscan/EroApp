import React from 'react';

interface BadgeProps {
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children, className = '' }) => {
  const variantStyles = {
    neutral:
      'bg-gray-100 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300 border-gray-200 dark:border-gray-700',
    success:
      'bg-[#28A745]/10 dark:bg-[#4ADE80]/15 text-[#28A745] dark:text-[#4ADE80] border-[#28A745]/25 dark:border-[#4ADE80]/30',
    warning:
      'bg-[#FFC107]/15 dark:bg-[#FBBF24]/15 text-[#b28500] dark:text-[#FBBF24] border-[#FFC107]/30 dark:border-[#FBBF24]/30',
    danger:
      'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    info:
      'bg-[#17A2B8]/10 dark:bg-[#38C9DD]/15 text-[#17A2B8] dark:text-[#38C9DD] border-[#17A2B8]/25 dark:border-[#38C9DD]/30',
    primary:
      'bg-[#007BFF]/10 dark:bg-[#3D91FF]/15 text-[#007BFF] dark:text-[#3D91FF] border-[#007BFF]/25 dark:border-[#3D91FF]/30',
    secondary:
      'bg-[#17A2B8]/10 dark:bg-[#38C9DD]/15 text-[#17A2B8] dark:text-[#38C9DD] border-[#17A2B8]/25 dark:border-[#38C9DD]/30',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium border ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
};
