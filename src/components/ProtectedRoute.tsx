import { ReactNode, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[];
}

export const ProtectedRoute = ({ 
  children, 
  requiredRoles 
}: ProtectedRouteProps) => {
  const { isAuthenticated, user, verifyAuth, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      verifyAuth();
    }
  }, [isAuthenticated, verifyAuth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="mt-2 text-gray-600">You must be logged in to access this page.</p>
        </div>
      </div>
    );
  }

  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Unauthorized</h1>
          <p className="mt-2 text-gray-600">You don't have permission to access this resource.</p>
          <p className="mt-1 text-sm text-gray-500">Required role: {requiredRoles.join(' or ')}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
