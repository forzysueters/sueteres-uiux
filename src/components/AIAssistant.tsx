import React, { useEffect, useState } from 'react';
import { Send, Loader } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/api';
import { ChatMessage } from '../types';

interface AIAssistantProps {
  selectedAssetId?: string;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ selectedAssetId }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { chatMessages, updateChatMessage } = useAppStore();

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
      assetContext: selectedAssetId,
    };
    updateChatMessage(userMessage);
    setInput('');

    // Get AI response
    setLoading(true);
    try {
      const response = await apiService.getChatResponse(input, selectedAssetId);
      updateChatMessage(response);
    } finally {
      setLoading(false);
    }
  };

  const messages = chatMessages.slice(-10); // Show last 10 messages

  return (
    <div className="flex flex-col h-full bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-700 p-4 bg-gradient-to-r from-slate-800 to-slate-800/50">
        <h3 className="font-semibold text-slate-100">AI Maintenance Assistant</h3>
        <p className="text-xs text-slate-400 mt-1">
          {selectedAssetId ? 'Contextual guidance for selected asset' : 'Ask about maintenance issues'}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-slate-400 text-sm">Start a conversation</p>
              <p className="text-slate-500 text-xs mt-2">Ask about maintenance, diagnostics, or asset status</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-slate-700 text-slate-100 rounded-bl-none'
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                <p className="text-xs opacity-50 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-slate-100">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-700 p-4 bg-slate-800/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !loading) {
                handleSendMessage();
              }
            }}
            placeholder="Ask about maintenance..."
            className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            disabled={loading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || loading}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
