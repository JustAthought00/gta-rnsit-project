import type { LucideIcon } from 'lucide-react';

interface WatermarkProps {
  icon: LucideIcon;
  className?: string;
  color?: 'primary' | 'accent' | 'secondary' | 'cyan' | 'violet' | 'pink';
  strokeWidth?: number;
}

const Watermark = ({
  icon: Icon,
  className = '',
  color = 'primary',
  strokeWidth = 1,
}: WatermarkProps) => (
  <Icon
    aria-hidden="true"
    strokeWidth={strokeWidth}
    className={`pointer-events-none absolute select-none text-blue-600 dark:text-sky-400 opacity-[0.12] dark:opacity-[0.07] drop-shadow-[0_0_10px_rgba(90,180,255,0.6)] dark:drop-shadow-[0_0_6px_rgba(90,180,255,0.25)] ${className}`}
  />
);

export default Watermark;