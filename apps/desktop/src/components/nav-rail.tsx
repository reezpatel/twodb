import { NavLink } from "react-router";
import { APPS, SETTINGS_APP, type AppEntry } from "../lib/apps";
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
  orgName?: string;
  onSwitchOrg: () => void;
  onSignOut: () => void;
}

function RailButton({ app }: { app: AppEntry }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={`/apps/${app.id}`}
          className={({ isActive }) =>
            `hover:bg-accent text-muted-foreground hover:text-foreground flex h-10 w-10 items-center justify-center rounded-md transition-colors ${isActive ? "bg-accent text-foreground" : ""}`
          }
        >
          <app.icon size={20} />
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right">{app.label}</TooltipContent>
    </Tooltip>
  );
}

export function NavRail({ userName, userEmail, orgName, onSwitchOrg, onSignOut }: NavRailProps) {
  return (
    <nav className="bg-card border-r flex w-14 flex-col items-center gap-1 border-r py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
            title={userName ?? "Account"}
          >
            {userName?.charAt(0).toUpperCase()}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-56">
          <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">{userEmail}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSwitchOrg}>{orgName ?? "Switch organization"}</DropdownMenuItem>
          <DropdownMenuItem onClick={onSignOut}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="my-1" />
      {APPS.map((app) => (
        <RailButton key={app.id} app={app} />
      ))}
      <div className="flex-1" />
      <RailButton app={SETTINGS_APP} />
    </nav>
  );
}
