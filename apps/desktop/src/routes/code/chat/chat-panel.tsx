import { NavLink, Outlet, useParams } from "react-router";
import { Loader2 } from "lucide-react";
import { useChat } from "./use-chat-panel";
import { TOOL_SCREENS } from "./screens/mock-screens";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ChatPanel() {
  const { streaming, wsStatus, round } = useChat();
  const { sessionId } = useParams<{ sessionId: string }>();
  const running = streaming !== null;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="bg-card border-b flex items-center gap-1 border-b px-2 py-1">
        {TOOL_SCREENS.map((tool) => {
          const to = tool.id === "code" ? `/apps/code/${sessionId}` : `/apps/code/${sessionId}/${tool.id}`;
          return (
            <NavLink
              key={tool.id}
              to={to}
              end={tool.id === "code"}
              className={({ isActive }) =>
                cn(
                  "text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
                  isActive && "bg-accent text-foreground font-medium",
                )
              }
            >
              <tool.icon size={13} aria-hidden="true" />
              {tool.label}
            </NavLink>
          );
        })}
        {running && (
          <Badge variant="secondary" className="ml-auto gap-1.5">
            <Loader2 size={11} className="animate-spin" aria-hidden="true" />
            working{round !== null ? ` · round ${round}` : ""}
          </Badge>
        )}
        <Badge variant={wsStatus === "open" ? "success" : "secondary"} className={running ? "" : "ml-auto"} title={`Chat socket: ${wsStatus}`}>
          {wsStatus === "open" ? "live" : wsStatus}
        </Badge>
      </div>

      <Outlet />
    </div>
  );
}
