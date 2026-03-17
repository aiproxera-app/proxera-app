import React from 'react';
import { motion } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function Layout({ children, className = "" }: LayoutProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`content-container py-8 md:py-12 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function Section({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`mb-12 md:mb-16 ${className}`}>
      {title && (
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-6">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
