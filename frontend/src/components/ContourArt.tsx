import { useMemo, type ReactNode } from 'react';
import type { ChipTone } from '../data/options';

const TONES: Record<ChipTone, { bg: string; line: string; opacity: number }> = {
  forest: { bg: '#1B3A29', line: '#8FB097', opacity: 0.38 },
  sage: { bg: '#E1EAD8', line: '#6F8B5C', opacity: 0.45 },
  ember: { bg: '#FCE8D4', line: '#C45F14', opacity: 0.35 },
  cream: { bg: '#F2EBD9', line: '#7C9769', opacity: 0.45 },
};

function contourPath(cx: number, cy: number, r: number, seed: number): string {
  const steps = 56;
  let d = '';
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const wobble =
      1 + 0.18 * Math.sin(angle * 2 + seed) + 0.1 * Math.sin(angle * 3 + seed * 1.9) + 0.05 * Math.sin(angle * 5 + seed * 0.7);
    const x = cx + r * wobble * Math.cos(angle) * 1.35;
    const y = cy + r * wobble * Math.sin(angle);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return `${d}Z`;
}

interface ContourArtProps {
  seed?: number;
  tone?: ChipTone;
  rings?: number;
  className?: string;
  /** SVG elements drawn on top of the contour lines (viewBox is 400 x 300). */
  children?: ReactNode;
}

/** Original topographic-map illustration. Purely decorative. */
export function ContourArt({ seed = 1, tone = 'sage', rings = 10, className, children }: ContourArtProps) {
  const palette = TONES[tone];
  const paths = useMemo(() => {
    const cx = 120 + ((seed * 53) % 160);
    const cy = 90 + ((seed * 37) % 120);
    return Array.from({ length: rings }, (_, i) => contourPath(cx, cy, 14 + i * (150 / rings), seed + i * 0.15));
  }, [seed, rings]);

  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="400" height="300" fill={palette.bg} />
      <g fill="none" stroke={palette.line} strokeOpacity={palette.opacity} strokeWidth="1.2">
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {children}
    </svg>
  );
}
