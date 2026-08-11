import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
  onEnterApp: () => void;
}

const SplashScreen = ({ onEnterApp }: SplashScreenProps) => {
  const [phase, setPhase] = useState(0); // 0: initial, 1: G, 2: T, 3: A, 4: tagline, 5: fade out

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 750),
      setTimeout(() => setPhase(3), 1100),
      setTimeout(() => setPhase(4), 1700),
      setTimeout(() => setPhase(5), 2900),
      setTimeout(() => onEnterApp(), 3400),
    ];

    return () => timers.forEach(clearTimeout);
  }, [onEnterApp]);

  const letterVariants = {
    hidden: { opacity: 0, y: -60, rotate: -8, scale: 0.6 },
    visible: { opacity: 1, y: 0, rotate: 0, scale: 1 },
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] overflow-hidden bg-[#0d0e12] flex flex-col items-center justify-center"
        initial={{ opacity: 1 }}
        animate={{ opacity: phase >= 5 ? 0 : 1 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
      >
        {/* Flat sticker shapes — no blur, no glow */}
        <div className="absolute top-[15%] left-[12%] w-10 h-10 rotate-12 bg-[#ff8a2b] border-[3px] border-white rounded-lg hidden md:block" />
        <div className="absolute bottom-[20%] left-[18%] w-6 h-6 -rotate-12 bg-[#3b82f6] border-[3px] border-white rounded-full hidden md:block" />
        <div className="absolute top-[22%] right-[15%] w-8 h-8 rotate-45 bg-[#3b82f6] border-[3px] border-white rounded-lg hidden md:block" />
        <div className="absolute bottom-[25%] right-[12%] w-9 h-9 rotate-6 bg-[#ff8a2b] border-[3px] border-white rounded-full hidden md:block" />

        {/* Main content */}
        <div className="flex items-center justify-center space-x-2 md:space-x-4">
          <motion.span
            className="text-7xl md:text-9xl font-black font-display text-white"
            style={{ textShadow: '5px 5px 0 #ff8a2b' }}
            variants={letterVariants}
            initial="hidden"
            animate={phase >= 1 ? 'visible' : 'hidden'}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            G
          </motion.span>
          <motion.span
            className="text-7xl md:text-9xl font-black font-display text-white"
            style={{ textShadow: '5px 5px 0 #3b82f6' }}
            variants={letterVariants}
            initial="hidden"
            animate={phase >= 2 ? 'visible' : 'hidden'}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            T
          </motion.span>
          <motion.span
            className="text-7xl md:text-9xl font-black font-display text-white"
            style={{ textShadow: '5px 5px 0 #ff8a2b' }}
            variants={letterVariants}
            initial="hidden"
            animate={phase >= 3 ? 'visible' : 'hidden'}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            A
          </motion.span>
        </div>

        {/* Tagline */}
        <motion.div
          className="mt-8 md:mt-10 text-center"
          initial={{ opacity: 0, y: 15 }}
          animate={phase >= 4 ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
        >
          <p className="text-sm md:text-lg font-bold tracking-[0.25em] text-white/90 font-display">
            RNSIT&apos;S GO-TO APP FOR SKILLS
          </p>
          <motion.div
            className="mt-4 h-[3px] bg-[#ff8a2b] mx-auto"
            initial={{ width: 0 }}
            animate={phase >= 4 ? { width: '60%' } : {}}
            transition={{ duration: 0.5 }}
          />
        </motion.div>

        {/* Loading indicator — solid squares, no glow */}
        <motion.div
          className="absolute bottom-16 flex items-center space-x-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase >= 4 ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2.5 h-2.5 bg-white"
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SplashScreen;
