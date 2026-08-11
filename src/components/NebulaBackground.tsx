import { useEffect, useRef } from 'react';

const NebulaBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const orbs = container.querySelectorAll('.nebula-orb');
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      
      orbs.forEach((orb, index) => {
        const element = orb as HTMLElement;
        const speed = (index + 1) * 0.5;
        const offsetX = (x - 0.5) * 30 * speed;
        const offsetY = (y - 0.5) * 30 * speed;
        element.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div ref={containerRef} className="nebula-atmosphere">
      <div className="nebula-orb nebula-orb-1" />
      <div className="nebula-orb nebula-orb-2" />
      <div className="nebula-orb nebula-orb-3" />
      <div className="nebula-orb nebula-orb-4" />
      
      {/* Subtle particle layer */}
      <div className="absolute inset-0 opacity-30">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/40"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `floatSlow ${8 + Math.random() * 8}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default NebulaBackground;