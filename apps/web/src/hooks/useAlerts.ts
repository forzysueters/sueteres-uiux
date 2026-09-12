import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
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
  }, [setAlerts]);

  const handleResolve = useCallback(
    async (alertId: string) => {
      // O store só é atualizado DEPOIS de a escrita confirmar. Antes, a RPC
      // recusada pela RLS devolvia zero linhas sem erro e a interface marcava
      // o alerta como resolvido mesmo assim — some ao recarregar a página.
      try {
        await apiService.resolveAlert(alertId);
        resolveAlert(alertId);
      } catch (err) {
        toast.error((err as Error)?.message ?? 'Não foi possível resolver o alerta.');
      }
    },
    [resolveAlert],
  );

  const filtered: Alert[] = assetId
    ? alerts.filter((a) => a.assetId === assetId)
    : alerts;

  return { alerts: filtered, resolveAlert: handleResolve };
};
