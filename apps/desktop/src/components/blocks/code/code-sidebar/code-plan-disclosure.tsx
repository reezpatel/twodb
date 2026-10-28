import type { ComponentProps } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "./code-plan-motion";

type CodePlanDisclosureProps = Omit<ComponentProps<"div">, "onAnimationStart" | "onDragStart" | "onDrag" | "onDragEnd" | "style"> & {
  open: boolean;
};

export function CodePlanDisclosure({ open, children, ...props }: CodePlanDisclosureProps) {
  const reduce = useReducedMotion() ?? false;
  const duration = reduce ? 0 : 0.22;

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="content"
          data-slot="code-plan-disclosure"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration, ease: EASE_OUT }}
          className="overflow-hidden"
          {...props}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
