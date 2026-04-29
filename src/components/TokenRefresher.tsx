import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'

interface TokenRefresherProps {
  children: React.ReactNode
}

const REFRESH_INTERVAL = 10 * 60 * 1000 // 10 min (token expira em 15 min)

export const TokenRefresher = ({ children }: TokenRefresherProps) => {
  const { isAuthenticated, refreshToken } = useAuthStore()

  // Refresh periódico — silencioso. Se falhar, NÃO derruba a sessão local.
  useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(() => {
      refreshToken().catch((error) => {
        console.warn('[auth] periodic refresh failed (keeping session):', error)
      })
    }, REFRESH_INTERVAL)

    return () => clearInterval(interval)
  }, [isAuthenticated, refreshToken])

  return <>{children}</>
}
