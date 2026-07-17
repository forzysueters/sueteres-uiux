import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, ChevronRight } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/api';
import { ChatMessage } from '../types';

const QUICK_QUESTIONS = [
  'Quais ativos precisam de manutenção hoje?',
  'Qual o status do compressor CMP-001?',
  'Explique o insight de anomalia do MTR-002.',
  'O que a placa do motor informa sobre a vibração esperada?',
];

export const AIAssistant: React.FC = () => {
  const { selectedAssetId, chatMessages, addChatMessage } = useAppStore();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial greeting
  useEffect(() => {
    if (chatMessages.length === 0) {
      addChatMessage({
        id: 'init',
        role: 'assistant',
        content: 'Olá! Eu sou o Assistente Forzy IA. Posso responder sobre telemetria em tempo real, alertas, histórico de manutenções e dados das placas dos equipamentos. Selecione um ativo na Planta para contexto ou faça uma pergunta geral.',
        timestamp: new Date().toISOString(),
      });
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isTyping]);

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
    addChatMessage(userMsg);
    setInput('');
    setIsTyping(true);

    try {
      const response = await apiService.getChatResponse(message, selectedAssetId ?? undefined);
      addChatMessage(response);
    } catch {
      addChatMessage({
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Desculpe, não foi possível processar sua mensagem. Tente novamente.',
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
        <Sparkles size={16} className="text-primary opacity-50" />
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
              <div className={`p-4 rounded-xl text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-card-hover border border-border text-foreground rounded-tr-none'
                  : 'bg-card border border-border text-foreground rounded-tl-none'
              }`}>
                {m.content}
                <div className="mt-2 text-[10px] font-mono text-muted opacity-50">
                  {new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
