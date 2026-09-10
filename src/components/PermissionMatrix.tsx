import React, { useState } from 'react';
import { Check, Minus, ChevronDown, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import { ROLE_LABELS } from '../types/auth';
import type { UserRole } from '../types/auth';
import { CAPABILITY_GROUPS, can, capabilitiesOf } from '../auth/permissions';
import { cn } from '../lib/utils';

const ROLES: UserRole[] = ['admin', 'engineer', 'technician'];

/**
 * Matriz permissão × papel.
 *
 * Existe porque a tela de Usuários pedia uma decisão — que papel dar a esta
 * pessoa — sem mostrar em lugar nenhum o que a decisão significa. Os rótulos
 * dos três botões não dizem que só o administrador exclui um ativo.
 *
 * É deliberadamente só leitura. Quem autoriza de fato é a RLS no Postgres, com
 * `is_admin()` e `can_configure()` escritos em SQL; `CAPABILITIES` é o espelho
 * disso no front e esta tabela é a leitura desse espelho. Uma célula clicável
 * aqui prometeria um poder que o banco não concede.
 */
export const PermissionMatrix: React.FC = () => {
  const { language } = useAppStore();
  const t = translations[language].permissionMatrix;
  const [open, setOpen] = useState(false);

  const total = CAPABILITY_GROUPS.reduce((n, g) => n + g.caps.length, 0);

  return (
    <div className="saas-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-4 sm:px-5 py-3.5 bg-card-hover flex items-center justify-between gap-3 text-left transition-colors hover:bg-border/40"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <ShieldCheck size={15} className="flex-shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block text-sm font-bold text-foreground">{t.title}</span>
            <span className="block text-[11px] text-muted leading-relaxed">{t.subtitle}</span>
          </span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-2 text-[11px] font-bold text-muted">
          {open ? t.hide : t.show}
          <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
        </span>
      </button>

      {open && (
        // A tabela tem quatro colunas e nomes longos: ela rola dentro da
        // própria caixa. O <main> nunca ganha rolagem horizontal por causa dela.
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 sm:px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted">
                  {t.permission_column}
                </th>
                {ROLES.map((role) => (
                  <th key={role} className="px-3 py-3 text-center">
                    {/* `break-normal` desfaz o `overflow-wrap: anywhere` que o
                        index.css aplica a todo <span>: sem ele, a coluna
                        estreita partia "Administrador" em "Administrad/or". */}
                    <span className="block break-normal text-xs font-bold text-foreground">
                      {ROLE_LABELS[role]}
                    </span>
                    <span className="block text-[10px] font-medium text-muted-soft mt-0.5">
                      {t.count
                        .replace('{n}', String(capabilitiesOf(role).length))
                        .replace('{total}', String(total))}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {CAPABILITY_GROUPS.map((group) => (
                <React.Fragment key={group.id}>
                  <tr className="bg-card-hover">
                    <td
                      colSpan={ROLES.length + 1}
                      className="px-4 sm:px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-primary"
                    >
                      {t.groups[group.id]}
                    </td>
                  </tr>

                  {group.caps.map((cap) => (
                    <tr key={cap} className="border-b border-border last:border-0">
                      <td className="px-4 sm:px-5 py-2.5 text-xs text-foreground-soft">{t.caps[cap]}</td>
                      {ROLES.map((role) => {
                        const allowed = can(role, cap);
                        return (
                          <td key={role} className="px-3 py-2.5 text-center">
                            {/* O ícone sozinho não diz nada a quem usa leitor
                                de tela: o rótulo textual vai junto, oculto. */}
                            <span className="sr-only">{allowed ? t.allowed : t.denied}</span>
                            {allowed ? (
                              <Check size={15} className="inline text-emerald-400" aria-hidden />
                            ) : (
                              <Minus size={15} className="inline text-muted-soft/50" aria-hidden />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
