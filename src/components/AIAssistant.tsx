import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, ChevronRight, MessageSquarePlus, FileText } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/api';
import { ChatMessage } from '../types';

const QUICK_QUESTIONS = [
  'Quais ativos precisam de manutenção hoje?',
  'Qual o status do compressor CMP-001?',
  'Explique o insight de anomalia do MTR-002.',
  'O que a placa do motor informa sobre a vibração esperada?',
];

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

const GREETING: ChatMessage = {
  id: 'init',
  role: 'assistant',
  content: 'Olá! Eu sou a Inteligência Forzy. Posso responder sobre telemetria em tempo real, alertas, histórico de manutenções e dados das placas dos equipamentos — e lembro do que conversamos, então você pode fazer perguntas de acompanhamento. Selecione um ativo na Planta para focar a conversa ou faça uma pergunta geral.',
  timestamp: new Date().toISOString(),
};

export const AIAssistant: React.FC = () => {
  const {
    selectedAssetId, chatMessages, addChatMessage, conversationId, setConversationId, clearChatMessages,
  } = useAppStore();
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
        content: 'Desculpe, não foi possível processar sua mensagem agora. Verifique sua conexão e tente novamente.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full saas-card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card-hover flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Inteligência Forzy</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Online</span>
              {selectedAssetId && (
                <span className="text-[9px] text-primary font-bold ml-2">· contexto ativo</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewConversation}
            disabled={isTyping || chatMessages.length <= 1}
            title="Iniciar nova conversa"
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <MessageSquarePlus size={16} />
          </button>
          <Sparkles size={16} className="text-primary opacity-50" />
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin bg-background">
        {chatMessages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 mt-1 border ${
                m.role === 'user' ? 'bg-card-hover border-border text-muted' : 'bg-primary border-primary text-white'
              }`}>
                {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`p-4 rounded-xl text-sm leading-relaxed whitespace-pre-line ${
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
                  {new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  {m.offline && (
                    <span className="text-amber-500 opacity-100 font-sans font-semibold uppercase tracking-wide">
                      · modo offline
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

      {/* Quick suggestions */}
      <div className="px-4 pt-3 border-t border-border flex-shrink-0">
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-2">
          {QUICK_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSend(q)}
              disabled={isTyping}
              className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card-hover text-[10px] font-medium text-muted hover:text-foreground hover:border-primary/30 transition-all disabled:opacity-40"
            >
              <ChevronRight size={10} className="text-primary" />
              {q.length > 35 ? q.substring(0, 35) + '…' : q}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={selectedAssetId ? 'Pergunta sobre o ativo selecionado…' : 'Pergunte sobre seus ativos…'}
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
};
