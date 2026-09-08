import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MaintenanceScheduler } from './MaintenanceScheduler';
import type { Asset } from '../types';

vi.mock('../services/api', () => ({
  apiService: {
    getTechnicians: vi.fn().mockResolvedValue([
      { id: 'tech-1', name: 'Carlos Silva', role: 'technician', jobTitle: 'Técnico' },
    ]),
    createMaintenanceOrder: vi.fn(),
    sendMaintenanceEmail: vi.fn(),
  },
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', role: 'admin', email: 'a@b.c' } }),
}));

const ASSET = {
  id: 'a1',
  tag: 'MTR-002',
  name: 'Motor de Reserva',
  sensors: [],
} as unknown as Asset;

const renderPanel = () =>
  render(
    <MaintenanceScheduler open onOpenChange={() => {}} asset={ASSET} language="pt" />,
  );

describe('MaintenanceScheduler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('oferece apenas manutenção preventiva e corretiva', async () => {
    renderPanel();

    expect(await screen.findByRole('button', { name: 'Preventiva' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Corretiva' })).toBeInTheDocument();
    // Os três tipos restantes seguem no enum do banco, mas não são oferecidos.
    expect(screen.queryByRole('button', { name: 'Preditiva' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inspeção' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Calibração' })).not.toBeInTheDocument();
  });

  it('avança a conversa ao escolher uma opção', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Preventiva' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Alta' })).toBeInTheDocument();
    });
  });

  /**
   * Regressão: `Option` já morou dentro do componente, o que o tornava um tipo
   * novo a cada render. O React desmontava e remontava os botões, e um render
   * entre o mousedown e o mouseup (a página do ativo re-renderiza sozinha com a
   * telemetria em tempo real) destruía o elemento no meio do gesto — o clique
   * nunca disparava.
   */
  it('mantém o mesmo nó de botão quando o pai re-renderiza', async () => {
    const { rerender } = renderPanel();

    const before = await screen.findByRole('button', { name: 'Preventiva' });

    rerender(
      <MaintenanceScheduler open onOpenChange={() => {}} asset={{ ...ASSET }} language="pt" />,
    );

    expect(screen.getByRole('button', { name: 'Preventiva' })).toBe(before);
  });
});
