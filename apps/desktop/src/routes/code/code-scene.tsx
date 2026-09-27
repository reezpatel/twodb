import { Code2, MessageSquare, MoreVertical, Settings } from "lucide-react";
import { ChatPanel } from "./chat-panel";
import { Sidenav } from "./sidenav";
import { Sidebar } from "./sidebar";
import { useChatPanel } from "./use-chat-panel";
import { useCodeScene, type CodeView } from "./use-code-scene";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function ViewToggle({ view, onViewChange }: { view: CodeView; onViewChange: (view: CodeView) => void }) {
  const items = [
    { id: "code" as const, label: "Code", icon: Code2 },
    { id: "chat" as const, label: "Chat", icon: MessageSquare },
  ];
  return (
    <div className="bg-muted inline-flex rounded-lg border p-0.5">
      {items.map((item) => (
        <button
          key={item.id}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors",
            view === item.id ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onViewChange(item.id)}
        >
          <item.icon size={13} aria-hidden="true" />
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function CodeScene() {
  const { selectedSessionId, selectSession, view, setView } = useCodeScene();
  const chat = useChatPanel(selectedSessionId);

  return (
    <div className="flex h-full flex-col">
      <header className="bg-card border-b flex h-10 shrink-0 items-center gap-3 border-b px-3">
        <span className="text-sm font-semibold">Code</span>
        <ViewToggle view={view} onViewChange={setView} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="ml-auto">
              <MoreVertical size={15} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled>
              <Code2 size={13} /> Open in editor
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Settings size={13} /> Agent settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidenav selectedId={selectedSessionId} onSelect={selectSession} activeStreaming={chat.streaming !== null} />
        <div className="flex min-w-0 flex-1 flex-col">{view === "chat" ? <ChatPanel sessionId={selectedSessionId} chat={chat} /> : <MockEditor />}</div>
        <Sidebar />
      </div>
    </div>
  );
}

function MockEditor() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Code2 size={28} className="text-muted-foreground/50" aria-hidden="true" />
        <p className="text-muted-foreground text-sm font-medium">Editor</p>
        <p className="text-muted-foreground/70 max-w-xs text-center text-xs">The code view lands with the agent file-editing tools. Chat is fully live.</p>
      </div>
    </div>
  );
}
