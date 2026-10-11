import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../utils/cn';
import { ContourArt } from '../ContourArt';

interface Stop {
  x: number; // percent of width
  y: number; // percent of height
  time: string;
  label: string;
  align: 'start' | 'center' | 'end';
}

const STOPS: Stop[] = [
  { x: 10, y: 84, time: '0 min', label: 'Step outside', align: 'start' },
  { x: 42, y: 63, time: '8 min', label: 'Sit on a bench', align: 'center' },
  { x: 72, y: 53, time: '18 min', label: 'Count three birds', align: 'center' },
  { x: 93, y: 20, time: '30 min', label: 'Head home, unhurried', align: 'end' },
];

const TRAIL = 'M40 252 C 90 214, 120 236, 168 189 S 250 150, 288 159 S 340 100, 372 60';

const ALIGN: Record<Stop['align'], string> = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
};

/** Hero illustration: one sample 30-minute loop drawn on an original contour map. */
export function TrailMap() {
  const reduceMotion = useReducedMotion();

  return (
    <figure className="m-0">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] shadow-lift">
        <ContourArt seed={7} tone="forest" rings={13} className="absolute inset-0 h-full w-full">
          <path d={TRAIL} fill="none" stroke="#FBF7EE" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
          <motion.path
            d={TRAIL}
            fill="none"
            stroke="#F4B27A"
            strokeWidth="3.5"
            strokeLinecap="round"
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.8, ease: 'easeInOut', delay: 0.3 }}
          />
        </ContourArt>
        {STOPS.map((stop, index) => (
          <div
            key={stop.label}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${stop.x}%`, top: `${stop.y}%` }}
          >
            <motion.div
              className="relative"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay: 0.5 + index * 0.4 }}
            >
              <span className="block h-3.5 w-3.5 rounded-full border-2 border-cream-50 bg-ember-500" />
              <span
                className={cn(
                  'absolute bottom-full mb-2 whitespace-nowrap rounded-lg bg-cream-50 px-2.5 py-1 text-xs font-medium text-forest-900 shadow-card',
                  ALIGN[stop.align],
                )}
              >
                <span className="text-forest-600">{stop.time}</span> {stop.label}
              </span>
            </motion.div>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 text-sm text-forest-600">
        An example 30-minute loop, drawn for illustration. Not a real route.
      </figcaption>
    </figure>
  );
}
