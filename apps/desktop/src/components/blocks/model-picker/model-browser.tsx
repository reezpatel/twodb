import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ModelBrowser(props: ComponentProps<typeof Dialog>) {
  return <Dialog {...props} />;
}

export function ModelBrowserContent({ className, children, ...props }: ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      data-slot="model-browser-content"
      className={cn("flex h-[min(40rem,85vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl", className)}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

type ModelBrowserHeaderProps = {
  title: string;
  description?: string;
  className?: string;
};

export function ModelBrowserHeader({ title, description, className }: ModelBrowserHeaderProps) {
  return (
    <DialogHeader data-slot="model-browser-header" className={cn("shrink-0 border-b px-5 py-4 pr-12", className)}>
      <DialogTitle>{title}</DialogTitle>
      {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
    </DialogHeader>
  );
}

export function ModelBrowserBody({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="model-browser-body" className={cn("flex min-h-0 flex-1 flex-col sm:flex-row", className)} {...props} />;
}

export function ModelBrowserMain({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="model-browser-main" className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)} {...props} />;
}
