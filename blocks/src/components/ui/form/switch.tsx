import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "../../../lib/utils";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-outline bg-paper transition-colors outline-none",
        "data-[state=checked]:bg-ink data-[state=checked]:border-ink",
        "focus-visible:outline-2 focus-visible:outline-ion-deep focus-visible:outline-offset-2",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-4 translate-x-0.5 rounded-full bg-ink transition-transform",
          "data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-paper",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
