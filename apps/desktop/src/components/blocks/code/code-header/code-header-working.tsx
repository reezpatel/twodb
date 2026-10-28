import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type CodeHeaderWorkingProps = Omit<ComponentProps<typeof Badge>, "children" | "variant"> & {
  label: string;
};

export function CodeHeaderWorking({ label, ...props }: CodeHeaderWorkingProps) {
  return (
    <Badge data-slot="code-header-working" variant="secondary" {...props}>
      <Loader2 className="animate-spin" aria-hidden="true" />
      {label}
    </Badge>
  );
}
