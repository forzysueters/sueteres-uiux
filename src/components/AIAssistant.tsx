import React, { forwardRef, useImperativeHandle, useState, useRef, useEffect } from 'react';
import { Send, User, Sparkles, MessageSquarePlus, FileText } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/api';
import { ChatMessage } from '../types';
import { translations } from '../translations';
import { AvatarFace } from '../assistant';

/** Interpreta **negrito** sem markdown completo — evita dangerouslySetInnerHTML. */
function renderContent(content: string): React.ReactNode {
  const parts = content.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-bold text-foreground">{part}</strong> : part,
  );
}

/** Agrega citações repetidas do mesmo documento em uma única etiqueta. */
function dedupeCitations(citations: ChatMessage['citations']) {
  if (!citations?.length) return [];
  const seen = new Map<string, { document_title: string; page_number: number | null }>();
  for (const c of citations) {
    const key = `${c.document_title}-${c.page_number ?? ''}`;
    if (!seen.has(key)) seen.set(key, { document_title: c.document_title, page_number: c.page_number });
  }
  return [...seen.values()];
}

export interface AIAssistantHandle {
  /** Envia uma pergunta como se o usuário tivesse digitado — usada pelos atalhos da página. */
  ask: (question: string) => void;
}

export const AIAssistant = forwardRef<AIAssistantHandle>((_props, ref) => {
  const {
    selectedAssetId, chatMessages, addChatMessage, conversationId, setConversationId, clearChatMessages, language,
  } = useAppStore();
  const t = translations[language].assistant;
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';
  const GREETING: ChatMessage = {
    id: 'init',
    role: 'assistant',
    content: t.greeting,
    timestamp: new Date().toISOString(),
  };
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Saudação inicial. Lê o estado direto da store (não o valor fechado no
  // render) para não duplicar a mensagem quando o StrictMode roda o efeito
  // duas vezes em desenvolvimento.
  useEffect(() => {
    if (useAppStore.getState().chatMessages.length === 0) {
      addChatMessage(GREETING);
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isTyping]);

  const handleNewConversation = () => {
    if (isTyping) return;
    clearChatMessages();
    addChatMessage({ ...GREETING, id: `init-${Date.now()}`, timestamp: new Date().toISOString() });
  };

  const handleSend = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || isTyping) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      assetContext: selectedAssetId ?? undefined,
    };

    // Histórico enviado ao agente: exclui a saudação, mantém as últimas trocas.
    const history = [...chatMessages, userMsg]
      .filter((m) => !m.id.startsWith('init'))
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    addChatMessage(userMsg);
    setInput('');
    setIsTyping(true);

    try {
      const response = await apiService.getChatResponse(
        message,
        selectedAssetId ?? undefined,
        history,
        conversationId,
      );
      setConversationId(response.conversationId);
      addChatMessage(response);
    } catch {
      addChatMessage({
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: t.error_message,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsTyping(false);
    }
  };

  useImperativeHandle(ref, () => ({ ask: handleSend }));

  return (
    <div className="flex flex-col h-full saas-card overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-card-hover flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex-shrink-0">
            <AvatarFace size={36} state={isTyping ? 'thinking' : 'idle'} orbit={false} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground">{t.header_title}</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">{t.online}</span>
              {selectedAssetId && (
                <span className="text-[9px] text-primary font-bold ml-2">· {t.context_active}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewConversation}
            disabled={isTyping || chatMessages.length <= 1}
            title={t.new_conversation}
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <MessageSquarePlus size={16} />
          </button>
          <Sparkles size={16} className="text-primary opacity-50" />
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 scrollbar-thin bg-background">
        {chatMessages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className={`flex min-w-0 gap-2.5 sm:gap-3 max-w-[88%] sm:max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {m.role === 'user' ? (
                <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 mt-1 border bg-card-hover border-border text-muted">
                  <User size={16} />
                </div>
              ) : (
                <div className="flex-shrink-0 mt-1">
                  <AvatarFace size={32} state="idle" orbit={false} />
                </div>
              )}
              <div className={`min-w-0 break-words p-3 sm:p-4 rounded-xl text-sm leading-relaxed whitespace-pre-line ${
                m.role === 'user'
                  ? 'bg-card-hover border border-border text-foreground rounded-tr-none'
                  : 'bg-card border border-border text-foreground rounded-tl-none'
              }`}>
                {renderContent(m.content)}

                {m.role === 'assistant' && dedupeCitations(m.citations).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap gap-1.5">
                    {dedupeCitations(m.citations).map((c, i) => (
                      <span
                        key={i}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-primary/10 text-primary font-medium"
                      >
                        <FileText size={10} />
                        {c.document_title}{c.page_number ? ` · p.${c.page_number}` : ''}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-muted opacity-50">
                  {new Date(m.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                  {m.offline && (
                    <span className="text-amber-500 opacity-100 font-sans font-semibold uppercase tracking-wide">
                      · {t.offline_mode}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start animate-fade-in">
            <div className="flex gap-3">
              <AvatarFace size={32} state="thinking" orbit={false} />
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
      <div className="p-3 sm:p-4 flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={selectedAssetId ? t.placeholder_with_asset : t.placeholder_generic}
            className="w-full h-12 pl-4 pr-12 rounded-lg bg-card-hover border border-border text-foreground placeholder:text-muted-soft focus:outline-none focus:border-primary/50 transition-all text-sm font-medium"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-md text-primary hover:text-primary/80 hover:bg-primary/10 transition-all disabled:opacity-30 flex items-center justify-center"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
});
