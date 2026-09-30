import * as React from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Plus, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Workspace {
  id: string;
  name: string;
  slug?: string;
}

export interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  onCreate?: (name: string) => void;
  maxVisible?: number;
  label?: string;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface WorkspaceAvatarProps {
  workspace: Workspace;
  isActive: boolean;
  onClick: () => void;
}

function WorkspaceAvatar({ workspace, isActive, onClick }: WorkspaceAvatarProps) {
  return (
    <motion.button
      layoutId={`workspace-${workspace.id}`}
      onClick={onClick}
      className="group relative flex cursor-pointer flex-col items-center gap-1.5 outline-none"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div
        className={cn(
          "relative h-12 w-12 overflow-hidden rounded-full transition-all duration-200",
          "group-focus-visible:ring-ring group-focus-visible:ring-2 group-focus-visible:ring-offset-2",
          !isActive && "opacity-50 hover:opacity-75",
        )}
      >
        <div
          className={cn(
            "flex h-full w-full items-center justify-center text-sm font-medium transition-colors duration-200",
            isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {getInitials(workspace.name)}
        </div>
      </div>

      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="bg-primary absolute right-0 bottom-5 flex h-4 w-4 items-center justify-center rounded-full shadow-sm"
          >
            <Check className="text-primary-foreground h-2.5 w-2.5" strokeWidth={3} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.span
        layoutId={`workspace-name-${workspace.id}`}
        className={cn("max-w-[60px] truncate text-xs font-medium transition-colors duration-200", isActive ? "text-foreground" : "text-muted-foreground")}
      >
        {workspace.name.split(" ")[0]}
      </motion.span>
    </motion.button>
  );
}

interface AddButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

function AddButton({ onClick, isOpen }: AddButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      className="group flex cursor-pointer flex-col items-center gap-1.5 outline-none"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed transition-all duration-200",
          "group-focus-visible:ring-ring group-focus-visible:ring-2 group-focus-visible:ring-offset-2",
          isOpen ? "border-primary bg-primary/10" : "border-muted-foreground/40 hover:border-muted-foreground/60 hover:bg-muted/50",
        )}
      >
        <motion.div animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
          <Plus className={cn("h-5 w-5 transition-colors duration-200", isOpen ? "text-primary" : "text-muted-foreground")} />
        </motion.div>
      </div>
      <span className={cn("text-xs font-medium transition-colors duration-200", isOpen ? "text-primary" : "text-muted-foreground")}>All</span>
    </motion.button>
  );
}

interface DropdownProps {
  workspaces: Workspace[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  onCreate?: (name: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

function Dropdown({ workspaces, activeId, onSelect, onCreate, searchQuery, onSearchChange }: DropdownProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredWorkspaces = React.useMemo(() => {
    const query = searchQuery.toLowerCase();
    return workspaces
      .filter((w) => w.name.toLowerCase().includes(query) || w.slug?.toLowerCase().includes(query))
      .sort((a, b) => {
        if (a.id === activeId) return -1;
        if (b.id === activeId) return 1;
        return 0;
      });
  }, [workspaces, activeId, searchQuery]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="bg-popover border-border absolute top-full right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border shadow-lg"
    >
      <div className="border-border border-b p-3">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search workspaces..."
            className="bg-muted/50 focus:border-primary/50 focus:bg-background placeholder:text-muted-foreground w-full rounded-lg border border-transparent py-2 pr-3 pl-9 text-sm transition-colors outline-none"
          />
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
        <AnimatePresence mode="popLayout">
          {filteredWorkspaces.map((workspace, index) => {
            const isActive = workspace.id === activeId;
            return (
              <motion.button
                key={workspace.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: index * 0.02, duration: 0.15 }}
                onClick={() => onSelect(workspace.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors",
                  isActive ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50",
                )}
              >
                <div className={cn("h-9 w-9 flex-shrink-0 overflow-hidden rounded-full transition-all duration-200", !isActive && "opacity-60")}>
                  <div
                    className={cn(
                      "flex h-full w-full items-center justify-center text-xs font-medium",
                      isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {getInitials(workspace.name)}
                  </div>
                </div>

                <div className="min-w-0 flex-1 text-left">
                  <div className={cn("truncate text-sm font-medium transition-colors", isActive ? "text-foreground" : "text-foreground/80")}>
                    {workspace.name}
                  </div>
                  {workspace.slug && <div className="text-muted-foreground truncate text-xs">{workspace.slug}</div>}
                </div>

                <div
                  className={cn(
                    "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200",
                    isActive ? "bg-primary" : "border-muted-foreground/30 border-2",
                  )}
                >
                  {isActive && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}>
                      <Check className="text-primary-foreground h-3 w-3" strokeWidth={3} />
                    </motion.div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>

        {filteredWorkspaces.length === 0 &&
          (onCreate && searchQuery.trim() ? (
            <button
              onClick={() => onCreate(searchQuery.trim())}
              className="hover:bg-muted/50 flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors"
            >
              <div className="border-muted-foreground/40 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 border-dashed">
                <Plus className="text-muted-foreground h-4 w-4" />
              </div>
              <span className="text-foreground truncate text-sm font-medium">Create &quot;{searchQuery.trim()}&quot;</span>
            </button>
          ) : (
            <div className="text-muted-foreground px-3 py-8 text-center text-sm">No workspaces found</div>
          ))}
      </div>
    </motion.div>
  );
}

const WorkspaceSelector = React.forwardRef<HTMLDivElement, WorkspaceSelectorProps>(
  ({ workspaces, activeId, onSelect, onCreate, maxVisible = 5, label, className }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          setSearchQuery("");
        }
      }

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const sortedWorkspaces = React.useMemo(() => {
      return [...workspaces].sort((a, b) => {
        if (a.id === activeId) return -1;
        if (b.id === activeId) return 1;
        return 0;
      });
    }, [workspaces, activeId]);

    const visibleWorkspaces = sortedWorkspaces.slice(0, maxVisible);

    const handleSelect = (id: string) => {
      setIsOpen(false);
      setSearchQuery("");
      onSelect(id);
    };

    const handleCreate = (name: string) => {
      setIsOpen(false);
      setSearchQuery("");
      onCreate?.(name);
    };

    return (
      <div ref={ref} className={cn("relative", className)}>
        {label && <div className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">{label}</div>}
        <div ref={containerRef} className="flex flex-wrap items-start gap-4">
          <LayoutGroup>
            {visibleWorkspaces.map((workspace) => (
              <WorkspaceAvatar key={workspace.id} workspace={workspace} isActive={workspace.id === activeId} onClick={() => onSelect(workspace.id)} />
            ))}

            <div className="relative">
              <AddButton isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />

              <AnimatePresence>
                {isOpen && (
                  <Dropdown
                    workspaces={workspaces}
                    activeId={activeId}
                    onSelect={handleSelect}
                    onCreate={onCreate ? handleCreate : undefined}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                  />
                )}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        </div>
      </div>
    );
  },
);

WorkspaceSelector.displayName = "WorkspaceSelector";

export { WorkspaceSelector };
