import { describe, it, expect } from 'vitest';
import { CAPABILITIES, can, capabilitiesOf } from './permissions';
import type { Capability } from './permissions';
import type { UserRole } from '../types/auth';

/**
 * A matriz de capacidades duplica, em TypeScript, uma regra que vive no
 * Postgres (`0016_rbac_three_roles.sql`). Duplicação de regra só é segura se
 * alguém vigiar as duas pontas: estes testes travam a forma da matriz, e o
 * `npm run db:verify` confere o lado do banco contra a RLS real.
 */

const ROLES: UserRole[] = ['admin', 'engineer', 'technician'];

describe('matriz de capacidades', () => {
  it('o admin pode tudo', () => {
    for (const cap of Object.keys(CAPABILITIES) as Capability[]) {
      expect(can('admin', cap), cap).toBe(true);
    }
  });

  it('só o admin destrói e governa', () => {
    const exclusive: Capability[] = [
      'asset:delete', 'alert:delete', 'nameplate:delete', 'maintenance:delete',
      'sensor:delete', 'document:delete',
      'user:manage', 'plant:manage', 'audit:read', 'collector:manage',
    ];
    for (const cap of exclusive) {
      expect(can('engineer', cap), `engineer / ${cap}`).toBe(false);
      expect(can('technician', cap), `technician / ${cap}`).toBe(false);
    }
  });

  it('o engenheiro configura, o técnico não', () => {
    const configure: Capability[] = [
      'asset:create', 'asset:update', 'asset:deactivate', 'asset:layout',
      'nameplate:edit', 'sensor:manage', 'ml:manage', 'document:manage',
      'maintenance:assign',
    ];
    for (const cap of configure) {
      expect(can('engineer', cap), `engineer / ${cap}`).toBe(true);
      expect(can('technician', cap), `technician / ${cap}`).toBe(false);
    }
  });

  it('os três operam', () => {
    const operate: Capability[] = [
      'asset:read', 'alert:acknowledge', 'alert:resolve',
      'maintenance:create', 'maintenance:complete', 'nameplate:register',
    ];
    for (const cap of operate) {
      for (const role of ROLES) {
        expect(can(role, cap), `${role} / ${cap}`).toBe(true);
      }
    }
  });

  // As duas eram o mesmo teste antes (`canWriteAssets`), e o alias virou bug
  // quando a matriz as separou.
  it('posicionar e apagar são capacidades distintas', () => {
    expect(can('engineer', 'asset:layout')).toBe(true);
    expect(can('engineer', 'asset:delete')).toBe(false);
  });

  // Registrar placa é faixa 1 e corrigir é faixa 2 — é essa diferença que a
  // RPC `confirm_nameplate` sustenta no banco.
  it('o técnico registra placa mas não a corrige', () => {
    expect(can('technician', 'nameplate:register')).toBe(true);
    expect(can('technician', 'nameplate:edit')).toBe(false);
  });

  it('sem papel não pode nada', () => {
    for (const cap of Object.keys(CAPABILITIES) as Capability[]) {
      expect(can(null, cap), cap).toBe(false);
      expect(can(undefined, cap), cap).toBe(false);
    }
  });

  it('toda capacidade pertence a exatamente uma das três faixas', () => {
    for (const [cap, roles] of Object.entries(CAPABILITIES)) {
      expect([1, 2, 3], `${cap} tem ${roles.length} papéis`).toContain(roles.length);
      // Admin está em todas: não existe capacidade que ele não tenha.
      expect(roles, cap).toContain('admin');
    }
  });

  it('capabilitiesOf devolve mais para quem pode mais', () => {
    const admin = capabilitiesOf('admin').length;
    const engineer = capabilitiesOf('engineer').length;
    const technician = capabilitiesOf('technician').length;

    expect(admin).toBe(Object.keys(CAPABILITIES).length);
    expect(admin).toBeGreaterThan(engineer);
    expect(engineer).toBeGreaterThan(technician);
    expect(capabilitiesOf(null)).toHaveLength(0);
  });
});
