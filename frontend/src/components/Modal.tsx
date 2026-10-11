import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../utils/cn';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'md' | 'lg';
  /** Block closing by Escape or backdrop while something is saving. */
  busy?: boolean;
}

/**
 * Accessible dialog: labelled, focus is trapped and restored, Escape closes, the page behind is inert and does not scroll.
 * On small screens it slides up as a bottom sheet.
 */
export function Modal({ open, onClose, title, description, children, size = 'md', busy = false }: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = panel.querySelector<HTMLElement>('[data-autofocus]') ?? panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
      target.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busyRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      root?.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-forest-950/60"
            aria-hidden="true"
            onClick={() => {
              if (!busy) onClose();
            }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            className={cn(
              'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-cream-50 shadow-lift outline-none sm:rounded-3xl',
              size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
            )}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-forest-800/10 px-6 pb-4 pt-6">
              <div>
                <h2 id={titleId} className="text-2xl font-medium">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1 text-forest-700">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-forest-800 hover:bg-forest-800/10 disabled:opacity-50"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
