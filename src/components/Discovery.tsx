import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Compass, Users, MessageSquare, ArrowRight, Sparkles, LayoutGrid, UserPlus, Search, Target, Brain, Zap, X, CheckCircle2, Database, Hash, ChevronRight, Loader2, Activity } from "lucide-react";
import Layout, { Section } from "./Layout";
import { apiFetch } from "../services/auth";

interface Person {
  id: number;
  name: string;
  headline: string;
  summary: string;
  active_explorations: string[];
  knowledge_domains: string[];
  behavioral_identity: {
    communication_style: string;
    interaction_type: string;
  };
  score: number;
  explanation: string;
}

interface Topic {
  name: string;
  count: number;
  last_activity: string;
}

interface CorpusStats {
  conversation_count: number;
  total_messages: number;
  total_words: number;
}

function PersonCard({ person }: { person: Person, key?: any }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="premium-card min-w-[280px] md:min-w-[320px] snap-start flex flex-col h-full"
    >
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 bg-[var(--bg)] border border-[var(--border)] rounded-2xl flex items-center justify-center text-[var(--text-secondary)] font-semibold text-xl shrink-0">
          {person.name[0]}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--text-primary)] truncate">{person.name}</h3>
          <p className="text-xs text-[var(--text-secondary)] truncate">{person.headline}</p>
        </div>
      </div>
      
      <div className="flex-1">
        <div className="mb-4 p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)] italic text-[11px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">
          "{person.explanation}"
        </div>

        <div className="flex flex-wrap gap-1.5 mb-6">
          <span className="px-2 py-0.5 bg-[var(--text-primary)] text-[var(--bg)] rounded-md text-[9px] font-bold uppercase tracking-wider">
            {person.behavioral_identity.interaction_type}
          </span>
          {person.active_explorations.slice(0, 2).map((topic: any, i: number) => (
            <span key={i} className="px-2 py-0.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)] rounded-md text-[9px] font-medium italic">
              {typeof topic === 'string' ? topic : topic.name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
          {person.score}% Match
        </span>
        <div className="flex items-center gap-2">
          <button 
            disabled
            title="Coming soon"
            className="text-xs font-semibold flex items-center gap-1 opacity-50 cursor-not-allowed"
          >
            View <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Discovery({ 
  hasProfile, 
  showSuccess, 
  onCloseSuccess, 
  onRefine, 
  onStartSetup 
}: { 
  hasProfile: boolean; 
  showSuccess?: boolean;
  onCloseSuccess?: () => void;
  onRefine: () => void; 
  onStartSetup: () => void 
}) {
  const [sections, setSections] = useState<{ thinking_style: Person[], explorations: Person[] }>({ thinking_style: [], explorations: [] });
  const [allMatches, setAllMatches] = useState<Person[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [userTopics, setUserTopics] = useState<string[]>([]);
  const [corpusStats, setCorpusStats] = useState<CorpusStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [trajectory, setTrajectory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [signals, setSignals] = useState<any>(null);

  useEffect(() => {
    if (searchQuery.length > 2) {
      setIsSearching(true);
      const delayDebounceFn = setTimeout(() => {
        apiFetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
          .then(res => res.json())
          .then(data => {
            setSearchResults(data.map((u: any) => ({
              ...u,
              active_explorations: JSON.parse(u.active_explorations || "[]"),
              knowledge_domains: JSON.parse(u.knowledge_domains || "[]"),
              behavioral_identity: {
                communication_style: u.communication_style,
                interaction_type: u.interaction_type
              },
              score: 0,
              explanation: "Found via search"
            })));
            setIsSearching(false);
          })
          .catch(() => setIsSearching(false));
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (hasProfile) {
      setLoading(true);
      
      const matchesUrl = selectedTopic ? `/api/matches?topic=${encodeURIComponent(selectedTopic)}` : "/api/matches";
      apiFetch(matchesUrl)
        .then(res => res.json())
        .then(data => {
          if (selectedTopic) {
            setAllMatches(data);
            setSections({ thinking_style: [], explorations: [] });
          } else {
            setSections({
              thinking_style: data.thinking_style || [],
              explorations: data.explorations || []
            });
            setAllMatches(data.all || []);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));

      apiFetch("/api/discovery/topics")
        .then(res => res.json())
        .then(data => setTopics(data));

      apiFetch("/api/signals")
        .then(res => res.json())
        .then(data => {
          if (data) {
            setSignals(data);
            const explorations = JSON.parse(data.active_explorations || "[]");
            const domains = JSON.parse(data.knowledge_domains || "[]");
            const allTopics = [...explorations, ...domains].map(t => typeof t === 'string' ? t : t.name);
            setUserTopics(allTopics);
          }
        });

      apiFetch("/api/corpus-stats")
        .then(res => res.json())
        .then(data => setCorpusStats(data));

      apiFetch("/api/profile-graph")
        .then(res => res.json())
        .then(data => setTrajectory(data.trajectory || []));
    } else {
      setLoading(false);
    }
  }, [hasProfile, selectedTopic]);

  if (!hasProfile) {
    return (
      <Layout className="flex flex-col items-center justify-center min-h-[80vh]">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="w-20 h-20 bg-[var(--surface)] rounded-3xl shadow-sm border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--text-secondary)]">
            <Compass size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-semibold mb-3">Discovery is locked</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Build your network identity first to unlock exploratory discovery and behavioral clusters.
            </p>
          </div>
          <button 
            onClick={onStartSetup}
            className="w-full py-4 bg-[var(--text-primary)] text-[var(--bg)] rounded-2xl font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            Build My Profile <ArrowRight size={18} />
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mb-16 p-8 bg-[var(--text-primary)] text-[var(--bg)] rounded-3xl relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Identity Activated</h3>
                    <p className="text-[var(--bg)]/60 text-xs">Your network profile is now live.</p>
                  </div>
                </div>
                <button onClick={onCloseSuccess} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Core Topics</span>
                  <div className="flex flex-wrap gap-2">
                    {userTopics.slice(0, 4).map((t, i) => (
                      <span key={i} className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-end">
                  <button 
                    onClick={onCloseSuccess}
                    className="w-full py-3 bg-[var(--bg)] text-[var(--text-primary)] rounded-xl text-sm font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    Start Exploring <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="mb-16">
        <div className="flex flex-col lg:flex-row gap-12 mb-12">
          <div className="flex-1">
            <h1 className="text-4xl font-semibold tracking-tight mb-4">
              Good morning, {signals?.name?.split(' ')[0] || 'Explorer'}
            </h1>
            <p className="text-[var(--text-secondary)] text-lg leading-relaxed mb-8">
              {signals?.summary || "Your network identity is evolving. Explore connections based on how you think and what you're exploring."}
            </p>

            <div className="p-6 bg-[var(--surface)] border border-[var(--border)] rounded-3xl">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-4">
                <Compass size={16} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Discovery Mode</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Explore people based on behavioral similarity and overlapping interests. Discovery helps you find people relevant to your current explorations, even if they aren't direct matches.
              </p>
            </div>
          </div>
          
          {/* Profile Health Panel */}
          <div className="lg:w-80 space-y-4">
            <div className="premium-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-sm">Profile Health</h3>
                <Activity size={16} className="text-[var(--text-secondary)]" />
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
                    <span>Completeness</span>
                    <span>{signals?.completeness || 0}%</span>
                  </div>
                  <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${signals?.completeness || 0}%` }}
                      className="h-full bg-[var(--text-primary)]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
                    <span>Confidence</span>
                    <span>{signals?.confidence || 0}%</span>
                  </div>
                  <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${signals?.confidence || 0}%` }}
                      className="h-full bg-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
                    <span>Freshness</span>
                    <span>{signals?.freshness || 0}%</span>
                  </div>
                  <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${signals?.freshness || 0}%` }}
                      className="h-full bg-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--border)] grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">Conversations</p>
                    <p className="text-lg font-semibold">{corpusStats?.conversation_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">Domains</p>
                    <p className="text-lg font-semibold">{JSON.parse(signals?.knowledge_domains || "[]").length}</p>
                  </div>
                </div>

                <div className="p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                  <p className="text-[9px] text-[var(--text-secondary)] leading-relaxed">
                    <Sparkles size={10} className="inline mr-1 text-emerald-500" />
                    Confidence grows with more conversations. Freshness decays after 30 days of inactivity.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={20} />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by topic, domain, or trait..."
            className="w-full pl-12 pr-4 py-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)]/10 transition-all shadow-sm"
          />
          {isSearching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Loader2 className="animate-spin text-[var(--text-secondary)]" size={18} />
            </div>
          )}
        </div>
      </header>

      {/* Search Results */}
      <AnimatePresence>
        {searchQuery.length > 2 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-16 overflow-hidden"
          >
            <Section title={`Search results for "${searchQuery}"`}>
              <div className="horizontal-scroll">
                {searchResults.length > 0 ? (
                  searchResults.map((person: Person) => <PersonCard key={person.id} person={person} />)
                ) : !isSearching ? (
                  <div className="p-12 bg-[var(--surface)] rounded-3xl border border-dashed border-[var(--border)] w-full text-center">
                    <p className="text-[var(--text-secondary)]">No results found for your search.</p>
                  </div>
                ) : null}
              </div>
            </Section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* People for You */}
      <Section title="People for you">
        <div className="horizontal-scroll">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="min-w-[280px] h-48 bg-[var(--surface)] border border-[var(--border)] rounded-2xl animate-pulse" />)
          ) : (
            allMatches.slice(0, 6).map((person: Person) => <PersonCard key={person.id} person={person} />)
          )}
        </div>
      </Section>

      {/* Similar Thinking Style */}
      {sections.thinking_style.length > 0 && (
        <Section title="Similar thinking style">
          <div className="horizontal-scroll">
            {sections.thinking_style.map((person: Person) => <PersonCard key={person.id} person={person} />)}
          </div>
        </Section>
      )}

      {/* Based on your explorations */}
      <Section title="Recommendations based on your current explorations">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {topics.slice(0, 4).map((topic, i) => (
            <motion.button
              key={i}
              whileHover={{ x: 4 }}
              onClick={() => setSelectedTopic(topic.name)}
              className="premium-card flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[var(--bg)] border border-[var(--border)] rounded-xl flex items-center justify-center text-[var(--text-secondary)]">
                  <Hash size={18} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">{topic.name}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">{topic.count} connections</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-all" />
            </motion.button>
          ))}
        </div>
      </Section>

      {/* Your Trajectory */}
      <Section title="Identity Evolution">
        <div className="premium-card bg-gradient-to-br from-[var(--surface)] to-[var(--bg)]">
          <div className="flex flex-col md:flex-row gap-12">
            <div className="flex-1 space-y-8">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-[var(--bg)] border border-[var(--border)] rounded-2xl flex items-center justify-center text-[var(--accent)]">
                  <Target size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-xl">Trajectory Model</h3>
                  <p className="text-xs text-[var(--text-secondary)] uppercase tracking-widest font-bold mt-1">How your thinking is evolving</p>
                </div>
              </div>

              <div className="space-y-10 relative">
                {/* Evolution Layers */}
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">Active Explorations (Fast)</p>
                      <p className="text-sm text-[var(--text-primary)]">Current focus areas that change with your daily context and inquiries.</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {userTopics.slice(0, 3).map((t, i) => (
                          <span key={i} className="px-2 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-md text-[10px] font-medium italic">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">Knowledge Domains (Moderate)</p>
                      <p className="text-sm text-[var(--text-primary)]">Established areas of expertise and long-term intellectual interests.</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {JSON.parse(signals?.knowledge_domains || "[]").slice(0, 3).map((d: any, i: number) => (
                          <span key={i} className="px-2 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-md text-[10px] font-medium">{typeof d === 'string' ? d : d.name}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">Behavioral Identity (Slow)</p>
                      <p className="text-sm text-[var(--text-primary)]">Your core reasoning style and communication patterns that remain stable.</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="px-2 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-md text-[10px] font-medium uppercase tracking-wider">{signals?.interaction_type}</span>
                        <span className="px-2 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-md text-[10px] font-medium uppercase tracking-wider">{signals?.communication_style}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:w-72 space-y-6">
              <div className="p-6 bg-[var(--bg)] border border-[var(--border)] rounded-3xl h-full flex flex-col justify-center">
                <div className="text-center mb-6">
                  <div className="text-3xl font-semibold text-[var(--text-primary)]">{trajectory.length}</div>
                  <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-widest font-bold mt-1">Data Points Analyzed</div>
                </div>
                
                <div className="space-y-3">
                  <div className="h-40 flex items-end justify-between gap-1 px-2">
                    {trajectory.slice(-12).map((t, i) => (
                      <div 
                        key={i} 
                        className="w-full bg-[var(--text-primary)]/20 rounded-t-sm hover:bg-[var(--text-primary)] transition-all cursor-help"
                        style={{ height: `${20 + (i * 5)}%` }}
                        title={`${t.title} - ${new Date(t.created_at).toLocaleDateString()}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    <span>Past</span>
                    <span>Present</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Refinement CTA */}
      <div className="pt-8">
        <div className="premium-card bg-[var(--text-primary)] text-[var(--bg)] border-none flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
              <Sparkles size={28} />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-1">Refine your profile</h3>
              <p className="text-sm opacity-60">Guided conversation helps us understand your evolving interests.</p>
            </div>
          </div>
          <button 
            onClick={onRefine}
            className="px-8 py-4 bg-[var(--bg)] text-[var(--text-primary)] rounded-2xl font-semibold hover:opacity-90 transition-all flex items-center gap-2 shrink-0"
          >
            Open Assistant <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </Layout>
  );
}
