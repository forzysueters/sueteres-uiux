import React, { useEffect, useState } from 'react';
import { Users, ShieldAlert, Loader2, AlertTriangle, Check, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../../services/api';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { translations } from '../../translations';
import { ROLE_LABELS } from '../../types/auth';
import type { UserRole } from '../../types/auth';
import type { PlatformUser } from '../../types';
import { cn } from '../../lib/utils';

const ROLES: UserRole[] = ['admin', 'engineer', 'technician'];

/**
 * Administração de usuários — a contrapartida que faltava ao cadastro
 * espontâneo nascer inativo. Sem esta tela, liberar alguém só era possível por
 * SQL no painel do Supabase.
 *
 * Escreve exatamente duas coisas: papel e estado. Convidar usuário fica de fora
 * porque exige a Auth Admin API com a chave secreta, que não pode ir para o
 * navegador.
 */
export const UsersPage: React.FC = () => {
  const { language } = useAppStore();
  const me = useAuthStore((s) => s.user);
  const t = translations[language].users;
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  const [users, setUsers] = useState<PlatformUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setUsers(null);
    setError(null);
    apiService.getUsers()
      .then(setUsers)
      .catch((err) => { setError((err as Error).message); setUsers([]); });
  };

  useEffect(load, []);

  const apply = async (user: PlatformUser, patch: { role?: UserRole; isActive?: boolean }) => {
    if (busyId) return;
    setBusyId(user.id);
    try {
      await apiService.updateUserAccess(user.id, patch);
      toast.success(t.saved.replace('{name}', user.name));
      load();
    } catch (err) {
      // O banco recusa admin rebaixando a si mesmo e a remoção do último admin
      // ativo; a mensagem vem de lá, já explicando o motivo.
      toast.error((err as Error)?.message ?? t.save_error);
    } finally {
      setBusyId(null);
    }
  };

  const pending = users?.filter((u) => !u.isActive).length ?? 0;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-3 text-2xl sm:text-3xl">
          <Users className="w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0 text-primary" />
          <span className="min-w-0 break-words">{t.title}</span>
        </h1>
        <p>{t.subtitle}</p>
      </div>

      {pending > 0 && (
        <div className="saas-card border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <ShieldAlert size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
          <p className="text-xs font-medium text-amber-500/90 leading-relaxed">
            {(pending === 1 ? t.pending_one : t.pending_many.replace('{n}', String(pending)))}
          </p>
        </div>
      )}

      {error && (
        <div className="saas-card border-red-500/20 bg-red-500/5 p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-red-400" />
          <p className="text-xs font-medium text-red-400 leading-relaxed">{error}</p>
        </div>
      )}

      <div className="saas-card overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-border bg-card-hover flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-foreground">{t.list_title}</span>
          <button onClick={load} className="btn-ghost text-xs">
            <RefreshCw size={13} />
            {t.reload}
          </button>
        </div>

        {users === null ? (
          <div className="flex items-center gap-2 p-6 text-xs text-muted">
            <Loader2 size={14} className="animate-spin" />
            {t.loading}
          </div>
        ) : users.length === 0 ? (
          <p className="p-6 text-xs text-muted">{t.empty}</p>
        ) : (
          <div className="divide-y divide-border">
            {users.map((user) => {
              const isSelf = user.id === me?.id;
              const busy = busyId === user.id;

              return (
                <div key={user.id} className="p-4 sm:p-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
                      <span className="truncate">{user.name}</span>
                      {!user.isActive && (
                        <span className="badge bg-amber-500/10 border-amber-500/30 text-amber-500 px-2 py-0.5 text-[9px]">
                          {t.inactive}
                        </span>
                      )}
                      {isSelf && (
                        <span className="badge bg-card-hover border-border text-muted px-2 py-0.5 text-[9px]">
                          {t.you}
                        </span>
                      )}
                      {user.roleOutOfSync && (
                        <span
                          title={t.out_of_sync_hint}
                          className="badge bg-card-hover border-border text-muted px-2 py-0.5 text-[9px]"
                        >
                          {t.out_of_sync}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5 truncate">
                      {user.email}{user.jobTitle ? ` · ${user.jobTitle}` : ''}
                    </p>
                    <p className="text-[10px] text-muted-soft mt-0.5">
                      {user.lastLoginAt
                        ? `${t.last_login} ${new Date(user.lastLoginAt).toLocaleString(locale)}`
                        : t.never_logged_in}
                    </p>
                  </div>

                  <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                    {/* O banco recusa o admin mudando o próprio papel ou estado;
                        aqui os controles somem para não convidar ao erro. */}
                    {isSelf ? (
                      <span className="text-[11px] font-bold uppercase tracking-widest text-muted">
                        {ROLE_LABELS[user.role]}
                      </span>
                    ) : (
                      <>
                        <div className="inline-flex rounded-lg bg-card-hover border border-border p-0.5">
                          {ROLES.map((role) => (
                            <button
                              key={role}
                              disabled={busy || role === user.role}
                              onClick={() => apply(user, { role })}
                              className={cn(
                                'px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all',
                                role === user.role
                                  ? 'bg-primary text-white'
                                  : 'text-muted hover:text-foreground disabled:opacity-40',
                              )}
                            >
                              {ROLE_LABELS[role]}
                            </button>
                          ))}
                        </div>

                        <button
                          disabled={busy}
                          onClick={() => apply(user, { isActive: !user.isActive })}
                          className={cn(
                            'btn-ghost text-xs disabled:opacity-40',
                            user.isActive ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300',
                          )}
                        >
                          {busy
                            ? <Loader2 size={13} className="animate-spin" />
                            : user.isActive ? <X size={13} /> : <Check size={13} />}
                          {user.isActive ? t.deactivate : t.activate}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
