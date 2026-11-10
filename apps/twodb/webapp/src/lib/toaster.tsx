"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Sonner toaster themed with blocks' B+W tokens (mirrors shadcn's sonner
 * wrapper, minus next-themes — this app has no theme switcher yet).
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-paper group-[.toaster]:text-ink group-[.toaster]:border-outline group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-ink-muted",
          actionButton: "group-[.toast]:bg-ink group-[.toast]:text-paper",
          cancelButton: "group-[.toast]:bg-stone group-[.toast]:text-ink-muted",
        },
      }}
      {...props}
    />
  );
}
