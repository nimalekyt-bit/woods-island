import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export interface CharacterConfig {
  id: string;
  name: string;
  emoji: string;
  type: 'eyes' | 'pixel' | 'flame' | 'jelly' | 'pet';
}

export const CHARACTERS_LIST: CharacterConfig[] = [
  { id: 'spark', name: 'Spark', emoji: '✨', type: 'eyes' },
  { id: 'pixel', name: 'Pixel', emoji: '👾', type: 'pixel' },
  { id: 'eyes', name: 'Eyes', emoji: '👀', type: 'eyes' },
  { id: 'campfire', name: 'Campfire', emoji: '🔥', type: 'flame' },
  { id: 'jellyfish', name: 'Jellyfish', emoji: '🪼', type: 'jelly' },
  { id: 'hamster', name: 'Hamster Wheel', emoji: '🐹', type: 'pet' },
  { id: 'cat', name: 'Neko', emoji: '🐱', type: 'pet' },
  { id: 'lens', name: 'Lens', emoji: '🔍', type: 'eyes' },
];

interface CharacterAvatarProps {
  charId: string;
  isPlaying?: boolean;
}

export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  charId,
  isPlaying = true,
}) => {
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);

  // Track cursor for pupil movement
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const centerX = window.innerWidth / 2;
      const centerY = 20; // Top island position
      const dx = (e.clientX - centerX) / (window.innerWidth / 2);
      const dy = Math.max(-1, Math.min(1, (e.clientY - centerY) / 300));
      setPupilOffset({
        x: Math.max(-2.5, Math.min(2.5, dx * 3)),
        y: Math.max(-1.5, Math.min(1.5, dy * 2)),
      });
    };

    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  // Natural blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    }, 3800 + Math.random() * 2000);

    return () => clearInterval(blinkInterval);
  }, []);

  // Render Eyes
  if (charId === 'eyes' || charId === 'spark') {
    return (
      <div className="flex items-center gap-1.5 px-1 py-0.5">
        {[0, 1].map((eye) => (
          <div
            key={eye}
            className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white shadow-inner overflow-hidden transition-all"
            style={{
              transform: isBlinking ? 'scaleY(0.1)' : 'scaleY(1)',
            }}
          >
            {/* Pupil */}
            <motion.div
              animate={{
                x: pupilOffset.x,
                y: pupilOffset.y,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="h-2 w-2 rounded-full bg-black shadow-sm"
            >
              {/* Highlight dot */}
              <div className="ml-0.5 mt-0.5 h-0.5 w-0.5 rounded-full bg-white" />
            </motion.div>
          </div>
        ))}
      </div>
    );
  }

  // Render Pixel
  if (charId === 'pixel') {
    return (
      <motion.div
        animate={isPlaying ? { y: [0, -1.5, 0] } : {}}
        transition={{ repeat: Infinity, duration: 0.6 }}
        className="font-mono text-sm leading-none text-emerald-400 select-none"
      >
        {isBlinking ? '(-ω-)' : '(・ω・)'}
      </motion.div>
    );
  }

  // Fallback Emoji / Character
  const current = CHARACTERS_LIST.find((c) => c.id === charId) || CHARACTERS_LIST[0];
  return (
    <motion.div
      animate={isPlaying ? { scale: [1, 1.1, 1] } : {}}
      transition={{ repeat: Infinity, duration: 0.7 }}
      className="text-sm select-none"
    >
      {current.emoji}
    </motion.div>
  );
};
