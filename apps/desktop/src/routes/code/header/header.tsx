import { Code2, MessageSquare, MoreVertical, Settings } from "lucide-react";
import type { CodeView } from "../use-code-scene";
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

export function Header({ view, onViewChange }: { view: CodeView; onViewChange: (view: CodeView) => void }) {
  return (
    <header className="bg-card border-b flex h-10 shrink-0 items-center gap-3 border-b px-3">
      <span className="text-sm font-semibold">Code</span>
      <ViewToggle view={view} onViewChange={onViewChange} />
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
  );
}
