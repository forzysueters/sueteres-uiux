import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

interface TokenRefresherProps {
  children: React.ReactNode;
}

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes (token expires in 15 min)

export const TokenRefresher = ({ children }: TokenRefresherProps) => {
  const { isAuthenticated, refreshToken, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;

    // Refresh token every 10 minutes
    const interval = setInterval(async () => {
      try {
        await refreshToken();
      } catch (error) {
        console.error('Token refresh failed, logging out:', error);
        await logout();
      }
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [isAuthenticated, refreshToken, logout]);

  // Also handle tab/window visibility - refresh when tab becomes visible
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        try {
          await refreshToken();
        } catch (error) {
          console.error('Token refresh failed:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, refreshToken]);

  return <>{children}</>;
};
