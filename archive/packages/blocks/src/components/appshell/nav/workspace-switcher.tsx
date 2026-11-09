import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "../../../lib/utils";

export interface WorkspaceSwitcherProps {
  workspaces: string[];
  value: string;
  onChange?: (workspace: string) => void;
  plan?: string;
  onCreate?: () => void;
}

/** Workspace/team picker shown at the top of a NavSidebar. */
function WorkspaceSwitcher({ workspaces, value, onChange, plan = "Pro plan", onCreate }: WorkspaceSwitcherProps) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        <button
          type="button"
          data-slot="workspace-switcher-trigger"
          className={cn(
            "group flex w-full items-center justify-between gap-2 rounded-[8px] px-2 py-2 text-left outline-none transition-colors",
            "hover:bg-paper-grid",
            "focus-visible:outline-2 focus-visible:outline-ion-deep focus-visible:-outline-offset-2",
          )}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-outline bg-ink font-sans text-[13px] font-bold text-paper">
              {value.charAt(0).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-sans text-[13px] font-medium leading-none text-ink">{value}</span>
              <span className="mt-1 font-sans text-[11px] leading-none text-muted-foreground">{plan}</span>
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-ink" strokeWidth={1.5} />
        </button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={4}
          className={cn(
            "z-50 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-hidden rounded-[10px] border border-outline bg-popover p-1",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          {workspaces.map((workspace) => (
            <DropdownMenuPrimitive.Item
              key={workspace}
              onSelect={() => onChange?.(workspace)}
              className={cn(
                "cursor-pointer rounded-[6px] px-2.5 py-1.5 font-sans text-[13px] outline-none transition-colors",
                workspace === value ? "bg-paper-grid font-medium text-ink" : "text-muted-foreground hover:bg-paper-grid hover:text-ink",
              )}
            >
              {workspace}
            </DropdownMenuPrimitive.Item>
          ))}
          {onCreate ? (
            <>
              <DropdownMenuPrimitive.Separator className="my-1 h-px bg-outline/40" />
              <DropdownMenuPrimitive.Item
                onSelect={onCreate}
                className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-1.5 font-sans text-[13px] text-muted-foreground outline-none transition-colors hover:bg-paper-grid hover:text-ink"
              >
                <Plus className="size-3.5" strokeWidth={2} />
                Create workspace
              </DropdownMenuPrimitive.Item>
            </>
          ) : null}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

export { WorkspaceSwitcher };
