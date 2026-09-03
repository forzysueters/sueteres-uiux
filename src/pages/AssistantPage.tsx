import { Bot, Sparkles, MessageSquare, ShieldCheck, BarChart2 } from 'lucide-react';
import { AIAssistant } from '../components/AIAssistant';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';

export const AssistantPage: React.FC = () => {
  const { language } = useAppStore();
  const t = translations[language].assistant;

  const quickQuestions = [
    { icon: MessageSquare, text: t.sidebar_q1, color: 'text-amber-500' },
    { icon: BarChart2, text: t.sidebar_q2, color: 'text-emerald-500' },
    { icon: ShieldCheck, text: t.sidebar_q3, color: 'text-amber-500' },
  ];

  const capabilities = [
    t.capability1,
    t.capability2,
    t.capability3,
    t.capability4,
  ];

  return (
    <div className="h-full flex flex-col gap-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3">
            <Bot className="w-7 h-7 text-primary" />
            {t.title}
          </h1>
          <p>
            {t.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10 text-primary">
          <Sparkles size={14} className="animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest">{t.context_badge}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 flex-1 min-h-0">
        <div data-tour="ai-chat" className="lg:col-span-2 h-[70vh] min-h-[440px] lg:h-full">
          <AIAssistant />
        </div>

        <div className="space-y-6 lg:space-y-8">
          <div className="saas-card p-4 sm:p-6">
            <span className="section-title">{t.quick_suggestions}</span>
            <div className="space-y-3">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  className="w-full text-left p-4 rounded-xl border border-border bg-card-hover hover:bg-border/40 hover:border-primary/30 transition-all group"
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

          <div className="saas-card p-4 sm:p-6 bg-primary/5 border-primary/10">
            <span className="section-title !text-primary">{t.capabilities_title}</span>
            <ul className="space-y-3">
              {capabilities.map((item, i) => (
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
