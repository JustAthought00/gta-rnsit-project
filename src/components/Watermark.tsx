import type { LucideIcon } from 'lucide-react';

interface WatermarkProps {
  icon: LucideIcon;
  className?: string;
  color?: 'primary' | 'accent' | 'secondary' | 'cyan' | 'violet' | 'pink';
  strokeWidth?: number;
}

const colorClasses: Record<NonNullable<WatermarkProps['color']>, string> = {
  primary: 'text-blue-600 dark:text-blue-400',
  accent: 'text-cyan-600 dark:text-cyan-300',
  secondary: 'text-slate-500 dark:text-slate-400',
  cyan: 'text-cyan-500 dark:text-cyan-400',
  violet: 'text-violet-500 dark:text-violet-400',
  pink: 'text-fuchsia-500 dark:text-fuchsia-400',
};

const Watermark = ({
  icon: Icon,
  className = '',
  color = 'primary',
  strokeWidth = 1,
}: WatermarkProps) => (
  <Icon
    aria-hidden="true"
    strokeWidth={strokeWidth}
    className={`pointer-events-none absolute select-none opacity-[0.12] dark:opacity-[0.07] drop-shadow-[0_0_10px_rgba(90,180,255,0.6)] dark:drop-shadow-[0_0_6px_rgba(90,180,255,0.25)] ${colorClasses[color]} ${className}`}
  />
);

export default Watermark;