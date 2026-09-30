import { useEffect, type RefCallback } from "react";
import { ArrowLeftRight, LogOut, X } from "lucide-react";
import { APPS, SETTINGS_APP } from "../lib/apps";
import { cn } from "@/lib/utils";
import { Blobatar } from "@/components/ui/blobatar";
import { NavRail } from "./nav-rail";
import { SideNavGroup, SideNavItem } from "./side-nav";

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  hasSideNav: boolean;
  userName?: string;
  userEmail?: string;
  userImage?: string | null;
  onSwitchOrg: () => void;
  onSignOut: () => void;
  sideNavRef: RefCallback<HTMLElement>;
}

export function MobileNavDrawer({ open, onClose, hasSideNav, userName, userEmail, userImage, onSwitchOrg, onSignOut, sideNavRef }: MobileNavDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <div className={cn("fixed inset-0 z-50", !open && "pointer-events-none")} aria-hidden={!open}>
      <div onClick={onClose} className={cn("absolute inset-0 bg-black/50 transition-opacity duration-200", open ? "opacity-100" : "opacity-0")} />
      <div
        className={cn(
          "bg-background absolute inset-y-0 left-0 flex w-[284px] flex-col border-r shadow-xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex shrink-0 items-center gap-2 border-b p-3">
          <Blobatar name={userName ?? userEmail ?? "twodb"} src={userImage ?? undefined} blobatar={{ title: userName ?? "Account" }} />
          <div className="flex min-w-0 flex-1 flex-col">
            <strong className="truncate text-sm font-semibold">{userName ?? "Account"}</strong>
            <span className="text-muted-foreground truncate text-xs">{userEmail}</span>
          </div>
          <button
            aria-label="Close menu"
            onClick={onClose}
            className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring flex h-8 w-8 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <NavRail userName={userName} userEmail={userEmail} userImage={userImage} onSwitchOrg={onSwitchOrg} onSignOut={onSignOut} />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div ref={sideNavRef} />
            {!hasSideNav && (
              <SideNavGroup label="Apps">
                {APPS.map((app) => (
                  <SideNavItem key={app.id} to={`/apps/${app.id}`} label={app.label} icon={app.icon} />
                ))}
                <SideNavItem to={`/apps/${SETTINGS_APP.id}`} label={SETTINGS_APP.label} icon={SETTINGS_APP.icon} />
              </SideNavGroup>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-0.5 border-t p-3">
          <SideNavItem label="Switch organization" icon={ArrowLeftRight} onSelect={onSwitchOrg} />
          <SideNavItem to={`/apps/${SETTINGS_APP.id}`} label={SETTINGS_APP.label} icon={SETTINGS_APP.icon} />
          <SideNavItem label="Sign out" icon={LogOut} onSelect={onSignOut} />
        </div>
      </div>
    </div>
  );
}
