import { AnimatePresence, motion } from "motion/react";
import { Check, Copy } from "lucide-react";

/** Dumb/presentational — copies a space id; swaps to a check + "Copied" briefly. */
export function CopyIdButton({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="Copy space id"
      className="inline-flex h-7 items-center gap-1.5 rounded-sm px-2 text-[11px] font-medium text-ink-muted opacity-70 transition-opacity hover:bg-stone hover:text-ink group-hover:!opacity-100 focus:!opacity-100"
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
      <span>{copied ? "Copied" : "Copy ID"}</span>
    </button>
  );
}
