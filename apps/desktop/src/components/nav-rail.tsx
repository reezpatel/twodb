import { NavLink, useMatch } from "react-router";
import { ArrowLeftRight, LogOut } from "lucide-react";
import { APPS, SETTINGS_APP, type AppEntry } from "../lib/apps";
import { cn } from "@/lib/utils";
import { useMobileNav } from "./mobile-nav-context";
import { Blobatar } from "@/components/ui/blobatar";
import "blobatar/motion.css";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavRailProps {
  userName?: string;
  userEmail?: string;
  userImage?: string | null;
  onSwitchOrg: () => void;
  onSignOut: () => void;
}

function RailButton({ app }: { app: AppEntry }) {
  const isActive = useMatch(`/apps/${app.id}`);
  const { isMobile, closeNav } = useMobileNav();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={`/apps/${app.id}`}
          aria-label={app.label}
          onClick={() => {
            if (isMobile) closeNav();
          }}
          className={cn(
            "text-muted-foreground relative flex h-8 w-8 items-center justify-center rounded-md transition-colors outline-none",
            "hover:bg-accent hover:text-foreground focus-visible:ring-ring focus-visible:ring-2",
            isActive &&
              "bg-primary/15 text-primary before:bg-primary before:absolute before:top-1/2 before:-left-1.5 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:content-['']",
          )}
        >
          <app.icon size={16} />
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {app.label}
      </TooltipContent>
    </Tooltip>
  );
}

export function NavRail({ userName, userEmail, userImage, onSwitchOrg, onSignOut }: NavRailProps) {
  const { isMobile } = useMobileNav();

  return (
    <nav aria-label="Applications" className="bg-card flex w-11 flex-col items-center gap-1 border-r py-2">
      {!isMobile && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Account menu"
                className="focus-visible:ring-ring focus-visible:ring-offset-card rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <Blobatar
                  size="default"
                  name={userName ?? userEmail ?? "twodb"}
                  src={userImage ?? undefined}
                  className="transition-opacity hover:opacity-90"
                  blobatar={{ animate: "hover", title: userName ?? "Account" }}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-sm font-medium">{userName ?? "Account"}</span>
                <span className="text-muted-foreground text-xs font-normal">{userEmail}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSwitchOrg}>
                <ArrowLeftRight />
                Switch organization
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSignOut}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator className="my-1 w-5" />
        </>
      )}
      {APPS.map((app) => (
        <RailButton key={app.id} app={app} />
      ))}
      <div className="flex-1" />
      {!isMobile && <RailButton app={SETTINGS_APP} />}
    </nav>
  );
}
