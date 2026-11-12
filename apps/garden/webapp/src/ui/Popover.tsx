import { Popover as P } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@twodb/blocks";

/** Radix popover themed with blocks tokens (floating surfaces get a soft shadow — the only shadow in the theme). */
export function Popover(props: {
  trigger?: ReactNode;
  anchor?: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  sideOffset?: number;
  modal?: boolean;
}) {
  return (
    <P.Root open={props.open} onOpenChange={props.onOpenChange} modal={props.modal}>
      {props.trigger ? <P.Trigger asChild>{props.trigger}</P.Trigger> : null}
      {props.anchor ? <P.Anchor asChild>{props.anchor}</P.Anchor> : null}
      <P.Portal>
        <P.Content
          align={props.align ?? "start"}
          side={props.side ?? "bottom"}
          sideOffset={props.sideOffset ?? 6}
          collisionPadding={10}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn("garden-float z-50 rounded-[10px] border border-outline bg-popover text-ink outline-none", props.className)}
        >
          {props.children}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
