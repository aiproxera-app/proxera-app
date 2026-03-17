import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, User, Loader2, FileText, ArrowLeft, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ImportModal from "./ImportModal";
import * as aiService from "../services/ai";
import Layout from "./Layout";
import { apiFetch } from "../services/auth";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Chat({ hasProfile, onBack }: { hasProfile: boolean; onBack?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [retryStatus, setRetryStatus] = useState({ isRetrying: false, retryCount: 0 });

  useEffect(() => {
    return aiService.subscribeToRetryStatus(setRetryStatus);
  }, []);

  useEffect(() => {
    apiFetch("/api/messages")
      .then(res => res.json())
      .then(data => {
        if (data.length === 0) {
          const initialMessage: Message = {
            role: "assistant",
            content: "Welcome to Discovery. I'm here to help refine your network identity. What are you currently building, learning, or exploring?"
          };
          setMessages([initialMessage]);
          saveMessage(initialMessage);
        } else {
          setMessages(data.map((m: any) => ({ role: m.role, content: m.content })));
        }
      });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    if (messages.length > 5 && messages.length % 5 === 0) {
      handleExtractSignals();
    }
  }, [messages]);

  const saveMessage = async (msg: Message) => {
    await apiFetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg)
    });
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    await saveMessage(userMsg);

    try {
      const responseText = await aiService.generateChatResponse([...messages, userMsg]);
      const assistantMsg: Message = { role: "assistant", content: responseText || "I'm sorry, I couldn't process that." };
      setMessages(prev => [...prev, assistantMsg]);
      await saveMessage(assistantMsg);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTyping(false);
    }
  };

  const handleExtractSignals = async () => {
    try {
      const signals = await aiService.extractSignals(messages);
      await apiFetch("/api/chat/sync-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signals })
      });
    } catch (e) {
      console.error("Signal extraction failed", e);
    }
  };

  return (
    <Layout className="flex flex-col h-[calc(100vh-48px)] !p-0">
      <header className="p-6 border-b border-[var(--border)] bg-[var(--bg)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 hover:bg-[var(--surface)] rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--surface)] border border-[var(--border)] rounded-xl flex items-center justify-center text-[var(--text-primary)]">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="font-semibold tracking-tight">Assistant</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Refining Identity</p>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:opacity-80 transition-all"
        >
          <FileText size={14} />
          Import
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="max-w-[720px] mx-auto space-y-8">
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[85%] flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    msg.role === "user" ? "bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg)]" : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)]"
                  }`}>
                    {msg.role === "user" ? <User size={16} /> : <Sparkles size={16} />}
                  </div>
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user" 
                      ? "bg-[var(--text-primary)] text-[var(--bg)] rounded-tr-none" 
                      : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-tl-none"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-[var(--surface)] border border-[var(--border)] p-4 rounded-2xl rounded-tl-none flex items-center gap-3">
                <Loader2 size={16} className="animate-spin text-[var(--text-secondary)]" />
                <span className="text-xs text-[var(--text-secondary)] font-medium">
                  {retryStatus.isRetrying 
                    ? `Rate limit hit. Retrying (${retryStatus.retryCount}/5)...` 
                    : "Thinking..."}
                </span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </div>

      <div className="p-6 bg-[var(--bg)] border-t border-[var(--border)] shrink-0">
        <div className="max-w-[720px] mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your message..."
            className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)]/5 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="bg-[var(--text-primary)] text-[var(--bg)] p-4 rounded-2xl hover:opacity-90 transition-all disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>
      </div>

      {showImport && (
        <ImportModal 
          onClose={() => setShowImport(false)} 
          onSuccess={() => {}} 
        />
      )}
    </Layout>
  );
}
