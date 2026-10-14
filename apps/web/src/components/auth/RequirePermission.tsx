import React from 'react';
import { useAuthStore } from '../../stores/authStore';
import { ShieldAlert } from 'lucide-react';

interface RequirePermissionProps {
  module: string;
  action: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RequirePermission: React.FC<RequirePermissionProps> = ({
  module,
  action,
  children,
  fallback,
}) => {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const isAllowed = hasPermission(module, action);

  if (!isAllowed) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="p-8 bg-white border border-neutral-200 rounded-lg text-center max-w-lg mx-auto my-8">
        <div className="w-10 h-10 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center mx-auto mb-3">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold text-neutral-900">Acceso Restringido</h3>
        <p className="text-xs text-neutral-500 mt-1">
          No posee los privilegios necesarios ({module}.{action}) para interactuar con este recurso.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
