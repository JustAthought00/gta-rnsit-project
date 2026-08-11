import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
  onEnterApp: () => void;
}

const SplashScreen = ({ onEnterApp }: SplashScreenProps) => {
  const [dotsOn, setDotsOn] = useState(0);
  const [showText, setShowText] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const dotTimers = [0, 1, 2].map((i) =>
      setTimeout(() => setDotsOn(i + 1), 250 + i * 200)
    );

    const timers = [
      setTimeout(() => setShowText(true), 950),
      setTimeout(() => setFadeOut(true), 1900),
      setTimeout(() => onEnterApp(), 2300),
    ];

    return () => {
      dotTimers.forEach(clearTimeout);
      timers.forEach(clearTimeout);
    };
  }, [onEnterApp]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center"
        initial={{ opacity: 1 }}
        animate={{ opacity: fadeOut ? 0 : 1 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {/* Glyph dots — boot sequence, mimicking Nothing's LED array */}
        <div className="flex items-center space-x-3 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full transition-colors duration-200"
              style={{ backgroundColor: dotsOn > i ? '#FF0033' : 'rgba(255,255,255,0.15)' }}
            />
          ))}
        </div>

        <motion.h1
          className="text-4xl md:text-6xl font-display font-extrabold text-white tracking-tight"
          initial={{ opacity: 0 }}
          animate={{ opacity: showText ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        >
          GTA
        </motion.h1>

        <motion.p
          className="mt-3 font-dot text-[11px] md:text-xs text-white/50 tracking-[0.2em]"
          initial={{ opacity: 0 }}
          animate={{ opacity: showText ? 1 : 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          RNSIT'S GO-TO APP FOR SKILLS
        </motion.p>
      </motion.div>
    </AnimatePresence>
  );
};

export default SplashScreen;
