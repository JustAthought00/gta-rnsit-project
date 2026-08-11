import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
  onEnterApp: () => void;
}

const SplashScreen = ({ onEnterApp }: SplashScreenProps) => {
  const [phase, setPhase] = useState(0); // 0: initial, 1: G, 2: T, 3: A, 4: tagline, 5: fade out
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number }>>([]);

  useEffect(() => {
    // Generate floating particles
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      delay: Math.random() * 3,
    }));
    setParticles(newParticles);

    // Animation timeline - extended duration
    const timers = [
      setTimeout(() => setPhase(1), 500),    // Show G
      setTimeout(() => setPhase(2), 1200),   // Show T
      setTimeout(() => setPhase(3), 1900),   // Show A
      setTimeout(() => setPhase(4), 2800),   // Show tagline
      setTimeout(() => setPhase(5), 4500),   // Start fade out
      setTimeout(() => onEnterApp(), 5200),  // Complete
    ];

    return () => timers.forEach(clearTimeout);
  }, [onEnterApp]);

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 z-[100] overflow-hidden"
        initial={{ opacity: 1 }}
        animate={{ opacity: phase >= 5 ? 0 : 1, scale: phase >= 5 ? 1.1 : 1 }}
        transition={{ duration: 0.7, ease: "easeInOut" }}
      >
        {/* Deep void background */}
        <div className="absolute inset-0 bg-[#060a14]">
          {/* Animated gradient overlay */}
          <motion.div
            className="absolute inset-0"
            animate={{
              background: [
                'radial-gradient(ellipse at 30% 20%, hsl(220 70% 15% / 0.8) 0%, transparent 50%)',
                'radial-gradient(ellipse at 70% 80%, hsl(220 70% 15% / 0.8) 0%, transparent 50%)',
                'radial-gradient(ellipse at 30% 80%, hsl(220 70% 15% / 0.8) 0%, transparent 50%)',
                'radial-gradient(ellipse at 30% 20%, hsl(220 70% 15% / 0.8) 0%, transparent 50%)',
              ]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />
        </div>

        {/* Nebula orbs with enhanced animation */}
        <motion.div 
          className="absolute w-[70vw] h-[70vw] rounded-full blur-[120px]"
          style={{
            background: 'radial-gradient(circle, hsl(217 80% 50% / 0.4), transparent 60%)',
            top: '-25%',
            left: '-25%',
          }}
          animate={{
            scale: [1, 1.3, 1],
            x: [0, 50, 0],
            y: [0, 30, 0],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        
        <motion.div 
          className="absolute w-[60vw] h-[60vw] rounded-full blur-[100px]"
          style={{
            background: 'radial-gradient(circle, hsl(185 70% 40% / 0.35), transparent 60%)',
            bottom: '-20%',
            right: '-15%',
          }}
          animate={{
            scale: [1, 1.2, 1],
            x: [0, -40, 0],
            y: [0, -30, 0],
            opacity: [0.25, 0.5, 0.25],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        
        <motion.div 
          className="absolute w-[50vw] h-[50vw] rounded-full blur-[90px]"
          style={{
            background: 'radial-gradient(circle, hsl(200 75% 45% / 0.3), transparent 60%)',
            top: '30%',
            right: '20%',
          }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />

        {/* Floating particles */}
        <div className="absolute inset-0">
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute rounded-full"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: particle.size,
                height: particle.size,
                background: `radial-gradient(circle, hsl(${195 + Math.random() * 45} 80% 70%), transparent)`,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0, 0.8, 0],
                scale: [0.5, 1.5, 0.5],
              }}
              transition={{
                duration: 4 + Math.random() * 3,
                repeat: Infinity,
                delay: particle.delay,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        {/* Light rays emanating from center */}
        <motion.div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase >= 3 ? 0.3 : 0 }}
          transition={{ duration: 1 }}
        >
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-[2px] h-[40vh] origin-bottom"
              style={{
                background: 'linear-gradient(to top, hsl(217 90% 61% / 0.6), transparent)',
                transform: `rotate(${i * 30}deg)`,
              }}
              animate={{
                opacity: [0.2, 0.5, 0.2],
                scaleY: [0.8, 1.2, 0.8],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.1,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>

        {/* Central glow ring */}
        <motion.div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ 
            opacity: phase >= 1 ? [0.3, 0.6, 0.3] : 0, 
            scale: phase >= 1 ? [0.8, 1.2, 0.8] : 0.5 
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <div 
            className="w-64 h-64 rounded-full blur-xl"
            style={{
              background: 'radial-gradient(circle, hsl(217 90% 61% / 0.4), transparent 70%)',
            }}
          />
        </motion.div>

        {/* Main content */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen">
          {/* Word container with perspective */}
          <div className="flex items-center justify-center space-x-2 md:space-x-5 perspective-1000">
            {/* G */}
            <motion.div
              initial={{ opacity: 0, y: 100, rotateX: -90, scale: 0.5 }}
              animate={phase >= 1 ? {
                opacity: 1,
                y: 0,
                rotateX: 0,
                scale: 1,
              } : {}}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.span
                className="text-7xl md:text-9xl font-black bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 bg-clip-text text-transparent"
                style={{
                  filter: 'drop-shadow(0 0 40px hsl(217 90% 61% / 0.8))',
                  textShadow: '0 0 60px hsl(217 90% 61% / 0.5)',
                }}
                animate={{
                  filter: [
                    'drop-shadow(0 0 30px hsl(217 90% 61% / 0.6))',
                    'drop-shadow(0 0 60px hsl(217 90% 61% / 0.9))',
                    'drop-shadow(0 0 30px hsl(217 90% 61% / 0.6))',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                G
              </motion.span>
            </motion.div>

            {/* T */}
            <motion.div
              initial={{ opacity: 0, y: 100, rotateX: -90, scale: 0.5 }}
              animate={phase >= 2 ? {
                opacity: 1,
                y: 0,
                rotateX: 0,
                scale: 1,
              } : {}}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.span
                className="text-7xl md:text-9xl font-black bg-gradient-to-br from-cyan-400 via-teal-500 to-cyan-600 bg-clip-text text-transparent"
                style={{
                  filter: 'drop-shadow(0 0 40px hsl(190 90% 50% / 0.8))',
                  textShadow: '0 0 60px hsl(190 90% 50% / 0.5)',
                }}
                animate={{
                  filter: [
                    'drop-shadow(0 0 30px hsl(190 90% 50% / 0.6))',
                    'drop-shadow(0 0 60px hsl(190 90% 50% / 0.9))',
                    'drop-shadow(0 0 30px hsl(190 90% 50% / 0.6))',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              >
                T
              </motion.span>
            </motion.div>

            {/* A */}
            <motion.div
              initial={{ opacity: 0, y: 100, rotateX: -90, scale: 0.5 }}
              animate={phase >= 3 ? {
                opacity: 1,
                y: 0,
                rotateX: 0,
                scale: 1,
              } : {}}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.span
                className="text-7xl md:text-9xl font-black bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent"
                style={{
                  filter: 'drop-shadow(0 0 40px hsl(205 90% 55% / 0.8))',
                  textShadow: '0 0 60px hsl(205 90% 55% / 0.5)',
                }}
                animate={{
                  filter: [
                    'drop-shadow(0 0 30px hsl(205 90% 55% / 0.6))',
                    'drop-shadow(0 0 60px hsl(205 90% 55% / 0.9))',
                    'drop-shadow(0 0 30px hsl(205 90% 55% / 0.6))',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              >
                A
              </motion.span>
            </motion.div>
          </div>

          {/* Tagline */}
          <motion.div 
            className="mt-8 md:mt-12 text-center overflow-hidden"
            initial={{ opacity: 0 }}
            animate={phase >= 4 ? { opacity: 1 } : {}}
            transition={{ duration: 0.8 }}
          >
            <motion.p 
              className="text-lg md:text-2xl font-light tracking-[0.3em] text-white/60"
              initial={{ y: 30, opacity: 0 }}
              animate={phase >= 4 ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              RNSIT&apos;S GO-TO APP FOR SKILLS
            </motion.p>
            
            {/* Animated underline */}
            <motion.div 
              className="mt-4 h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent mx-auto"
              initial={{ width: 0 }}
              animate={phase >= 4 ? { width: "80%" } : {}}
              transition={{ duration: 1, delay: 0.5 }}
            />
          </motion.div>

          {/* Loading indicator */}
          <motion.div 
            className="absolute bottom-20 flex items-center space-x-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase >= 4 ? 1 : 0 }}
            transition={{ duration: 0.5 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-primary/60"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </motion.div>
        </div>

        {/* Vignette overlay */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
};

export default SplashScreen;
