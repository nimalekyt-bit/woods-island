import React, { useState, useEffect } from 'react';
import { LiquidPill } from './components/LiquidPill';
import { ExpandedPanel, TabType } from './components/ExpandedPanel';
import { CommandBar } from './components/CommandBar';
import { motion, AnimatePresence } from 'framer-motion';

export function App() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [character, setCharacter] = useState<string>('spark');

  // Handle global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes open panels
      if (e.key === 'Escape') {
        if (isCommandBarOpen) setIsCommandBarOpen(false);
        else if (isExpanded) setIsExpanded(false);
        return;
      }

      // Alt + Space opens Command Bar
      if (e.altKey && e.code === 'Space') {
        e.preventDefault();
        setIsCommandBarOpen((prev) => !prev);
        return;
      }

      // Ctrl + Alt + I toggles Expanded Island
      if (e.ctrlKey && e.altKey && e.code === 'KeyI') {
        e.preventDefault();
        setIsExpanded((prev) => !prev);
        return;
      }

      // Ctrl + Alt + V opens Clipboard History directly
      if (e.ctrlKey && e.altKey && e.code === 'KeyV') {
        e.preventDefault();
        setActiveTab('clipboard');
        setIsExpanded(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, isCommandBarOpen]);

  return (
    <main className="relative flex h-screen w-screen flex-col items-center justify-start overflow-hidden bg-transparent">
      {/* Floating Command Bar (Alt + Space) */}
      <CommandBar
        isOpen={isCommandBarOpen}
        onClose={() => setIsCommandBarOpen(false)}
      />

      {/* Dynamic Island Window Container */}
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <LiquidPill
            key="collapsed-pill"
            isExpanded={false}
            character={character}
            onToggleExpand={() => setIsExpanded(true)}
          />
        ) : (
          <motion.div
            key="expanded-island"
            initial={{ opacity: 0, scale: 0.94, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -10 }}
            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            className="relative mx-auto mt-2 h-[560px] w-[860px] overflow-hidden rounded-[26px] border border-white/15 bg-black shadow-2xl"
            style={{
              boxShadow:
                '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            }}
          >
            <ExpandedPanel
              onClose={() => setIsExpanded(false)}
              initialTab={activeTab}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

export default App;
