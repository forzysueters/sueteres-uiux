import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';

/**
 * Destino de qualquer caminho que não casa com rota nenhuma.
 *
 * Sem ela o `<Routes>` não achava nada para renderizar e a área de conteúdo
 * ficava vazia sob o cabeçalho — indistinguível de uma tela que falhou ao
 * carregar. Mostrar o caminho pedido importa: é ele que diz se o problema foi
 * um link velho, um typo ou uma rota que mudou de lugar.
 */
export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useAppStore();
  const t = translations[language].notFound;

  return (
    <div className="saas-card flex flex-col items-center justify-center text-center py-20 px-6">
      <div className="w-14 h-14 rounded-2xl bg-card-hover border border-border flex items-center justify-center mb-4 text-muted">
        <Compass size={26} />
      </div>
      <p className="text-sm font-semibold text-foreground">{t.title}</p>
      <p className="text-xs text-muted mt-1 max-w-sm leading-relaxed">{t.description}</p>
      <code className="mt-3 rounded bg-card-hover px-2 py-1 font-mono text-[11px] text-foreground-soft break-all">
        {location.pathname}
      </code>
      <button onClick={() => navigate('/planta')} className="btn-ghost text-xs mt-5">
        <ArrowLeft size={14} />
        {t.back_to_plant}
      </button>
    </div>
  );
};
