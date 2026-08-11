import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
  onEnterApp: () => void;
}

const FULL_TEXT = 'gta_';

const SplashScreen = ({ onEnterApp }: SplashScreenProps) => {
  const [typed, setTyped] = useState('');
  const [showTagline, setShowTagline] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    let i = 0;
    const typeInterval = setInterval(() => {
      i += 1;
      setTyped(FULL_TEXT.slice(0, i));
      if (i >= FULL_TEXT.length) clearInterval(typeInterval);
    }, 120);

    const timers = [
      setTimeout(() => setShowTagline(true), 900),
      setTimeout(() => setFadeOut(true), 1700),
      setTimeout(() => onEnterApp(), 2100),
    ];

    return () => {
      clearInterval(typeInterval);
      timers.forEach(clearTimeout);
    };
  }, [onEnterApp]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] bg-[#0a0b0d] flex flex-col items-center justify-center font-mono"
        initial={{ opacity: 1 }}
        animate={{ opacity: fadeOut ? 0 : 1 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        <div className="flex items-center text-5xl md:text-7xl font-bold text-[#8aff2e]">
          <span>{typed}</span>
          <motion.span
            className="inline-block w-[0.5em] h-[1em] bg-[#8aff2e] ml-1"
            animate={{ opacity: [1, 1, 0, 0] }}
            transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
          />
        </div>

        <motion.p
          className="mt-6 text-xs md:text-sm tracking-[0.3em] text-white/50 uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: showTagline ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        >
          rnsit's go-to app for skills
        </motion.p>
      </motion.div>
    </AnimatePresence>
  );
};

export default SplashScreen;
