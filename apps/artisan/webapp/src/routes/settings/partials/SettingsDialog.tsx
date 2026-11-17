import { Bot, Smartphone, ScrollText } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@twodb/blocks";
import { GlobalInstructionView } from "../GlobalInstructionView.js";
import { ChatAgentView } from "../ChatAgentView.js";
import { AppSettingsView } from "../AppSettingsView.js";
import { useSettingsNav, type SettingsTabId } from "../hooks/useSettingsNav.js";

const PAGES: Array<{ id: SettingsTabId; label: string; icon: typeof ScrollText }> = [
  { id: "instruction", label: "Global instruction", icon: ScrollText },
  { id: "chat", label: "Chat agent", icon: Bot },
  { id: "app", label: "App", icon: Smartphone },
];

/** Settings dialog: its own sidenav on the left, the selected page on the right. Add a page to PAGES + the switch below. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { tab, setTab } = useSettingsNav();
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex h-[min(680px,88vh)] w-[min(960px,96vw)] max-w-none gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">Workspace and app settings</DialogDescription>
        <nav aria-label="Settings" className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-outline/50 bg-card/50 p-3 sm:w-52">
          <p className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Settings</p>
          {PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-current={tab === p.id ? "page" : undefined}
              onClick={() => setTab(p.id)}
              className={`flex items-center gap-2 rounded-[8px] px-2.5 py-[7px] text-left font-sans text-[13px] font-light leading-none transition-colors ${tab === p.id ? "bg-stone text-ink" : "text-muted-foreground hover:bg-paper-grid hover:text-ink"}`}
            >
              <p.icon className="size-4 shrink-0" strokeWidth={1.5} />
              <span className="truncate">{p.label}</span>
            </button>
          ))}
        </nav>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          {tab === "instruction" ? <GlobalInstructionView /> : tab === "chat" ? <ChatAgentView /> : <AppSettingsView />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
