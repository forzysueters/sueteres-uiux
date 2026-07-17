import React from 'react';
import { User, Mail, Shield, Building2 } from 'lucide-react';

export const AccountPage: React.FC = () => {
  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1>Minha Conta</h1>
        <p>Gerencie suas informações pessoais e credenciais de acesso</p>
      </div>

      <div className="saas-card overflow-hidden">
        <div className="p-8 border-b border-border bg-card-hover flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-card-hover border border-border flex items-center justify-center text-muted">
            <User size={48} />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="!mb-1">Gerente Técnico</h2>
            <p className="font-medium text-primary">Administrador do Sistema</p>
            <div className="flex items-center gap-4 mt-4 text-xs font-medium text-muted">
              <span className="flex items-center gap-1.5"><Mail size={14} /> tecnico@forzy.com.br</span>
              <span className="flex items-center gap-1.5"><Building2 size={14} /> Unidade Industrial A</span>
            </div>
          </div>
          <button className="sm:ml-auto btn-primary !py-2 !px-6 !text-xs !rounded-lg">
            Editar Perfil
          </button>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="flex items-center gap-2">
              <Shield size={18} className="text-primary" />
              Segurança
            </h3>
            <div className="space-y-3">
              <button className="w-full text-left p-4 rounded-xl border border-border hover:bg-card-hover transition-all">
                <p className="font-bold text-sm text-foreground dark:text-white">Alterar Senha</p>
                <p className="text-xs text-muted">Última alteração há 3 meses</p>
              </button>
              <button className="w-full text-left p-4 rounded-xl border border-border hover:bg-card-hover transition-all">
                <p className="font-bold text-sm text-foreground dark:text-white">Autenticação de Dois Fatores</p>
                <p className="text-xs text-emerald-500 font-bold">Ativado</p>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="flex items-center gap-2">
              <Building2 size={18} className="text-primary" />
              Permissões
            </h3>
            <div className="p-4 rounded-xl border border-border bg-card-hover space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted">Acesso à Planta</span>
                <span className="font-bold text-emerald-500 uppercase tracking-widest">Total</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted">Gestão de Alertas</span>
                <span className="font-bold text-emerald-500 uppercase tracking-widest">Total</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted">Editor de Gêmeo Digital</span>
                <span className="font-bold text-amber-500 uppercase tracking-widest">Leitura</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
