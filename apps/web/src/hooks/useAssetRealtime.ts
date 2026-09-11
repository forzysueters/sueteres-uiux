import { useEffect, useRef } from 'react';
import { Asset } from '../types';
import { startRealtimeUpdates } from '../services/api';
import { useAppStore } from '../store/appStore';

/**
 * Inicia atualizações em tempo real para um ativo específico.
 * Atualiza o store global a cada 2s e chama callback opcional com o asset atualizado.
 */
export const useAssetRealtime = (assetId: string | null, onUpdate?: (asset: Asset) => void) => {
  const updateAsset = useAppStore((s) => s.updateAsset);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!assetId) return;

    cleanupRef.current = startRealtimeUpdates(assetId, (asset) => {
      updateAsset(asset);
      onUpdate?.(asset);
    });

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [assetId]);
};
