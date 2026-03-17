import { useState, useEffect, useRef, ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, FileText, Loader2, CheckCircle2, AlertCircle, ChevronRight, ArrowLeft, ArrowRight, Sparkles, Target, Zap, Link, Upload, Database, Brain } from "lucide-react";
import * as aiService from "../services/ai";
import { apiFetch } from "../services/auth";

interface ImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Status = "idle" | "analyzing" | "review" | "saving" | "success" | "error";
type ImportMethod = "paste" | "link" | "file";

export default function ImportModal({ onClose, onSuccess }: ImportModalProps) {
  const [rawText, setRawText] = useState("");
  const [chatLink, setChatLink] = useState("");
  const [method, setMethod] = useState<ImportMethod>("paste");
  const [status, setStatus] = useState<Status>("idle");
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");
  const [profilePreview, setProfilePreview] = useState<any>(null);
  const [corpusStats, setCorpusStats] = useState<any>(null);
  const [whatChanged, setWhatChanged] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [retryStatus, setRetryStatus] = useState({ isRetrying: false, retryCount: 0 });

  useEffect(() => {
    return aiService.subscribeToRetryStatus(setRetryStatus);
  }, []);

  const loadingSteps = [
    "Preprocessing conversation...",
    "Detecting conversation structure...",
    "Extracting behavioral signals...",
    "Aggregating with existing corpus...",
    "Preparing profile preview..."
  ];

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setRawText(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleStartAnalysis = async () => {
    let contentToAnalyze = rawText;
    let source = method;
    let messageCount = 0;
    let wordCount = 0;

    setStatus("analyzing");
    setError("");

    if (method === "link") {
      if (!chatLink.includes("chatgpt.com/share")) {
        setError("Please provide a valid ChatGPT share link.");
        setStatus("error");
        return;
      }
      
      setLoadingMessage("Fetching shared conversation...");
      
      try {
        const importRes = await apiFetch("/api/import-share-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: chatLink })
        });
        
        if (!importRes.ok) {
          const errData = await importRes.json();
          throw new Error(errData.error || "Failed to import share link");
        }
        
        const importedData = await importRes.json();
        contentToAnalyze = importedData.raw_text;
        source = importedData.source;
        messageCount = importedData.message_count;
        wordCount = importedData.word_count;
      } catch (e: any) {
        console.error(e);
        setStatus("error");
        setError(e.message || "We couldn’t extract conversation content from this share link. Please try another shared conversation or use file import.");
        return;
      }
    } else {
      if (!contentToAnalyze.trim()) {
        setStatus("idle");
        return;
      }
      wordCount = contentToAnalyze.split(/\s+/).length;
      messageCount = contentToAnalyze.split(/\n\n/).length; // Rough estimate
    }
    
    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < loadingSteps.length - 1) {
        stepIndex++;
        setLoadingMessage(loadingSteps[stepIndex]);
      }
    }, 2000);

    setLoadingMessage(loadingSteps[0]);

    try {
      // 0. Get current signals for comparison
      const oldSignalsRes = await apiFetch("/api/signals");
      const oldSignals = await oldSignalsRes.json();

      // 1. Extract metadata on frontend
      setLoadingMessage("Extracting conversation metadata...");
      const processed = aiService.preprocessConversation(contentToAnalyze);
      const textForMeta = processed.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
      const metadata = await aiService.extractConversationMetadata(textForMeta.substring(0, 10000));

      // 2. Save to corpus with metadata
      setLoadingMessage("Saving to corpus...");
      const saveRes = await apiFetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_text: contentToAnalyze,
          source: source,
          message_count: messageCount,
          word_count: wordCount,
          ...metadata
        })
      });

      if (!saveRes.ok) {
        const errData = await saveRes.json();
        throw new Error(errData.details || errData.error || "Failed to save conversation");
      }

      setLoadingMessage("Rebuilding behavioral profile...");

      // 3. Fetch all conversations for full analysis
      const convsRes = await apiFetch("/api/conversations");
      const conversations = await convsRes.json();

      // 4. Run full corpus analysis on frontend
      const result = await aiService.analyzeCorpus(conversations);
      if (!result) throw new Error("Analysis failed to produce a profile");

      // 5. Update profile on backend
      setLoadingMessage("Updating profile...");
      const updateRes = await apiFetch("/api/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: result,
          metaSignals: result.metaSignals
        })
      });

      if (!updateRes.ok) {
        const err = await updateRes.json();
        throw new Error(err.details || err.error || "Profile update failed");
      }

      const signals = await updateRes.json();
      
      // Parse JSON strings from backend
      const parsedSignals = {
        ...signals,
        reasoning_style: JSON.parse(signals.reasoning_style || "[]"),
        knowledge_domains: JSON.parse(signals.knowledge_domains || "[]"),
        active_explorations: JSON.parse(signals.active_explorations || "[]")
      };

      setProfilePreview(parsedSignals);

      // Calculate "What Changed"
      if (oldSignals) {
        const oldDomains = JSON.parse(oldSignals.knowledge_domains || "[]").map((d: any) => typeof d === 'string' ? d : d.name);
        const newDomains = parsedSignals.knowledge_domains.map((d: any) => typeof d === 'string' ? d : d.name);
        const addedDomains = newDomains.filter((d: string) => !oldDomains.includes(d));

        const oldExplorations = JSON.parse(oldSignals.active_explorations || "[]").map((e: any) => typeof e === 'string' ? e : e.name);
        const newExplorations = parsedSignals.active_explorations.map((e: any) => typeof e === 'string' ? e : e.name);
        const addedExplorations = newExplorations.filter((e: string) => !oldExplorations.includes(e));

        setWhatChanged({
          addedDomains,
          addedExplorations,
          confidenceChange: parsedSignals.confidence - oldSignals.confidence,
          updatedAt: new Date().toISOString()
        });
      }

      // 6. Fetch updated stats
      const statsRes = await apiFetch("/api/corpus-stats");
      const stats = await statsRes.json();
      setCorpusStats(stats);

      setStatus("review");
    } catch (e: any) {
      console.error(e);
      setStatus("error");
      setError(e.message || "Something went wrong during analysis.");
    } finally {
      clearInterval(interval);
    }
  };

  const handleConfirmProfile = async () => {
    setStatus("success");
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[var(--bg)] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-[var(--border)]"
      >
        <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--surface)] border border-[var(--border)] rounded-xl flex items-center justify-center text-[var(--text-primary)]">
              <Database size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Import Context</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Build Identity</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--text-secondary)]">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {status === "idle" || status === "error" ? (
              <motion.div 
                key="input"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex p-1 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
                  {(["paste", "link", "file"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                        method === m ? "bg-[var(--bg)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div className="min-h-[200px]">
                  {method === "paste" && (
                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder="Paste your conversation history here..."
                      className="w-full h-64 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-sm focus:outline-none transition-all resize-none"
                    />
                  )}
                  {method === "link" && (
                    <div className="space-y-6">
                      <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex gap-4">
                        <Link className="text-blue-500 shrink-0" size={20} />
                        <p className="text-sm text-blue-500 leading-relaxed">
                          Paste a ChatGPT share link. We'll extract behavioral signals from the public conversation history.
                        </p>
                      </div>
                      <input
                        type="text"
                        value={chatLink}
                        onChange={(e) => setChatLink(e.target.value)}
                        placeholder="https://chatgpt.com/share/..."
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-4 text-sm focus:outline-none transition-all"
                      />
                    </div>
                  )}
                  {method === "file" && (
                    <div className="space-y-4">
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-64 border-2 border-dashed border-[var(--border)] rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-[var(--text-primary)] hover:bg-[var(--surface)] transition-all cursor-pointer group"
                      >
                        <div className="w-14 h-14 bg-[var(--surface)] border border-[var(--border)] rounded-full flex items-center justify-center text-[var(--text-secondary)] group-hover:scale-110 transition-transform">
                          <Upload size={24} />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">Click to upload .txt or .json</p>
                          <p className="text-xs text-[var(--text-secondary)] mt-1">Exported conversation history</p>
                        </div>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileUpload} 
                          className="hidden" 
                          accept=".txt,.json"
                        />
                      </div>
                      {rawText && (
                        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--surface)] p-3 rounded-xl border border-[var(--border)]">
                          <FileText size={14} />
                          <span>File loaded: {rawText.length} characters</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {status === "error" && (
                  <div className="flex items-center gap-3 text-red-500 text-sm bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                  </div>
                )}
              </motion.div>
            ) : status === "analyzing" ? (
              <motion.div 
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-80 flex flex-col items-center justify-center space-y-8"
              >
                <div className="relative">
                  <Loader2 size={64} className="animate-spin text-[var(--text-primary)]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles size={20} className="text-[var(--text-secondary)] opacity-50" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-xl">
                    {retryStatus.isRetrying 
                      ? `Rate limit hit. Retrying... (${retryStatus.retryCount}/5)` 
                      : loadingMessage}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-3 text-balance max-w-xs mx-auto">
                    {retryStatus.isRetrying 
                      ? "The AI is busy. We're waiting a moment before trying again to ensure your profile is accurate."
                      : "We're distilling your intellectual profile from your digital context."}
                  </p>
                </div>
              </motion.div>
            ) : status === "review" ? (
              <motion.div 
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-500">
                    <CheckCircle2 size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Analysis Complete</span>
                  </div>
                  {corpusStats && (
                    <div className="flex gap-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                      <span>{corpusStats.conversation_count} Convs</span>
                      <span>{corpusStats.total_messages} Messages</span>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)]">
                    <div className="flex items-center gap-2 mb-4 text-[var(--text-secondary)]">
                      <Brain size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Identity Summary</span>
                    </div>
                    <p className="text-[var(--text-primary)] leading-relaxed font-medium italic">
                      "{profilePreview.summary}"
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-[var(--bg)] border border-[var(--border)] rounded-2xl">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-2">Communication</span>
                      <p className="text-sm font-semibold capitalize">{profilePreview.communication_style}</p>
                    </div>
                    <div className="p-5 bg-[var(--bg)] border border-[var(--border)] rounded-2xl">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-2">Interaction</span>
                      <p className="text-sm font-semibold capitalize">{profilePreview.interaction_type}</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3">Active Explorations</h4>
                      <div className="flex flex-wrap gap-2">
                        {profilePreview.active_explorations?.map((topic: any, i: number) => (
                          <span key={i} className="px-3 py-1 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-full text-xs italic">
                            {typeof topic === 'string' ? topic : topic.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="success"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="space-y-8"
              >
                <div className="flex flex-col items-center justify-center space-y-4 pt-8">
                  <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                    <CheckCircle2 size={40} />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-2xl">Identity Activated</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-2">Your behavioral profile has been updated and committed.</p>
                  </div>
                </div>

                {whatChanged && (
                  <div className="premium-card bg-[var(--surface)] border-[var(--border)]">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-6">What Changed</h4>
                    <div className="space-y-6">
                      {whatChanged.addedDomains.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-2 flex items-center gap-2">
                            <Database size={14} className="text-blue-500" /> New Knowledge Domains
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {whatChanged.addedDomains.map((d: string, i: number) => (
                              <span key={i} className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded-md text-[10px] font-medium">{d}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {whatChanged.addedExplorations.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-2 flex items-center gap-2">
                            <Zap size={14} className="text-amber-500" /> New Active Explorations
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {whatChanged.addedExplorations.map((e: string, i: number) => (
                              <span key={i} className="px-2 py-1 bg-amber-500/10 text-amber-500 rounded-md text-[10px] font-medium">{e}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="pt-4 border-t border-[var(--border)] flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Sparkles size={14} className="text-emerald-500" />
                          <span className="text-xs text-[var(--text-secondary)]">Confidence Increase</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-500">+{whatChanged.confidenceChange}%</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={onClose}
                  className="w-full py-4 bg-[var(--text-primary)] text-[var(--bg)] rounded-2xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  Done <ArrowRight size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 bg-[var(--surface)] border-t border-[var(--border)] flex justify-end gap-3">
          {status === "review" ? (
            <>
              <button
                onClick={() => {
                  setStatus("idle");
                  setRawText("");
                  setChatLink("");
                  setProfilePreview(null);
                }}
                className="px-6 py-3 text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-2"
              >
                <ArrowLeft size={16} />
                Back to Input
              </button>
              <button
                onClick={handleConfirmProfile}
                className="px-8 py-3 bg-[var(--text-primary)] text-[var(--bg)] rounded-xl text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2 shadow-xl"
              >
                Confirm Commit
                <ChevronRight size={16} />
              </button>
            </>
          ) : status === "success" ? null : (
            <>
              <button
                onClick={onClose}
                className="px-6 py-3 text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartAnalysis}
                disabled={(!rawText.trim() && !chatLink.trim()) || status === "analyzing" || status === "success" || status === "saving"}
                className="px-8 py-3 bg-[var(--text-primary)] text-[var(--bg)] rounded-xl text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {status === "analyzing" ? "Distilling..." : "Start Analysis"}
                {status === "idle" && <ChevronRight size={16} />}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
