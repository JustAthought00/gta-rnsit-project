import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
  onEnterApp: () => void;
}

const CONFETTI_COLORS = ['#ff3d9a', '#2ee6d6', '#ffd93d', '#7c5cff', '#ff8a2b'];

const SplashScreen = ({ onEnterApp }: SplashScreenProps) => {
  const [phase, setPhase] = useState(0);
  const [confetti, setConfetti] = useState<Array<{ id: number; x: number; y: number; color: string; size: number; delay: number }>>([]);

  useEffect(() => {
    setConfetti(
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 8 + Math.random() * 10,
        delay: Math.random() * 0.6,
      }))
    );

    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1600),
      setTimeout(() => setPhase(4), 2600),
      setTimeout(() => onEnterApp(), 3000),
    ];

    return () => timers.forEach(clearTimeout);
  }, [onEnterApp]);

  const letters = [
    { char: 'G', color: '#ff3d9a' },
    { char: 'T', color: '#2ee6d6' },
    { char: 'A', color: '#ffd93d' },
  ];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] overflow-hidden flex flex-col items-center justify-center"
        style={{
          background: 'radial-gradient(ellipse at 20% 0%, #ffd6ea 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, #c9fff5 0%, transparent 55%), radial-gradient(ellipse at 50% 100%, #fff3c4 0%, transparent 55%), #fdf6ff',
        }}
        initial={{ opacity: 1 }}
        animate={{ opacity: phase >= 4 ? 0 : 1 }}
        transition={{ duration: 0.35, ease: 'easeInOut' }}
      >
        {confetti.map((c) => (
          <motion.div
            key={c.id}
            className="absolute rounded-full"
            style={{ left: `${c.x}%`, top: `${c.y}%`, width: c.size, height: c.size, background: c.color }}
            initial={{ opacity: 0, scale: 0 }}
            animate={phase >= 1 ? { opacity: 0.9, scale: 1, y: [0, -12, 0] } : {}}
            transition={{ duration: 1.6, repeat: Infinity, delay: c.delay, ease: 'easeInOut' }}
          />
        ))}

        <div className="flex items-center space-x-1 md:space-x-3">
          {letters.map((l, i) => (
            <motion.span
              key={l.char}
              className="text-7xl md:text-9xl font-bold font-display"
              style={{ color: l.color, WebkitTextStroke: '3px #2b1a3d' }}
              initial={{ opacity: 0, scale: 0, rotate: -20 }}
              animate={phase >= 1 ? { opacity: 1, scale: 1, rotate: 0 } : {}}
              transition={{ type: 'spring', stiffness: 260, damping: 12, delay: i * 0.15 }}
            >
              {l.char}
            </motion.span>
          ))}
        </div>

        <motion.p
          className="mt-6 text-base md:text-xl font-semibold text-[#2b1a3d] font-display text-center px-6"
          initial={{ opacity: 0, y: 10 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
        >
          RNSIT's go-to app for skills
        </motion.p>
      </motion.div>
    </AnimatePresence>
  );
};

export default SplashScreen;
