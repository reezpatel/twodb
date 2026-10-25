import type { ComponentProps } from "react";
import { Blobatar } from "@/components/ui/blobatar";
import { cn } from "@/lib/utils";
import "blobatar/motion.css";

type NavRailUserProps = ComponentProps<"button"> & {
  name?: string;
  email?: string;
  image?: string | null;
};

export function NavRailUser({ name, email, image, className, type = "button", ...props }: NavRailUserProps) {
  return (
    <button
      type={type}
      aria-label="Account menu"
      className={cn(
        "focus-visible:ring-ring focus-visible:ring-offset-card shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    >
      <Blobatar
        size="default"
        name={name ?? email ?? "twodb"}
        src={image ?? undefined}
        className="transition-opacity hover:opacity-90"
        blobatar={{ animate: "hover", title: name ?? "Account" }}
      />
    </button>
  );
}
