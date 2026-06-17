import { useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { useAppStore } from '../store/appStore';
import { Alert } from '../types';

/**
 * Carrega e gerencia alertas, com suporte a filtro por assetId.
 * Sincroniza com o store global automaticamente.
 */
export const useAlerts = (assetId?: string) => {
  const { alerts, setAlerts, resolveAlert } = useAppStore((s) => ({
    alerts: s.alerts,
    setAlerts: s.setAlerts,
    resolveAlert: s.resolveAlert,
  }));

  useEffect(() => {
    apiService.getAlerts().then(setAlerts);
  }, []);

  const handleResolve = useCallback(
    async (alertId: string) => {
      await apiService.resolveAlert(alertId);
      resolveAlert(alertId);
    },
    [resolveAlert],
  );

  const filtered: Alert[] = assetId
    ? alerts.filter((a) => a.assetId === assetId)
    : alerts;

  return { alerts: filtered, resolveAlert: handleResolve };
};
