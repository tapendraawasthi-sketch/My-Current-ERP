import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Send, ThumbsUp, ThumbsDown, Trash2, X, Bot, Sparkles, Loader2, 
  Brain, Globe, Check, Settings, Key, Search, Copy
} from 'lucide-react';
import { useFalconStore } from '../../store/falconStore';
import { FalconThinkingPanel } from './FalconThinkingPanel';
// If react-hot-toast is used in the project. Assuming standard fallback otherwise.
// import toast from 'react-hot-toast';

const QUICK_PROMPTS = {
  ERP: ["Create sales invoice", "Record payment", "View VAT report", "Add new party", "Check outstanding", "Day book today"],
  Finance: ["Explain double-entry", "What is VAT?", "Trial balance vs P&L", "How is depreciation calculated?"],
  General: ["Current Nepal VAT rate", "Search news", "Calculate compound interest", "Explain inflation"]
};

type PromptTab = 'ERP' | 'Finance' | 'General';

export const FalconPanel: React.FC = () => {
  const { 
    isOpen, isTyping, messages, context, currentThinkingSteps, 
    apiKey, setApiKey, sendMessage, rateMessage, clearHistory, closePanel 
  } = useFalconStore();
  
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [keyInput, setKeyInput] = useState(apiKey);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<PromptTab>('ERP');
  const [panelHeight, setPanelHeight] = useState(620);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, currentThinkingSteps]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        closePanel();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closePanel]);

  const handleSend = () => {
    if (!input.trim() || isTyping) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Stop propagation so ERP shortcuts don't fire when typing
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveKey = () => {
    setApiKey(keyInput);
    setTimeout(() => setShowSettings(false), 1000);
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = panelHeight;

    const doDrag = (dragEvent: MouseEvent) => {
      const diff = startY - dragEvent.clientY;
      const newHeight = Math.max(400, Math.min(window.innerHeight * 0.85, startHeight + diff));
      setPanelHeight(newHeight);
    };

    const stopDrag = () => {
      window.removeEventListener('mousemove', doDrag);
      window.removeEventListener('mouseup', stopDrag);
    };

    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', stopDrag);
  }, [panelHeight]);

  if (!isOpen) return null;

  return (
    <div 
      ref={panelRef}
      className="fixed bottom-4 right-4 w-[420px] bg-white rounded-xl shadow-2xl flex flex-col border border-gray-200 z-[9998] overflow-hidden"
      style={{ height: `${panelHeight}px` }}
    >
      {/* Resize Handle (Top Left) */}
      <div 
        className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-50 flex items-center justify-center"
        onMouseDown={startResize}
      >
        <div className="w-2 h-2 border-t-2 border-l-2 border-gray-400 opacity-50 rounded-tl" />
      </div>

      {/* Header */}
      <div className="bg-[#1557b0] text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1.5 rounded-md">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="font-semibold text-[14px]">Falcon AI</h3>
            <p className="text-[10px] text-blue-200">Sutra ERP Intelligent Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(!showSettings)} className="p-1 hover:bg-white/20 rounded-md transition-colors" title="Settings">
            <Settings size={16} />
          </button>
          <button onClick={clearHistory} className="p-1 hover:bg-white/20 rounded-md transition-colors" title="Clear Chat">
            <Trash2 size={16} />
          </button>
          <button onClick={closePanel} className="p-1 hover:bg-white/20 rounded-md transition-colors" title="Close (Esc)">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-blue-50 border-b border-blue-100 p-3 shrink-0 animate-in slide-in-from-top-2">
          <label className="block text-[11px] font-medium text-blue-900 mb-1">Together AI API Key</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input 
                type={showPassword ? "text" : "password"} 
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                className="w-full text-[12px] h-8 pl-8 pr-8 rounded-md border border-blue-200 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                placeholder="sk-..."
              />
              <Key size={12} className="absolute left-2.5 top-2.5 text-blue-400" />
            </div>
            <button onClick={handleSaveKey} className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] px-3 rounded-md font-medium transition-colors">
              Save Key
            </button>
          </div>
          <div className="flex justify-between items-center mt-2">
            <a href="https://api.together.xyz" target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline flex items-center gap-1">
              <Globe size={10} /> Get free key at together.ai
            </a>
            {apiKey === keyInput && apiKey.length > 10 && (
              <span className="text-[10px] text-green-600 flex items-center gap-1"><Check size={10}/> Configured</span>
            )}
          </div>
        </div>
      )}

      {/* Context Banner */}
      {context.route && context.route !== 'dashboard' && (
        <div className="bg-gray-50 border-b border-gray-100 px-3 py-1.5 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-gray-500 flex items-center gap-1.5">
            <Search size={10} /> Page context: <strong className="text-gray-700">{context.route.replace(/-/g, ' ')}</strong>
          </span>
        </div>
      )}

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f5f6fa]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
                <Bot size={14} className="text-blue-600" />
              </div>
            )}
            
            <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div 
                className={`relative group p-2.5 rounded-lg text-[12px] shadow-sm whitespace-pre-wrap
                  ${msg.role === 'user' 
                    ? 'bg-[#1557b0] text-white rounded-tr-none' 
                    : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                  }`}
              >
                {/* Copy Button */}
                {msg.role === 'assistant' && (
                  <button 
                    onClick={() => copyToClipboard(msg.content, msg.id)}
                    className="absolute top-1 right-1 p-1 rounded-md bg-white/80 opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-opacity"
                    title="Copy response"
                  >
                    {copiedId === msg.id ? <Check size={12} className="text-green-600"/> : <Copy size={12} className="text-gray-400"/>}
                  </button>
                )}

                {msg.content}
              </div>

              {/* Badges and Actions for Assistant Messages */}
              {msg.role === 'assistant' && (
                <div className="mt-1 flex flex-col w-full gap-1">
                  {msg.webSearchUsed && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 self-start">
                      <Globe size={10} /> Searched web
                    </span>
                  )}

                  {msg.reasoningSteps && msg.reasoningSteps.length > 0 && (
                    <FalconThinkingPanel 
                      steps={msg.reasoningSteps} 
                      category={msg.category} 
                      defaultExpanded={false}
                    />
                  )}

                  {/* Feedback */}
                  {msg.id !== 'welcome' && (
                    <div className="flex gap-1.5 mt-1">
                      <button onClick={() => rateMessage(msg.id, 1)} className={`p-1 rounded ${msg.feedback === 1 ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-green-600 hover:bg-gray-100'}`}>
                        <ThumbsUp size={12} />
                      </button>
                      <button onClick={() => rateMessage(msg.id, -1)} className={`p-1 rounded ${msg.feedback === -1 ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-600 hover:bg-gray-100'}`}>
                        <ThumbsDown size={12} />
                      </button>
                    </div>
                  )}

                  {/* Suggestions */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {msg.suggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => { setInput(suggestion); setTimeout(handleSend, 0); }}
                          className="text-[10px] bg-white border border-blue-200 text-blue-700 px-2 py-1 rounded-full hover:bg-blue-50 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Live Typing / Thinking Indicator */}
        {isTyping && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Loader2 size={14} className="text-blue-600 animate-spin" />
            </div>
            <div className="flex flex-col max-w-[85%]">
              <div className="bg-white border border-gray-100 text-gray-500 text-[11px] p-2.5 rounded-lg rounded-tl-none shadow-sm flex items-center gap-2">
                <span className="flex gap-1">
                  <span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay:'150ms'}}>.</span><span className="animate-bounce" style={{animationDelay:'300ms'}}>.</span>
                </span>
                {currentThinkingSteps.length > 0 
                  ? <span>{currentThinkingSteps[currentThinkingSteps.length - 1].title}...</span>
                  : <span>Falcon is thinking...</span>
                }
              </div>
              {currentThinkingSteps.length > 0 && (
                <FalconThinkingPanel 
                  steps={currentThinkingSteps} 
                  isLive={true} 
                  defaultExpanded={true} 
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="bg-white border-t border-gray-100 p-2 shrink-0">
        <div className="flex gap-1 mb-2 px-1">
          {(['ERP', 'Finance', 'General'] as PromptTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${activeTab === tab ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex overflow-x-auto gap-2 pb-1 px-1 scrollbar-hide">
          {QUICK_PROMPTS[activeTab].map((prompt, i) => (
            <button
              key={i}
              onClick={() => { setInput(prompt); }}
              className="text-[10px] whitespace-nowrap bg-gray-50 border border-gray-200 text-gray-600 px-2.5 py-1 rounded-md hover:bg-gray-100 hover:border-gray-300 transition-all shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="p-3 bg-white border-t border-gray-200 shrink-0">
        <div className="relative flex items-end gap-2 bg-gray-50 border border-gray-300 rounded-lg p-1.5 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Falcon anything... (Ctrl+K)"
            className="flex-1 max-h-32 min-h-[36px] bg-transparent resize-none outline-none text-[12px] p-2 placeholder-gray-400"
            rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 4) : 1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className={`p-2 mb-0.5 rounded-md flex shrink-0 items-center justify-center transition-colors
              ${input.trim() && !isTyping ? 'bg-[#1557b0] text-white hover:bg-[#0f4a96]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          >
            <Send size={14} className={isTyping ? 'animate-pulse' : ''} />
          </button>
        </div>
        <div className="text-center mt-2">
          <span className="text-[9px] text-gray-400 font-medium">FALCON AI CAN MAKE MISTAKES. VERIFY IMPORTANT INFO.</span>
        </div>
      </div>
    </div>
  );
};
