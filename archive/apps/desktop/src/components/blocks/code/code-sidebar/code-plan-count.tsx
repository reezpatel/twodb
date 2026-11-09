import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SPRING_SWAP } from "./code-plan-motion";

type CodePlanCountProps = {
  /** Changing the value rolls the old text out and the new text in. */
  value: string;
  children: ReactNode;
};

export function CodePlanCount({ value, children }: CodePlanCountProps) {
  const reduce = useReducedMotion() ?? false;

  return (
    <span data-slot="code-plan-count" className="relative inline-flex overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={reduce ? { opacity: 1 } : { y: "70%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: "-70%", opacity: 0 }}
          transition={reduce ? { duration: 0 } : SPRING_SWAP}
          className="inline-block"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
