import { AnimatePresence, motion } from "motion/react";

export interface RevokeActionProps {
  active: boolean;
  disabled?: boolean;
  onStart: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Dumb/presentational — "Revoke" that turns into an inline Cancel / Confirm pair. */
export function RevokeAction({ active, disabled, onStart, onCancel, onConfirm }: RevokeActionProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {active ? (
        <motion.span
          key="confirm"
          initial={{ opacity: 0, x: 4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 4 }}
          className="inline-flex h-7 items-center gap-1"
        >
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-7 items-center rounded-sm px-2 text-[11px] text-ink-muted hover:bg-stone"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onConfirm}
            className="inline-flex h-7 items-center rounded-sm bg-destructive px-2 text-[11px] font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            Confirm
          </button>
        </motion.span>
      ) : (
        <motion.button
          key="revoke"
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          exit={{ opacity: 0 }}
          disabled={disabled}
          onClick={onStart}
          className="inline-flex h-7 items-center rounded-sm px-2 text-[11px] font-medium text-ink-muted transition-opacity hover:bg-stone hover:text-ink group-hover:!opacity-100 focus:!opacity-100 disabled:opacity-40"
        >
          Revoke
        </motion.button>
      )}
    </AnimatePresence>
  );
}
