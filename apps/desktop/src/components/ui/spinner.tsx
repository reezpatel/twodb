import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Inline loading spinner; inherits the text color so `text-warning` etc. tint it. */
export function Spinner({ className, ...props }: ComponentProps<typeof Loader2>) {
  return <Loader2 role="status" aria-label="Loading" className={cn("size-4 animate-spin motion-reduce:animate-none", className)} {...props} />;
}
