import { useState, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Compass, User, Users, Settings, Sparkles, LogOut, ChevronRight, LayoutGrid, ShieldCheck, Moon, Sun, RefreshCw, Trash2, Edit3, Key } from "lucide-react";
import Chat from "./components/Chat";
import Insights from "./components/Insights";
import Matches from "./components/Matches";
import Setup from "./components/Setup";
import Discovery from "./components/Discovery";
import { ThemeProvider, useTheme } from "./components/ThemeContext";
import { apiFetch, getStoredUserId, setStoredUserId } from "./services/auth";

type Page = "setup" | "discovery" | "profile" | "matches" | "settings" | "login" | "chat";

function AppContent() {
  const [page, setPage] = useState<Page>("login");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await apiFetch("/api/me");
      const data = await res.json();
      if (data) {
        setUser(data);
        await checkProfile();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const checkProfile = async () => {
    try {
      const res = await apiFetch("/api/signals");
      const data = await res.json();
      if (data) {
        setHasProfile(true);
        setPage("discovery");
      } else {
        setHasProfile(false);
        setPage("setup");
      }
    } catch (e) {
      setPage("setup");
    }
  };

  const handleLogin = (u: any) => {
    setUser(u);
    checkProfile();
  };

  const handleRegenerate = async () => {
    try {
      const rebuildRes = await apiFetch("/api/rebuild-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!rebuildRes.ok) throw new Error("Profile rebuild failed");
      await checkProfile();
      alert("Profile regenerated successfully!");
    } catch (e: any) {
      console.error(e);
      alert(`Failed to regenerate profile: ${e.message}`);
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset your identity? This cannot be undone.")) return;
    try {
      const res = await apiFetch("/api/reset", { method: "POST" });
      if (!res.ok) throw new Error("Server error during reset");
      window.location.reload(); 
    } catch (e) {
      console.error("Reset error:", e);
      alert(`Failed to reset identity: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text-secondary)]">Loading...</div>;

  if (page === "login") {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg)] p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[var(--card)] p-8 rounded-3xl shadow-sm border border-[var(--border)]"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-[var(--text-primary)] rounded-xl flex items-center justify-center text-[var(--bg)]">
              <Sparkles size={20} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Proxera</h1>
          </div>
          <p className="text-[var(--text-secondary)] mb-8 leading-relaxed">
            Unlock your network identity and discover people through behavioral compatibility.
          </p>
          <button 
            onClick={() => handleLogin({ id: 1, name: "User" })}
            className="w-full py-3 bg-[var(--text-primary)] text-[var(--bg)] rounded-xl font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            Enter Platform <ChevronRight size={18} />
          </button>
          <p className="text-xs text-[var(--text-secondary)] mt-6 text-center flex items-center justify-center gap-2">
            <ShieldCheck size={12} /> Privacy First • AI Powered
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[var(--bg)] font-sans text-[var(--text-primary)] overflow-hidden">
      {/* Minimal Sidebar */}
      <nav className="w-20 md:w-64 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col p-4 transition-all duration-300">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 bg-[var(--text-primary)] rounded-lg flex items-center justify-center text-[var(--bg)] shrink-0">
            <Sparkles size={16} />
          </div>
          <span className="font-semibold tracking-tight hidden md:block">Proxera</span>
        </div>

        <div className="flex-1 space-y-2">
          <NavItem active={page === "discovery" || page === "chat"} onClick={() => setPage("discovery")} icon={<Compass size={20} />} label="Discovery" />
          <NavItem active={page === "matches"} onClick={() => setPage("matches")} icon={<Users size={20} />} label="Matches" />
          <NavItem active={page === "profile"} onClick={() => setPage("profile")} icon={<User size={20} />} label="My Profile" />
          <NavItem active={page === "setup"} onClick={() => setPage("setup")} icon={<LayoutGrid size={20} />} label={hasProfile ? "Add Context" : "Build Profile"} />
        </div>

        <div className="pt-4 border-t border-[var(--border)] space-y-2">
          <NavItem active={page === "settings"} onClick={() => setPage("settings")} icon={<Settings size={20} />} label="Settings" />
          <NavItem active={false} onClick={() => setPage("login")} icon={<LogOut size={20} />} label="Log Out" />
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 relative overflow-y-auto scroll-smooth">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {page === "setup" && (
              <Setup 
                hasProfile={hasProfile}
                onComplete={() => { 
                  setHasProfile(true); 
                  setPage("discovery"); 
                  setShowSuccessBanner(true);
                }} 
                onManualStart={() => setPage("chat")} 
              />
            )}
            {page === "discovery" && (
              <Discovery 
                hasProfile={hasProfile} 
                showSuccess={showSuccessBanner}
                onCloseSuccess={() => setShowSuccessBanner(false)}
                onRefine={() => setPage("chat")} 
                onStartSetup={() => setPage("setup")} 
              />
            )}
            {page === "chat" && <Chat hasProfile={hasProfile} onBack={() => setPage("discovery")} />}
            {page === "profile" && <Insights />}
            {page === "matches" && <Matches hasProfile={hasProfile} />}
            {page === "settings" && (
              <SettingsPage 
                toggleTheme={toggleTheme} 
                theme={theme} 
                onRegenerate={handleRegenerate}
                onReset={handleReset}
                onEditProfile={() => setPage("profile")}
                onDeleteConversations={() => setPage("profile")}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function SettingsPage({ 
  toggleTheme, 
  theme, 
  onRegenerate, 
  onReset, 
  onEditProfile, 
  onDeleteConversations 
}: { 
  toggleTheme: () => void; 
  theme: string;
  onRegenerate: () => void;
  onReset: () => void;
  onEditProfile: () => void;
  onDeleteConversations: () => void;
}) {
  const [devUserId, setDevUserId] = useState(getStoredUserId());

  const handleUpdateUserId = () => {
    if (!devUserId.trim()) return;
    setStoredUserId(devUserId.trim());
    window.location.reload();
  };

  return (
    <div className="content-container py-12">
      <h1 className="text-3xl font-semibold mb-12">Settings</h1>
      
      <div className="space-y-12">
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-6">Development</h2>
          <div className="premium-card space-y-4">
            <div>
              <p className="font-medium">User ID Override</p>
              <p className="text-sm text-[var(--text-secondary)] mb-4">Change your current session user ID for testing multi-user scenarios.</p>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={devUserId}
                  onChange={(e) => setDevUserId(e.target.value)}
                  className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)]/10"
                />
                <button 
                  onClick={handleUpdateUserId}
                  className="px-4 py-2 bg-[var(--text-primary)] text-[var(--bg)] rounded-xl text-sm font-medium hover:opacity-90 transition-all"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-6">Appearance</h2>
          <div className="premium-card flex items-center justify-between">
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-[var(--text-secondary)]">Switch between light and dark mode</p>
            </div>
            <button 
              onClick={toggleTheme}
              className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl hover:bg-[var(--border)] transition-all"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-6">Profile Management</h2>
          <div className="space-y-4">
            <div className="premium-card flex items-center justify-between">
              <div>
                <p className="font-medium">Regenerate Profile</p>
                <p className="text-sm text-[var(--text-secondary)]">Re-analyze your conversations to update your identity</p>
              </div>
              <button 
                onClick={onRegenerate}
                className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl hover:bg-[var(--border)] transition-all"
              >
                <RefreshCw size={20} />
              </button>
            </div>
            <div className="premium-card flex items-center justify-between">
              <div>
                <p className="font-medium">Edit Profile</p>
                <p className="text-sm text-[var(--text-secondary)]">Manually adjust your identity summary and traits</p>
              </div>
              <button 
                onClick={onEditProfile}
                className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl hover:bg-[var(--border)] transition-all"
              >
                <Edit3 size={20} />
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-6">Data Management</h2>
          <div className="space-y-4">
            <div className="premium-card flex items-center justify-between">
              <div>
                <p className="font-medium">Delete Conversations</p>
                <p className="text-sm text-[var(--text-secondary)]">Remove specific conversations from your corpus</p>
              </div>
              <button 
                onClick={onDeleteConversations}
                className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl hover:bg-red-500/10 text-red-500 transition-all"
              >
                <Trash2 size={20} />
              </button>
            </div>
            <div className="premium-card flex items-center justify-between">
              <div>
                <p className="font-medium text-red-500">Reset Identity</p>
                <p className="text-sm text-[var(--text-secondary)]">Completely wipe your profile and start over</p>
              </div>
              <button 
                onClick={onReset}
                className="p-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-6">System</h2>
          <div className="premium-card opacity-50">
            <p className="text-sm italic">Advanced system options will appear here.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
        active 
          ? "bg-[var(--bg)] text-[var(--text-primary)] font-medium shadow-sm border border-[var(--border)]" 
          : "text-[var(--text-secondary)] hover:bg-[var(--bg)] hover:text-[var(--text-primary)]"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="hidden md:block text-sm">{label}</span>
      {active && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 bg-[var(--text-primary)] rounded-full hidden md:block" />}
    </button>
  );
}
