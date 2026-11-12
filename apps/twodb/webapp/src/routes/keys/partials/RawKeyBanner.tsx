import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Copy, Eye, EyeOff, KeyRound, X } from "lucide-react";

export interface RawKeyBannerProps {
  rawKey: string | null;
  visible: boolean;
  copied: boolean;
  onToggleVisible: () => void;
  onCopy: () => void;
  onDismiss: () => void;
}

const mask = (k: string) => `${k.slice(0, 8)}${"•".repeat(16)}${k.slice(-4)}`;

/** Dumb/presentational — the one-time secret shown right after creation, with reveal + copy. */
export function RawKeyBanner({ rawKey, visible, copied, onToggleVisible, onCopy, onDismiss }: RawKeyBannerProps) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {rawKey ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, height: 0, y: -4 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
          className="mb-4 overflow-hidden"
        >
          <div className="rounded-xl border border-outline bg-stone p-3.5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-outline bg-paper text-ink-muted">
                <KeyRound className="size-3.5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold text-ink">Copy your secret key now</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-muted">You won’t be able to see it again.</p>
                  </div>
                  <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dismiss secret key"
                    className="grid size-6 shrink-0 place-items-center rounded-sm text-ink-muted hover:bg-paper-grid hover:text-ink"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-outline bg-paper p-1.5 pl-2.5">
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.code
                        key={visible ? "visible" : "hidden"}
                        initial={reduce ? false : { opacity: 0, filter: "blur(4px)", y: 2 }}
                        animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)", y: -2 }}
                        transition={{ duration: 0.14 }}
                        className="block truncate font-mono text-[11.5px] text-ink"
                      >
                        {visible ? rawKey : mask(rawKey)}
                      </motion.code>
                    </AnimatePresence>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleVisible}
                    aria-label={visible ? "Hide secret key" : "Reveal secret key"}
                    className="grid size-8 place-items-center rounded-sm text-ink-muted hover:bg-stone hover:text-ink"
                  >
                    {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={onCopy}
                    aria-label="Copy secret key"
                    className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-outline bg-paper px-2.5 text-[11px] font-medium text-ink-muted hover:bg-stone hover:text-ink"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={copied ? "check" : "copy"}
                        initial={{ opacity: 0, scale: 0.7, rotate: -12 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.7, rotate: 12 }}
                        transition={{ duration: 0.13 }}
                      >
                        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      </motion.span>
                    </AnimatePresence>
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
