import React, { useState } from 'react';
import { toast } from 'sonner';
import { User, Mail, Shield, Building2, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import { ROLE_LABELS, canWrite } from '../types/auth';
import { Dialog } from '../components/Dialog';

const EditProfileDialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void }> = ({ open, onOpenChange }) => {
  const { user, updateProfile } = useAuthStore();
  const { language } = useAppStore();
  const t = translations[language].account;
  const common = translations[language].common;
  const [fullName, setFullName] = useState(user?.name ?? '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ fullName, jobTitle: jobTitle || null, department: department || null });
      toast.success(t.profile_updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.profile_update_failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t.edit_profile_title}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted mb-1.5 block">{t.full_name_label}</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input-field w-full"
            placeholder={t.full_name_placeholder}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted mb-1.5 block">{t.job_title_label}</label>
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className="input-field w-full"
            placeholder={t.job_title_placeholder}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted mb-1.5 block">{t.department_label}</label>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="input-field w-full"
            placeholder={t.department_placeholder}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => onOpenChange(false)} className="btn-ghost !text-xs">{common.cancel}</button>
          <button onClick={handleSave} disabled={saving || !fullName.trim()} className="btn-primary !text-xs disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {common.save}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

const ChangePasswordDialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void }> = ({ open, onOpenChange }) => {
  const { changePassword } = useAuthStore();
  const { language } = useAppStore();
  const t = translations[language].account;
  const common = translations[language].common;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSave = async () => {
    setValidationError(null);
    if (password.length < 8) {
      setValidationError(t.password_min_length);
      return;
    }
    if (password !== confirm) {
      setValidationError(t.passwords_mismatch);
      return;
    }
    setSaving(true);
    try {
      await changePassword(password);
      toast.success(t.password_changed);
      setPassword('');
      setConfirm('');
      onOpenChange(false);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : t.password_change_failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t.change_password_title} description={t.change_password_full_desc}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted mb-1.5 block">{t.new_password_label}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field w-full"
            placeholder="••••••••"
            aria-invalid={!!validationError}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted mb-1.5 block">{t.confirm_password_label}</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input-field w-full"
            placeholder="••••••••"
            aria-invalid={!!validationError}
          />
        </div>
        {validationError && (
          <p role="alert" className="text-xs font-medium text-danger">{validationError}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => onOpenChange(false)} className="btn-ghost !text-xs">{common.cancel}</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary !text-xs disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {t.change_password}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export const AccountPage: React.FC = () => {
  const { user } = useAuthStore();
  const { language } = useAppStore();
  const t = translations[language].account;
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const roleLabel = user ? ROLE_LABELS[user.role] : '—';
  const writeAccess = canWrite(user?.role);

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
      </div>

      <div className="saas-card overflow-hidden">
        <div className="p-8 border-b border-border bg-card-hover flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-card-hover border border-border flex items-center justify-center text-muted">
            <User size={48} />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="!mb-1">{user?.name ?? '—'}</h2>
            <p className="font-medium text-primary">{roleLabel}{user?.jobTitle ? ` · ${user.jobTitle}` : ''}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-4 text-xs font-medium text-muted">
              <span className="flex items-center gap-1.5"><Mail size={14} /> {user?.email ?? '—'}</span>
              {user?.department && (
                <span className="flex items-center gap-1.5"><Building2 size={14} /> {user.department}</span>
              )}
            </div>
          </div>
          <button onClick={() => setEditOpen(true)} className="sm:ml-auto btn-primary !py-2 !px-6 !text-xs !rounded-lg">
            {t.edit_profile}
          </button>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="flex items-center gap-2">
              <Shield size={18} className="text-primary" />
              {t.security}
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => setPasswordOpen(true)}
                className="w-full text-left p-4 rounded-xl border border-border hover:bg-card-hover transition-all"
              >
                <p className="font-bold text-sm text-foreground dark:text-white">{t.change_password}</p>
                <p className="text-xs text-muted">{t.change_password_desc}</p>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="flex items-center gap-2">
              <Building2 size={18} className="text-primary" />
              {t.access}
            </h3>
            <div className="p-4 rounded-xl border border-border bg-card-hover space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted">{t.role_label}</span>
                <span className="font-bold text-foreground uppercase tracking-widest">{roleLabel}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted">{t.write_access}</span>
                <span className={`font-bold uppercase tracking-widest ${writeAccess ? 'text-success' : 'text-warning'}`}>
                  {writeAccess ? t.granted : t.read_only}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} />
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
};
