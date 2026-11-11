import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music,
  Wifi,
  ShieldCheck,
  Battery,
  Volume2,
  Sparkles,
  Play,
  Pause,
  SkipForward,
  ChevronDown
} from 'lucide-react';
import { CharacterAvatar } from './Characters';

interface LiquidPillProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  character?: string;
}

export const LiquidPill: React.FC<LiquidPillProps> = ({
  isExpanded,
  onToggleExpand,
  character = 'spark'
}) => {
  const [time, setTime] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isNear, setIsNear] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);

  // Update clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Track cursor for magnetic fluid pull
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!pillRef.current) return;
      const rect = pillRef.current.getBoundingClientRect();
      const pillCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      const dist = Math.hypot(e.clientX - pillCenter.x, e.clientY - pillCenter.y);
      
      // If cursor is within 140px, engage magnetic pull
      if (dist < 140) {
        setIsNear(true);
        setMousePos({
          x: ((e.clientX - pillCenter.x) / 140) * 12,
          y: Math.min(16, Math.max(0, (e.clientY - rect.bottom) * 0.4))
        });
      } else {
        setIsNear(false);
        setMousePos({ x: 0, y: 0 });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <motion.div
      ref={pillRef}
      onClick={onToggleExpand}
      animate={{
        width: isExpanded ? 780 : 260,
        height: isExpanded ? 520 : 38,
        borderRadius: isExpanded ? 24 : 20,
        y: isNear && !isExpanded ? mousePos.y : 0,
        x: isNear && !isExpanded ? mousePos.x * 0.5 : 0
      }}
      transition={{
        type: 'spring',
        stiffness: 420,
        damping: 30,
        mass: 0.8
      }}
      className={`relative mx-auto mt-1 cursor-pointer overflow-hidden liquid-pill select-none ${
        isExpanded ? 'liquid-glow' : ''
      }`}
      style={{
        border: '1px solid rgba(255, 255, 255, 0.12)'
      }}
    >
      {/* Collapsed Pill State */}
      {!isExpanded && (
        <div className="flex h-full w-full items-center justify-between px-3.5 text-xs text-white">
          {/* Left: Music / Equalizer indicator */}
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-emerald-400">
              <Music className="h-3 w-3 animate-pulse" />
            </div>
            <div className="flex items-center gap-0.5">
              {[0.4, 0.8, 0.5, 0.9, 0.3].map((height, i) => (
                <motion.div
                  key={i}
                  animate={{ scaleY: [0.3, height, 0.4] }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.8,
                    delay: i * 0.12,
                    ease: 'easeInOut'
                  }}
                  className="h-2.5 w-0.5 rounded-full bg-emerald-400"
                />
              ))}
            </div>
          </div>

          {/* Center: Character avatar or Clock */}
          <div className="flex items-center gap-1.5 font-medium tracking-tight">
            <CharacterAvatar charId={character} isPlaying={isPlaying} />
            <span className="font-mono text-[11px] text-white/90">{time}</span>
          </div>

          {/* Right: Quick system chips */}
          <div className="flex items-center gap-2 text-white/60">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
            <div className="flex items-center gap-0.5 font-mono text-[10px]">
              <Battery className="h-3 w-3 text-white/80" />
              <span>94%</span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
