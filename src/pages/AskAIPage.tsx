import { useState } from 'react';
import { Sparkles, Send, Paperclip, Clock, MessageSquare, Trash2, Plus, Info, X } from 'lucide-react';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';

const MOCK_HISTORY = [
  { id: '1', title: 'Macroeconomics GDP Questions', date: '2 hours ago' },
  { id: '2', title: 'Business Law Contract Cases', date: 'Yesterday' },
  { id: '3', title: 'Calculus Chain Rule Practice', date: '3 days ago' },
];

const MOCK_MESSAGES = [
  { id: '1', role: 'user', content: 'Can you explain how GDP is calculated using the expenditure approach?' },
  { id: '2', role: 'assistant', content: 'Certainly! The expenditure approach calculates GDP by summing up all the expenditures made on final goods and services in an economy. The formula is:\n\n**GDP = C + I + G + (X - M)**\n\nWhere:\n- **C** is Consumer spending\n- **I** is Business investment\n- **G** is Government spending\n- **X** is Exports\n- **M** is Imports\n\nWould you like me to explain any of these components in more detail?' },
];

const AskAIPage = () => {
  const [message, setMessage] = useState('');
  const [showBanner, setShowBanner] = useState(true);
  
  // Mobile sidebar state
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <div className="w-full flex-grow flex flex-col h-[100dvh] md:h-[calc(100vh-80px)] mb-20 md:mb-0 max-w-[1400px] mx-auto overflow-hidden relative">
      
      {/* Mobile Sidebar Toggle */}
      <button 
        onClick={() => setShowSidebar(!showSidebar)}
        className="md:hidden absolute top-4 left-4 z-20 flex items-center justify-center w-10 h-10 rounded-xl bg-theme-surface-2 border border-theme-border text-theme-primary backdrop-blur-md"
      >
        <MessageSquare className="w-5 h-5" />
      </button>

      {/* Sidebar */}
      <div className={clsx(
        "absolute md:relative z-10 h-full w-[280px] md:w-[320px] bg-theme-surface border-r border-theme-border flex flex-col transition-transform duration-300 ease-in-out",
        showSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-4 border-b border-theme-border">
          <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-theme-primary bg-theme-surface hover:bg-theme-surface-2 border border-theme-border transition-colors">
            <Plus className="w-4 h-4" />
            New Conversation
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-2 scrollbar-hide">
          <div className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2 ml-2">Recent Chats</div>
          
          {MOCK_HISTORY.map((chat, idx) => (
            <button 
              key={chat.id} 
              className={clsx(
                "w-full flex items-start gap-3 p-3 rounded-xl transition-colors text-left group relative",
                idx === 0 ? "bg-theme-surface-2 border border-theme-border" : "hover:bg-theme-surface border border-transparent"
              )}
            >
              <MessageSquare className={clsx("w-4 h-4 shrink-0 mt-0.5", idx === 0 ? "text-indigo-400" : "text-theme-muted")} />
              <div className="flex-grow overflow-hidden">
                <p className={clsx("text-sm font-medium truncate", idx === 0 ? "text-theme-primary" : "text-theme-secondary")}>{chat.title}</p>
                <p className="text-xs text-theme-muted mt-1">{chat.date}</p>
              </div>
              <Trash2 className="w-4 h-4 text-theme-muted opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all" />
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-theme-border">
          <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
                <Clock className="w-3.5 h-3.5" />
                <span>2/5 Queries</span>
              </div>
              <span className="text-[10px] text-theme-muted">Resets in 3h 12m</span>
            </div>
            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-indigo-500 rounded-full w-[40%]" />
            </div>
            <Link to="/pricing" className="block text-center w-full py-1.5 rounded-lg bg-theme-surface hover:bg-theme-surface-2 text-xs font-medium text-theme-primary transition-colors">
              Upgrade to Premium
            </Link>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-grow flex flex-col bg-transparent h-full relative">
        {/* Mobile overlay for sidebar */}
        {showSidebar && (
          <div 
            className="absolute inset-0 bg-black/50 z-0 md:hidden backdrop-blur-sm"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Expiry Notice Banner */}
        {showBanner && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-center gap-2 relative shrink-0">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-200 text-center">
              Free plan conversations expire after 7 days. Upgrade to save them longer.
            </p>
            <button 
              onClick={() => setShowBanner(false)}
              className="absolute right-4 text-amber-400/70 hover:text-amber-400 p-1 rounded-full hover:bg-amber-500/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Messages List */}
        <div className="flex-grow overflow-y-auto p-4 md:p-8 flex flex-col gap-6 w-full max-w-3xl mx-auto scrollbar-hide pb-4">
          <div className="text-center mt-10 mb-8">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold text-theme-primary mb-2">How can I help you study?</h2>
            <p className="text-sm text-theme-muted">Ask questions, request summaries, or get help with past papers.</p>
          </div>

          {MOCK_MESSAGES.map((msg) => (
            <div 
              key={msg.id} 
              className={clsx(
                "flex w-full gap-4",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shrink-0 mt-1 shadow-[0_0_10px_rgba(99,102,241,0.3)]">
                  <Sparkles className="w-4 h-4 text-theme-primary" />
                </div>
              )}
              
              <div className={clsx(
                "max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed",
                msg.role === 'user' 
                  ? "bg-indigo-600 text-white rounded-tr-sm" 
                  : "glass-card border-theme-border text-theme-secondary rounded-tl-sm shadow-xl"
              )}>
                {msg.content.split('\n').map((line, i) => (
                  <span key={i}>
                    {line.includes('**') ? (
                      <span dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                    ) : (
                      line
                    )}
                    {i < msg.content.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="shrink-0 w-full p-4 bg-transparent pt-12 relative z-10">
          <div className="max-w-3xl mx-auto relative">
            <div className="absolute -top-10 left-0 w-full flex justify-center mb-2 pointer-events-none">
              <button className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-theme-surface border border-theme-border hover:bg-theme-surface-2 text-xs font-medium text-theme-secondary backdrop-blur-md transition-colors">
                <Paperclip className="w-3.5 h-3.5" />
                Upload PDF (Plus/Pro)
              </button>
            </div>
            
            <form 
              className="relative flex items-end glass-card p-2 border-theme-border shadow-2xl bg-theme-surface/80 backdrop-blur-2xl"
              onSubmit={(e) => { e.preventDefault(); setMessage(''); }}
            >
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Message PastQ AI..." 
                className="w-full max-h-32 min-h-[44px] bg-transparent border-none resize-none px-4 py-3 text-theme-primary placeholder-gray-500 focus:outline-none focus:ring-0 text-sm scrollbar-hide"
                rows={1}
              />
              <div className="p-1 shrink-0">
                <button 
                  type="submit"
                  disabled={!message.trim()}
                  className="w-10 h-10 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:bg-theme-surface disabled:text-theme-muted flex items-center justify-center text-white transition-all shadow-lg"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </form>
            <p className="text-[10px] text-center text-theme-muted mt-2">
              AI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AskAIPage;
