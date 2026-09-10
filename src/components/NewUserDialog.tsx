import React, { useState } from 'react';
import { Loader2, UserPlus, Eye, EyeOff, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog } from './Dialog';
import { apiService } from '../services/api';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import { ROLE_LABELS } from '../types/auth';
import type { UserRole } from '../types/auth';
import { cn } from '../lib/utils';

/**
 * Papéis que a aplicação atribui ao criar uma conta.
 *
 * `admin` está deliberadamente fora: a conta de administrador é provisionada
 * pelo time de desenvolvimento, fora do produto. A mesma lista existe na Edge
 * Function e a migração 0017 recusa a promoção no banco — a ausência aqui é
 * conveniência, não a trava.
 */
const ASSIGNABLE_ROLES: Exclude<UserRole, 'admin'>[] = ['engineer', 'technician'];

/** Mesmo mínimo que a tela de login exige de quem se cadastra sozinho. */
const MIN_PASSWORD_LENGTH = 8;

interface NewUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado depois de uma criação aceita pelo servidor, para recarregar a lista. */
  onCreated: () => void;
}

export const NewUserDialog: React.FC<NewUserDialogProps> = ({ open, onOpenChange, onCreated }) => {
  const { language } = useAppStore();
  const t = translations[language].newUser;
  const common = translations[language].common;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Exclude<UserRole, 'admin'>>('technician');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setRole('technician');
    setError(null);
  };

  const close = (next: boolean) => {
    if (saving) return; // fechar no meio do envio deixaria o resultado órfão
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async () => {
    setError(null);

    // Validação local só para o que é gritante — quem decide de verdade é a
    // function, que revalida tudo antes de criar a conta.
    if (!firstName.trim() || !lastName.trim()) return setError(t.error_name);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(t.error_email);
    if (password.length < MIN_PASSWORD_LENGTH) return setError(t.error_password);

    setSaving(true);
    try {
      await apiService.createUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        role,
      });
      toast.success(t.created.replace('{email}', email.trim()));
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full h-10 rounded-lg border border-border bg-card-hover px-3 text-xs font-medium text-foreground placeholder:text-muted-soft focus:border-primary/50 focus:outline-none disabled:opacity-50';
  const label = 'text-xs font-semibold text-muted mb-1.5 block';

  return (
    <Dialog open={open} onOpenChange={close} title={t.title} description={t.description}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="new-user-first" className={label}>{t.first_name}</label>
            <input
              id="new-user-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={saving}
              autoComplete="off"
              className={field}
            />
          </div>
          <div>
            <label htmlFor="new-user-last" className={label}>{t.last_name}</label>
            <input
              id="new-user-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={saving}
              autoComplete="off"
              className={field}
            />
          </div>
        </div>

        <div>
          <label htmlFor="new-user-email" className={label}>{t.email}</label>
          <input
            id="new-user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={saving}
            autoComplete="off"
            placeholder={t.email_placeholder}
            className={field}
          />
        </div>

        <div>
          <label htmlFor="new-user-password" className={label}>{t.password}</label>
          <div className="relative">
            <input
              id="new-user-password"
              // Alternar o tipo é o que permite conferir a senha antes de
              // repassá-la. Sem isso, um typo só apareceria quando a pessoa
              // tentasse entrar e não conseguisse.
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              disabled={saving}
              // `new-password` impede o gerenciador de senhas de oferecer a
              // credencial de quem está logado num campo que é de outra pessoa.
              autoComplete="new-password"
              className={cn(field, 'pr-10')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t.hide_password : t.show_password}
              title={showPassword ? t.hide_password : t.show_password}
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-[11px] text-muted mt-1.5 leading-relaxed">{t.password_hint}</p>
        </div>

        <div>
          <span className={label}>{t.role}</span>
          <div className="inline-flex rounded-lg bg-card-hover border border-border p-0.5">
            {ASSIGNABLE_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                disabled={saving}
                aria-pressed={role === r}
                onClick={() => setRole(r)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-[11px] font-bold transition-all disabled:opacity-40',
                  role === r ? 'bg-primary text-white' : 'text-muted hover:text-foreground',
                )}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-2 leading-relaxed">{t.role_hint}</p>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card-hover p-3">
          <Info size={14} className="flex-shrink-0 mt-0.5 text-muted" />
          <p className="text-[11px] text-muted leading-relaxed">{t.handoff_hint}</p>
        </div>

        {error && (
          <p className="text-[11px] font-medium text-red-400 leading-relaxed">{error}</p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <button onClick={() => close(false)} disabled={saving} className="btn-ghost text-xs disabled:opacity-40">
            {common.cancel}
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="h-10 px-4 rounded-lg bg-primary text-white text-xs font-bold flex items-center justify-center gap-2 transition-all hover:bg-primary/90 disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            {saving ? t.saving : t.submit}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
