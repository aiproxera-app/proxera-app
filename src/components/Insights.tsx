import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { User, Target, Zap, MessageCircle, Brain, Info, Sparkles, Edit3, Save, X, Plus, Trash2, RefreshCw, Database, FileText, ChevronRight, Loader2, Hash, Activity } from "lucide-react";
import ImportModal from "./ImportModal";
import Layout, { Section } from "./Layout";
import { apiFetch } from "../services/auth";

export default function Insights() {
  const [signals, setSignals] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showImport, setShowImport] = useState(false);
  
  // Edit states
  const [editedSummary, setEditedSummary] = useState("");
  const [editedCommStyle, setEditedCommStyle] = useState("");
  const [editedInteractionType, setEditedInteractionType] = useState("");
  const [editedDecisionOrientation, setEditedDecisionOrientation] = useState("");
  const [editedReasoningStyle, setEditedReasoningStyle] = useState<string[]>([]);
  const [editedKnowledgeDomains, setEditedKnowledgeDomains] = useState<string[]>([]);
  const [editedActiveExplorations, setEditedActiveExplorations] = useState<string[]>([]);
  const [editedPrimaryIntent, setEditedPrimaryIntent] = useState("");
  const [newTag, setNewTag] = useState({ section: "", value: "" });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [signalsRes, convsRes] = await Promise.all([
        apiFetch("/api/signals"),
        apiFetch("/api/conversations")
      ]);
      const signalsData = await signalsRes.json();
      const convsData = await convsRes.json();
      
      setSignals(signalsData);
      setConversations(convsData);
      
      if (signalsData) {
        setEditedSummary(signalsData.summary || "");
        setEditedCommStyle(signalsData.communication_style || "");
        setEditedInteractionType(signalsData.interaction_type || "");
        setEditedDecisionOrientation(signalsData.decision_orientation || "");
        setEditedReasoningStyle(JSON.parse(signalsData.reasoning_style || "[]"));
        setEditedKnowledgeDomains(JSON.parse(signalsData.knowledge_domains || "[]"));
        setEditedActiveExplorations(JSON.parse(signalsData.active_explorations || "[]"));
        setEditedPrimaryIntent(signalsData.primary_intent || "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveProfile = async () => {
    try {
      await apiFetch("/api/signals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: editedSummary,
          communication_style: editedCommStyle,
          interaction_type: editedInteractionType,
          decision_orientation: editedDecisionOrientation,
          reasoning_style: editedReasoningStyle,
          knowledge_domains: editedKnowledgeDomains,
          active_explorations: editedActiveExplorations,
          primary_intent: editedPrimaryIntent
        })
      });
      setIsEditing(false);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveTag = (section: string, index: number) => {
    if (section === "reasoning") setEditedReasoningStyle(prev => prev.filter((_, i) => i !== index));
    if (section === "domains") setEditedKnowledgeDomains(prev => prev.filter((_, i) => i !== index));
    if (section === "explorations") setEditedActiveExplorations(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddTag = (section: string) => {
    const val = newTag.value.trim();
    if (!val) return;

    if (section === "reasoning" && !editedReasoningStyle.includes(val)) {
      setEditedReasoningStyle(prev => [...prev, val]);
    } else if (section === "domains" && !editedKnowledgeDomains.includes(val)) {
      setEditedKnowledgeDomains(prev => [...prev, val]);
    } else if (section === "explorations" && !editedActiveExplorations.includes(val)) {
      setEditedActiveExplorations(prev => [...prev, val]);
    }
    setNewTag({ section: "", value: "" });
  };

  const handleDeleteConversation = async (id: number) => {
    try {
      await apiFetch(`/api/conversations/${id}`, { method: "DELETE" });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="p-10 text-[var(--text-secondary)]">Loading your identity...</div>;

  if (!signals) {
    return (
      <Layout className="flex flex-col items-center justify-center min-h-[80vh]">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="w-20 h-20 bg-[var(--surface)] rounded-3xl shadow-sm border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--text-secondary)]">
            <Sparkles size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-semibold mb-3">Identity not yet built</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Your network identity is generated from your conversations and context. Build your profile to unlock your behavioral insights.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const reasoningStyle = typeof signals.reasoning_style === 'string' ? JSON.parse(signals.reasoning_style || "[]") : (signals.reasoning_style || []);
  const knowledgeDomains = typeof signals.knowledge_domains === 'string' ? JSON.parse(signals.knowledge_domains || "[]") : (signals.knowledge_domains || []);
  const activeExplorations = typeof signals.active_explorations === 'string' ? JSON.parse(signals.active_explorations || "[]") : (signals.active_explorations || []);

  const getItemName = (item: any) => typeof item === 'string' ? item : item.name;

  const commStyleOptions = ["analytical structured", "concise pragmatic", "narrative exploratory", "reflective"];
  const interactionTypeOptions = ["builder", "strategist", "researcher", "operator"];
  const decisionOrientationOptions = ["execution-focused", "exploratory", "synthesis-driven"];

  return (
    <Layout>
      <header className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight mb-2">My Profile</h1>
          <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
            <span>Your behavioral profile used for intelligent discovery.</span>
            {signals.updated_at && (
              <span className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-[var(--border)]" />
                Last updated {new Date(signals.updated_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex gap-6 mr-4 border-r border-[var(--border)] pr-8 hidden lg:flex">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">Completeness</p>
              <p className="text-xl font-semibold">{signals.completeness || 0}%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">Confidence</p>
              <p className="text-xl font-semibold text-emerald-500">{signals.confidence || 0}%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">Freshness</p>
              <p className="text-xl font-semibold text-blue-500">{signals.freshness || 0}%</p>
            </div>
          </div>
          <div className="flex gap-3">
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-6 py-3 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl text-sm font-semibold hover:bg-[var(--bg)] transition-all flex items-center gap-2 shadow-sm"
              >
                <Edit3 size={16} /> Edit Profile
              </button>
            ) : (
              <button 
                onClick={handleSaveProfile}
                className="px-6 py-3 bg-[var(--text-primary)] text-[var(--bg)] rounded-xl text-sm font-semibold hover:opacity-90 transition-all flex items-center gap-2 shadow-md"
              >
                <Save size={16} /> Save Changes
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-12">
        {/* Profile Health Guidance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 bg-[var(--surface)] border border-[var(--border)] rounded-3xl">
            <div className="flex items-center gap-2 text-emerald-500 mb-3">
              <Zap size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Signal Strength</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Based on {conversations.length} conversations. We recommend at least 5 for high confidence signals.
            </p>
          </div>
          <div className="p-6 bg-[var(--surface)] border border-[var(--border)] rounded-3xl">
            <div className="flex items-center gap-2 text-blue-500 mb-3">
              <Activity size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Active Decay</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Explorations decay over time. Add new context to keep your trajectory accurate and relevant.
            </p>
          </div>
          <div className="p-6 bg-[var(--surface)] border border-[var(--border)] rounded-3xl">
            <div className="flex items-center gap-2 text-amber-500 mb-3">
              <Info size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Refinement</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              AI signals can be noisy. Use Edit mode to remove irrelevant topics or rename domains for clarity.
            </p>
          </div>
        </div>

        {/* Identity Block */}
        <Section title="Identity Block">
          <div className="premium-card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                <User size={18} />
                <span className="text-[10px] font-bold uppercase tracking-widest">AI-Generated Summary</span>
              </div>
              {isEditing && <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Editing Mode</span>}
            </div>
            {isEditing ? (
              <textarea
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                className="w-full h-32 text-lg text-[var(--text-primary)] leading-relaxed font-medium bg-[var(--bg)] border border-[var(--border)] rounded-2xl p-4 focus:outline-none transition-all resize-none"
                placeholder="Describe your intellectual identity..."
              />
            ) : (
              <p className="text-xl text-[var(--text-primary)] leading-relaxed font-medium">
                "{signals.summary}"
              </p>
            )}
          </div>
        </Section>

        {/* Behavioral Traits */}
        <Section title="Behavioral Traits">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="premium-card">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">Communication Style</p>
              {isEditing ? (
                <select 
                  value={editedCommStyle}
                  onChange={(e) => setEditedCommStyle(e.target.value)}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm focus:outline-none"
                >
                  {commStyleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <p className="font-semibold capitalize">{signals.communication_style}</p>
              )}
            </div>
            <div className="premium-card">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">Interaction Type</p>
              {isEditing ? (
                <select 
                  value={editedInteractionType}
                  onChange={(e) => setEditedInteractionType(e.target.value)}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm focus:outline-none"
                >
                  {interactionTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <p className="font-semibold capitalize">{signals.interaction_type}</p>
              )}
            </div>
            <div className="premium-card">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">Decision Orientation</p>
              {isEditing ? (
                <select 
                  value={editedDecisionOrientation}
                  onChange={(e) => setEditedDecisionOrientation(e.target.value)}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm focus:outline-none"
                >
                  {decisionOrientationOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <p className="font-semibold capitalize">{signals.decision_orientation}</p>
              )}
            </div>
          </div>
        </Section>

        {/* Knowledge Domains */}
        <Section title="Knowledge Domains">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(isEditing ? editedKnowledgeDomains : knowledgeDomains).map((domain: any, i: number) => (
              <div key={i} className="premium-card flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[var(--bg)] border border-[var(--border)] rounded-xl flex items-center justify-center text-[var(--text-secondary)]">
                    <Database size={18} />
                  </div>
                  {isEditing ? (
                    <input 
                      type="text"
                      value={getItemName(domain)}
                      onChange={(e) => {
                        const newDomains = [...editedKnowledgeDomains];
                        newDomains[i] = e.target.value;
                        setEditedKnowledgeDomains(newDomains);
                      }}
                      className="bg-transparent border-none focus:outline-none text-sm font-semibold"
                    />
                  ) : (
                    <p className="font-semibold text-sm">{getItemName(domain)}</p>
                  )}
                </div>
                {isEditing && (
                  <button onClick={() => handleRemoveTag("domains", i)} className="text-[var(--text-secondary)] hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            {isEditing && (
              <div className="premium-card border-dashed flex items-center gap-2">
                <input 
                  type="text"
                  value={newTag.section === "domains" ? newTag.value : ""}
                  onChange={(e) => setNewTag({ section: "domains", value: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag("domains")}
                  placeholder="Add domain..."
                  className="flex-1 bg-transparent border-none focus:outline-none text-sm"
                />
                <button onClick={() => handleAddTag("domains")} className="p-2 bg-[var(--text-primary)] text-[var(--bg)] rounded-xl">
                  <Plus size={14} />
                </button>
              </div>
            )}
          </div>
        </Section>

        {/* Active Explorations */}
        <Section title="Active Explorations">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(isEditing ? editedActiveExplorations : activeExplorations).map((topic: any, i: number) => (
              <div key={i} className="premium-card flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[var(--bg)] border border-[var(--border)] rounded-xl flex items-center justify-center text-[var(--text-secondary)]">
                    <Zap size={18} />
                  </div>
                  {isEditing ? (
                    <input 
                      type="text"
                      value={getItemName(topic)}
                      onChange={(e) => {
                        const newExplorations = [...editedActiveExplorations];
                        newExplorations[i] = e.target.value;
                        setEditedActiveExplorations(newExplorations);
                      }}
                      className="bg-transparent border-none focus:outline-none text-sm font-semibold italic"
                    />
                  ) : (
                    <p className="font-semibold text-sm italic">{getItemName(topic)}</p>
                  )}
                </div>
                {isEditing && (
                  <button onClick={() => handleRemoveTag("explorations", i)} className="text-[var(--text-secondary)] hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            {isEditing && (
              <div className="premium-card border-dashed flex items-center gap-2">
                <input 
                  type="text"
                  value={newTag.section === "explorations" ? newTag.value : ""}
                  onChange={(e) => setNewTag({ section: "explorations", value: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag("explorations")}
                  placeholder="Add exploration..."
                  className="flex-1 bg-transparent border-none focus:outline-none text-sm"
                />
                <button onClick={() => handleAddTag("explorations")} className="p-2 bg-[var(--text-primary)] text-[var(--bg)] rounded-xl">
                  <Plus size={14} />
                </button>
              </div>
            )}
          </div>
        </Section>

        {/* Conversation Corpus */}
        <Section title="Conversation Corpus">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <p className="text-sm text-[var(--text-secondary)] max-w-xl">
                The raw data powering your identity. You can remove conversations to refine your profile or add new ones to evolve your trajectory.
              </p>
              <button 
                onClick={() => setShowImport(true)}
                className="px-6 py-3 bg-[var(--text-primary)] text-[var(--bg)] rounded-xl text-sm font-semibold hover:opacity-90 transition-all flex items-center gap-2 shrink-0"
              >
                <Plus size={16} /> Add Context
              </button>
            </div>
            
            <div className="space-y-4">
              {conversations.length === 0 ? (
                <div className="p-12 bg-[var(--bg)] border border-[var(--border)] border-dashed rounded-3xl text-center">
                  <Database size={32} className="mx-auto text-[var(--text-secondary)] mb-4 opacity-20" />
                  <h3 className="font-medium text-[var(--text-secondary)]">Your corpus is empty</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-2">Import conversations to start building your identity.</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <div key={conv.id} className="premium-card flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[var(--bg)] border border-[var(--border)] rounded-xl flex items-center justify-center text-[var(--text-secondary)]">
                        <FileText size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-base">{conv.title || 'Imported Conversation'}</h4>
                          {conv.detected_domain && (
                            <span className="px-2 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                              {conv.detected_domain}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mt-1">
                          {conv.message_count} messages • {conv.word_count} words • Imported {new Date(conv.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        disabled
                        title="Coming soon"
                        className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] opacity-50 cursor-not-allowed"
                      >
                        <RefreshCw size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteConversation(conv.id)}
                        className="p-2 text-[var(--text-secondary)] hover:text-red-500"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Section>
      </div>

      {showImport && (
        <ImportModal 
          onClose={() => setShowImport(false)} 
          onSuccess={fetchData} 
        />
      )}
    </Layout>
  );
}
