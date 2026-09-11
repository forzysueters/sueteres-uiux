import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTourController } from './useTourController';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(), listAssets: vi.fn(), getChatResponse: vi.fn(),
  speech: { speak: vi.fn(), cancel: vi.fn(), prefetch: vi.fn() },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useLocation: () => ({ pathname: '/dashboard' }) }));
vi.mock('../store/appStore', () => ({ useAppStore: () => ({ language: 'pt', assets: [], selectedAssetId: 'selected' }) }));
vi.mock('../services/api', () => ({ apiService: mocks }));
vi.mock('./useSpeech', () => ({ useSpeech: () => mocks.speech }));

describe('navegação do resumo do Órion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('forzy.assistant.tour.v1', 'completed');
    mocks.listAssets.mockResolvedValue([{ id: 'motor', tag: 'MTR-001', name: 'Motor', type: 'motor', status: 'critical', location: 'Hall A', sensors: [] }]);
  });

  it('consulta a frota apesar do ativo selecionado e navega pelas etapas', async () => {
    const { result } = renderHook(() => useTourController());
    await act(async () => { await result.current.actions.ask('faça um resumo'); });
    expect(mocks.listAssets).toHaveBeenCalledOnce();
    expect(mocks.getChatResponse).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('tour');
    expect(mocks.navigate).toHaveBeenLastCalledWith('/planta');
    act(() => result.current.actions.next());
    expect(mocks.navigate).toHaveBeenLastCalledWith('/planta/ativo/motor');
    expect(result.current.text).toContain('Estado crítico');
    act(() => result.current.actions.next());
    expect(mocks.navigate).toHaveBeenLastCalledWith('/alertas');
    act(() => result.current.actions.next());
    expect(result.current.phase).toBe('chat');
    act(() => result.current.actions.restart());
    expect(mocks.navigate).toHaveBeenLastCalledWith('/dashboard');
    expect(result.current.stepCount).toBe(9);
  });

  it('não navega se o usuário fechar durante a consulta', async () => {
    let finish!: (assets: []) => void;
    mocks.listAssets.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useTourController());
    let pending!: Promise<void>;
    act(() => { pending = result.current.actions.ask('resumo dos ativos'); });
    act(() => result.current.actions.close());
    await act(async () => { finish([]); await pending; });
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(result.current.open).toBe(false);
  });

  it('mostra erro de consulta sem apresentar uma frota vazia', async () => {
    mocks.listAssets.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useTourController());
    await act(async () => { await result.current.actions.ask('resumo dos motores'); });
    expect(result.current.phase).toBe('chat');
    expect(result.current.chatPending).toBe(false);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
