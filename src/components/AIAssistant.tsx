import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, ChevronRight } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const AIAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Olá! Eu sou o assistente Forzy IA. Como posso ajudar com o monitoramento de seus ativos hoje?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Estou analisando a telemetria em tempo real para responder sua pergunta. Com base nos dados atuais, o Motor de Produção Principal está mostrando uma vibração 15% acima da linha de base, sugerindo uma inspeção de rolamentos em breve.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full saas-card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground dark:text-white">Inteligência Forzy</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Online</span>
            </div>
          </div>
        </div>
        <Sparkles size={16} className="text-primary opacity-50" />
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin bg-slate-950/20"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div
                className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 mt-1 border ${
                  m.role === 'user'
                    ? 'bg-slate-800 border-slate-700 text-muted'
                    : 'bg-primary border-primary text-white'
                }`}
              >
                {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div
                className={`p-4 rounded-xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-slate-800 border border-slate-700 text-foreground dark:text-white rounded-tr-none'
                    : 'bg-card border border-border text-foreground dark:text-slate-300 rounded-tl-none'
                }`}
              >
                {m.content}
                <div className="mt-2 text-[10px] font-mono text-muted opacity-50">
                  {m.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start animate-fade-in">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-white">
                <Bot size={16} />
              </div>
              <div className="p-4 rounded-xl rounded-tl-none bg-card border border-border flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-slate-900/50">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Pergunte sobre seus ativos..."
            className="w-full h-12 pl-4 pr-12 rounded-lg bg-slate-950 border border-border text-foreground dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50 transition-all text-sm font-medium"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-md text-primary hover:text-primary/80 hover:bg-primary/10 transition-all disabled:opacity-30 flex items-center justify-center"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-[9px] font-bold uppercase tracking-widest text-muted">
          <span className="flex items-center gap-1">
            <ChevronRight size={12} className="text-primary" />
            Vibração
          </span>
          <span className="flex items-center gap-1">
            <ChevronRight size={12} className="text-primary" />
            Disponibilidade
          </span>
          <span className="flex items-center gap-1">
            <ChevronRight size={12} className="text-primary" />
            Manutenção
          </span>
        </div>
      </div>
    </div>
  );
};
