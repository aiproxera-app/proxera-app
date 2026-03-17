import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, Sparkles, ChevronRight, Heart, Bookmark, Lock, Target, Database, Activity, User } from "lucide-react";
import Layout, { Section } from "./Layout";
import { apiFetch } from "../services/auth";

export default function Matches({ hasProfile }: { hasProfile: boolean }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mySignals, setMySignals] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!hasProfile) {
        setLoading(false);
        return;
      }

      const matchesRes = await apiFetch("/api/matches");
      const signalsRes = await apiFetch("/api/signals");
      const matchesData = await matchesRes.json();
      const signalsData = await signalsRes.json();
      
      setMySignals(signalsData);
      setMatches(matchesData.all || matchesData);
      setLoading(false);
    };

    fetchData();
  }, [hasProfile]);

  if (!hasProfile) {
    return (
      <Layout className="flex flex-col items-center justify-center min-h-[80vh]">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="w-20 h-20 bg-[var(--surface)] rounded-3xl shadow-sm border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--text-secondary)]">
            <Lock size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-semibold mb-3">Matches are locked</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              We need to understand your behavioral profile before we can suggest compatible connections.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) return <div className="p-10 text-[var(--text-secondary)]">Finding compatible connections...</div>;

  return (
    <Layout>
      <header className="mb-16">
        <h1 className="text-4xl font-semibold tracking-tight mb-4">Connections</h1>
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <p className="text-[var(--text-secondary)] text-lg flex-1">
            Intelligent introductions based on behavioral compatibility.
          </p>
          <div className="p-6 bg-[var(--surface)] border border-[var(--border)] rounded-3xl max-w-md">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-4">
              <Target size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Match Logic</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Your strongest compatibility candidates based on behavior, reasoning, and topic overlap. We prioritize people who think like you and are exploring similar domains.
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-8">
        {matches.map((match, i) => (
          <motion.div
            key={match.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="premium-card flex flex-col md:flex-row gap-8"
          >
            <div className="flex-1">
              <div className="flex items-center gap-6 mb-8">
                <div className="w-16 h-16 bg-[var(--bg)] border border-[var(--border)] rounded-2xl flex items-center justify-center text-[var(--text-primary)] font-bold text-2xl shrink-0">
                  {match.name[0]}
                </div>
                <div className="min-w-0">
                  <h3 className="text-2xl font-semibold truncate">{match.name}</h3>
                  <p className="text-[var(--text-secondary)] truncate">{match.headline || "Explorer"}</p>
                </div>
                <div className="ml-auto flex gap-2">
                  <button 
                    disabled
                    title="Coming soon"
                    className="p-3 hover:bg-[var(--bg)] rounded-xl transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] opacity-50 cursor-not-allowed"
                  >
                    <Bookmark size={20} />
                  </button>
                  <button 
                    disabled
                    title="Coming soon"
                    className="p-3 hover:bg-[var(--bg)] rounded-xl transition-all text-[var(--text-secondary)] hover:text-pink-500 opacity-50 cursor-not-allowed"
                  >
                    <Heart size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-4">
                    <Sparkles size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Compatibility Insight</span>
                  </div>
                  <div className="bg-[var(--bg)] p-6 rounded-2xl border border-[var(--border)] italic text-[var(--text-primary)] leading-relaxed text-sm">
                    "{match.explanation || "Analyzing compatibility signals..."}"
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest block mb-3">Behavioral Identity</span>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-medium">
                        {match.behavioral_identity.communication_style}
                      </span>
                      <span className="px-3 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-medium">
                        {match.behavioral_identity.interaction_type}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest block mb-3">Active Explorations</span>
                    <div className="flex flex-wrap gap-2">
                      {(match.active_explorations || []).slice(0, 3).map((topic: string, j: number) => (
                        <span key={j} className="px-3 py-1 bg-[var(--bg)] border border-[var(--border)] rounded-full text-xs text-[var(--text-secondary)] italic">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:w-64 flex flex-col justify-center items-center p-8 bg-[var(--surface)] border border-[var(--border)] rounded-2xl">
              <div className="text-center mb-8">
                <div className="text-4xl font-semibold text-[var(--text-primary)]">{match.score}%</div>
                <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold mt-1">Match Score</div>
              </div>
              
              {match.breakdown && (
                <div className="w-full space-y-3 mb-8">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">
                      <span>Behavioral</span>
                      <span>{match.breakdown.behavioral}%</span>
                    </div>
                    <div className="h-1 bg-[var(--bg)] rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${match.breakdown.behavioral}%` }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">
                      <span>Explorations</span>
                      <span>{match.breakdown.explorations}%</span>
                    </div>
                    <div className="h-1 bg-[var(--bg)] rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${match.breakdown.explorations}%` }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">
                      <span>Domains</span>
                      <span>{match.breakdown.domains}%</span>
                    </div>
                    <div className="h-1 bg-[var(--bg)] rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${match.breakdown.domains}%` }} />
                    </div>
                  </div>
                </div>
              )}

              <button 
                disabled
                title="Coming soon"
                className="w-full py-4 bg-[var(--text-primary)] text-[var(--bg)] rounded-2xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
              >
                Connect <ChevronRight size={18} />
              </button>
            </div>
          </motion.div>
        ))}

        {matches.length === 0 && (
          <div className="p-20 text-center bg-[var(--surface)] rounded-3xl border border-dashed border-[var(--border)]">
            <p className="text-[var(--text-secondary)]">No matches found yet. Check back soon!</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
