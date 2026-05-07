import { Bot, Sparkles, MessageSquare, ShieldCheck, BarChart2 } from 'lucide-react';
import { AIAssistant } from '../components/AIAssistant';

const quickQuestions = [
  { icon: MessageSquare, text: 'Quais ativos precisam de manutenção hoje?', color: 'text-amber-500' },
  { icon: BarChart2, text: 'Gere um relatório de eficiência da Hall A.', color: 'text-emerald-500' },
  { icon: ShieldCheck, text: 'Verifique o status do Motor de Produção.', color: 'text-amber-500' },
];

export const AssistantPage: React.FC = () => {
  return (
    <div className="h-full flex flex-col gap-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3">
            <Bot className="w-7 h-7 text-primary" />
            Assistente IA
          </h1>
          <p>
            Fale com a Inteligência Forzy para insights preditivos e suporte operacional
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10 text-primary">
          <Sparkles size={14} className="animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Contexto Ativo</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0">
        <div className="lg:col-span-2 h-[480px] sm:h-[560px] lg:h-full">
          <AIAssistant />
        </div>

        <div className="space-y-8">
          <div className="saas-card p-6">
            <span className="section-title">Sugestões Rápidas</span>
            <div className="space-y-3">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  className="w-full text-left p-4 rounded-xl border border-border bg-slate-800/20 hover:bg-slate-800/50 hover:border-primary/30 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <q.icon size={16} className={`mt-0.5 ${q.color}`} />
                    <p className="text-xs font-medium text-muted group-hover:text-foreground dark:group-hover:text-white transition-colors">
                      "{q.text}"
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="saas-card p-6 bg-primary/5 border-primary/10">
            <span className="section-title !text-primary">Capacidades da IA</span>
            <ul className="space-y-3">
              {[
                'Análise preditiva de causa raiz',
                'Otimização de cronograma de manutenção',
                'Resumo do histórico de anomalias',
                'Cálculo de RUL (Vida Útil Restante)',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-xs font-medium text-muted">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
