import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1600&auto=format&fit=crop";

interface SignInLayoutProps {
  image?: string;
  imageAlt?: string;
  className?: string;
  children: ReactNode;
}

export function SignInLayout({ image = DEFAULT_IMAGE, imageAlt = "", className, children }: SignInLayoutProps) {
  return (
    <div className="bg-background flex min-h-screen">
      <div className="relative hidden flex-1 overflow-hidden lg:block">
        <img src={image} alt={imageAlt} className="absolute inset-0 h-full w-full object-cover" />
        <div className="from-background/80 via-background/20 absolute inset-0 bg-gradient-to-t to-transparent" />
      </div>
      <div className={cn("flex flex-1 items-center justify-center p-6 sm:p-10", className)}>
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
