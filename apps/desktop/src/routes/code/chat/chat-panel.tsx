import { NavLink, useLocation, useNavigate, useParams } from "react-router";
import { Loader2, PanelRight } from "lucide-react";
import { useChat } from "./use-chat-panel";
import { ChatConversationInner } from "./chat-conversation";
import { AwsChip } from "./aws-chip";
import { TOOL_SCREENS } from "./screens/mock-screens";
import { useCode } from "../code-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ChatPanel() {
  const { streaming, wsStatus, round } = useChat();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { rightBarVisible, toggleRightBar } = useCode();
  const navigate = useNavigate();
  const location = useLocation();
  const running = streaming !== null;
  const activePanel = location.pathname.split("/")[4] ?? null;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="bg-card border-b flex items-center gap-1 border-b px-2 py-1">
        {TOOL_SCREENS.map((tool) => {
          const to = tool.id === "code" ? `/apps/code/${sessionId}` : `/apps/code/${sessionId}/${tool.id}`;
          const isActive = tool.id === "code" ? !activePanel : activePanel === tool.id;
          return (
            <NavLink
              key={tool.id}
              to={to}
              end={tool.id === "code"}
              // Clicking the active panel tab closes it — back to default sections.
              onClick={() => {
                if (tool.id !== "code" && isActive) {
                  navigate(`/apps/code/${sessionId}`, { replace: true });
                }
              }}
              className={() =>
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
        {sessionId && <AwsChip sessionId={sessionId} />}
        {running && (
          <Badge variant="secondary" className="ml-auto gap-1.5">
            <Loader2 size={11} className="animate-spin" aria-hidden="true" />
            working{round !== null ? ` · round ${round}` : ""}
          </Badge>
        )}
        <Badge variant={wsStatus === "open" ? "success" : "secondary"} className={running ? "" : "ml-auto"} title={`Chat socket: ${wsStatus}`}>
          {wsStatus === "open" ? "live" : wsStatus}
        </Badge>
        <button
          aria-label={rightBarVisible ? "Hide right panel" : "Show right panel"}
          title={rightBarVisible ? "Hide right panel" : "Show right panel"}
          onClick={toggleRightBar}
          className={cn(
            "text-muted-foreground hover:bg-accent hover:text-foreground ml-1 flex h-6 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
            rightBarVisible && "bg-accent text-foreground",
          )}
        >
          <PanelRight size={13} />
        </button>
      </div>

      {/* The conversation always owns the main column — panel screens render in
          the right bar instead (see CodeScene), so the chat never unmounts. */}
      {sessionId ? <ChatConversationInner sessionId={sessionId} /> : null}
    </div>
  );
}