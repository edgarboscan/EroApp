import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  requireBranch?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireBranch = true,
}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireBranch && !activeBranchId && location.pathname !== '/select-branch') {
    return <Navigate to="/select-branch" replace />;
  }

  return children ? <>{children}</> : null;
};
