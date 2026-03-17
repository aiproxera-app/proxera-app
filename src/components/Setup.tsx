import { useState } from "react";
import { motion } from "motion/react";
import { FileText, Link2, MessageSquare, ChevronRight, Sparkles, Target, Zap, ShieldCheck, ArrowRight } from "lucide-react";
import ImportModal from "./ImportModal";
import Layout, { Section } from "./Layout";

interface SetupProps {
  hasProfile: boolean;
  onComplete: () => void;
  onManualStart: () => void;
}

export default function Setup({ hasProfile, onComplete, onManualStart }: SetupProps) {
  const [showImport, setShowImport] = useState(false);

  return (
    <Layout className="flex flex-col items-center justify-center min-h-[80vh]">
      <div className="max-w-[820px] w-full">
        <header className="mb-20 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-20 h-20 bg-[var(--text-primary)] text-[var(--bg)] rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-xl"
          >
            <Sparkles size={40} />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-semibold tracking-tight text-[var(--text-primary)] mb-6"
          >
            {hasProfile ? "Expand your identity" : "Build your network identity"}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-[var(--text-secondary)] text-xl max-w-xl mx-auto leading-relaxed"
          >
            {hasProfile 
              ? "Add more context to refine your behavioral signals and discover deeper connections."
              : "Proxera turns your digital context into a behavioral profile, helping you discover people through thinking compatibility."}
          </motion.p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
          <ActivationCard
            primary
            icon={<FileText size={24} />}
            title={hasProfile ? "Import More History" : "Import AI History"}
            subtitle={hasProfile 
              ? "Add new ChatGPT or Claude conversations to update your profile with recent explorations."
              : "Sync your ChatGPT or Claude conversations to build your profile instantly."}
            onClick={() => setShowImport(true)}
            cta={hasProfile ? "Add Context" : "Start Import"}
          />

          <ActivationCard
            icon={<MessageSquare size={24} />}
            title={hasProfile ? "Refine via Chat" : "Guided Setup"}
            subtitle={hasProfile
              ? "Talk to our assistant to manually refine specific topics or domains in your profile."
              : "Answer a few questions to build your profile step by step with our assistant."}
            onClick={onManualStart}
            cta={hasProfile ? "Start Refinement" : "Start Chat"}
          />
        </div>

        {!hasProfile && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pt-20 border-t border-[var(--border)]">
            <ValueProp 
              icon={<Target size={24} />}
              title="Identity"
              description="A dynamic representation of your interests and thinking style."
            />
            <ValueProp 
              icon={<Zap size={24} />}
              title="Matching"
              description="Discover connections based on how you think, not just keywords."
            />
            <ValueProp 
              icon={<ShieldCheck size={24} />}
              title="Privacy"
              description="Your raw data is never shared. Only inferred signals power discovery."
            />
          </div>
        )}
      </div>

      {showImport && (
        <ImportModal 
          onClose={() => setShowImport(false)} 
          onSuccess={onComplete} 
        />
      )}
    </Layout>
  );
}

function ActivationCard({ icon, title, subtitle, onClick, cta, primary, badge, disabled }: any) {
  return (
    <motion.button
      whileHover={!disabled ? { y: -4 } : {}}
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col text-left p-10 rounded-3xl border transition-all h-full ${
        primary 
          ? "bg-[var(--text-primary)] text-[var(--bg)] border-[var(--text-primary)] shadow-xl" 
          : "bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--bg)]"
      } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 ${
        primary ? "bg-[var(--bg)] text-[var(--text-primary)]" : "bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)]"
      }`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="font-semibold text-2xl">{title}</h3>
          {badge && (
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-[var(--bg)]/10 rounded-md">
              {badge}
            </span>
          )}
        </div>
        <p className={`text-base leading-relaxed mb-8 ${primary ? "opacity-70" : "text-[var(--text-secondary)]"}`}>{subtitle}</p>
      </div>
      {!disabled && (
        <div className={`flex items-center gap-2 text-sm font-bold uppercase tracking-widest ${primary ? "text-[var(--bg)]" : "text-[var(--text-primary)]"}`}>
          {cta} <ArrowRight size={18} />
        </div>
      )}
    </motion.button>
  );
}

function ValueProp({ icon, title, description }: any) {
  return (
    <div className="text-center md:text-left">
      <div className="text-[var(--text-primary)] mb-4 flex justify-center md:justify-start">{icon}</div>
      <h4 className="font-semibold text-lg mb-2">{title}</h4>
      <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{description}</p>
    </div>
  );
}
