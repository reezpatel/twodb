import { AlertTriangle, CalendarClock, Clock, FileText, FlaskConical, Plus, Receipt, Syringe } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { BriefTask } from "./use-overview-scene";
import { useOverviewScene } from "./use-overview-scene";

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const CUE = "text-muted-foreground/70 text-[11px] font-semibold tracking-wider uppercase";

function Stack({ cue, action, footer, children }: { cue: string; action?: ReactNode; footer: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1">
        <span className={CUE}>{cue}</span>
        {action}
      </div>
      <div className="bg-card overflow-hidden rounded-xl border">
        {children}
        <div className="bg-muted/40 flex items-center justify-between px-4 py-2">{footer}</div>
      </div>
    </section>
  );
}

function TimePill({ children }: { children: ReactNode }) {
  return (
    <span className="bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
      <Clock size={12} className="opacity-70" />
      {children}
    </span>
  );
}

function IconTile({ children, rose }: { children: ReactNode; rose?: boolean }) {
  return (
    <span className={cn("grid size-7.5 shrink-0 place-items-center rounded-md", rose ? "bg-rose-400/15 text-rose-300" : "bg-muted text-muted-foreground")}>
      {children}
    </span>
  );
}

function TaskRow({ task, onToggle, onSnooze }: { task: BriefTask; onToggle: (id: string, done: boolean) => void; onSnooze: (id: string) => void }) {
  return (
    <div className="group hover:bg-accent/40 flex items-center gap-3 border-b px-4 py-3 transition-colors last:border-b-0">
      <Checkbox checked={Boolean(task.done)} onCheckedChange={(checked) => onToggle(task.id, checked === true)} aria-label={task.title} />
      <span className={cn("flex-1 text-sm font-medium", task.done && "text-muted-foreground/60 line-through")}>{task.title}</span>
      {task.done ? null : (
        <span className="flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="xs" onClick={() => onSnooze(task.id)}>
            Snooze
          </Button>
          <Button size="xs" onClick={() => onToggle(task.id, true)}>
            Complete
          </Button>
        </span>
      )}
    </div>
  );
}

function TaskGroup({
  label,
  tasks,
  onToggle,
  onSnooze,
}: {
  label: string;
  tasks: BriefTask[];
  onToggle: (id: string, done: boolean) => void;
  onSnooze: (id: string) => void;
}) {
  const open = tasks.filter((t) => !t.done).length;
  return (
    <>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} onToggle={onToggle} onSnooze={onSnooze} />
      ))}
      <div className="bg-muted/40 flex items-center justify-between px-4 py-2">
        <span className={CUE}>{label}</span>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">{open}</span>
      </div>
    </>
  );
}

export function OverviewScene() {
  const brief = useOverviewScene();

  return (
    <div className="bg-background h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="m-0 text-xl font-semibold tracking-wide">August 8th, 2026.</h2>
            <p className="text-muted-foreground mt-1.5 mb-0 text-sm">Drafted 06:30 from overnight data · reviewed by Asha</p>
          </div>
          <span className="text-muted-foreground pt-0.5 text-base">Today</span>
        </header>

        <Stack
          cue="Appointments"
          footer={
            <>
              <span className={CUE}>Two need preparation</span>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">{brief.appointments.length}</span>
            </>
          }
        >
          {brief.appointments.map((a) => (
            <div key={a.name} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
              <Avatar size="sm">
                <AvatarFallback className="text-[9px]">{initials(a.name)}</AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{a.name}</span>
                <span className="text-muted-foreground truncate text-xs">{a.reason}</span>
              </span>
              {a.prep ? <Badge variant="warning">{a.prep}</Badge> : null}
              <TimePill>{a.time}</TimePill>
            </div>
          ))}
        </Stack>

        <Stack
          cue="Tasks"
          action={
            <Button variant="ghost" size="xs">
              <Plus size={13} /> New task
            </Button>
          }
          footer={
            <>
              <span className={CUE}>Front desk</span>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">{brief.frontDesk.filter((t) => !t.done).length}</span>
            </>
          }
        >
          <TaskGroup
            label="Front desk"
            tasks={brief.frontDesk}
            onToggle={(id, done) => brief.toggle(brief.setFrontDesk, id, done)}
            onSnooze={(id) => brief.snooze(brief.setFrontDesk, id)}
          />
          <div className="border-t" />
          <TaskGroup
            label="Lab"
            tasks={brief.lab}
            onToggle={(id, done) => brief.toggle(brief.setLab, id, done)}
            onSnooze={(id) => brief.snooze(brief.setLab, id)}
          />
        </Stack>

        <Stack
          cue="Reports back overnight"
          footer={
            <>
              <span className={CUE}>Attached to the right charts</span>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">3</span>
            </>
          }
        >
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <IconTile>
              <FlaskConical size={15} />
            </IconTile>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">Lipid panel — Meera Iyer</span>
              <span className="text-muted-foreground truncate text-xs">Received 02:14 · within range</span>
            </span>
            <Badge variant="success">Reviewed</Badge>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <IconTile>
              <FileText size={15} />
            </IconTile>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">X-ray report — Arjun Nair</span>
              <span className="text-muted-foreground truncate text-xs">Received 04:40 · one flag</span>
            </span>
            <Badge variant="destructive">Flagged</Badge>
          </div>
        </Stack>

        <Stack
          cue="Stock below the reorder line"
          footer={
            <>
              <span className={CUE}>Suggested order attached</span>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">2</span>
            </>
          }
        >
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <IconTile>
              <Syringe size={15} />
            </IconTile>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">Gauze rolls, sterile</span>
              <span className="text-muted-foreground truncate text-xs">14 left · reorder line 20</span>
            </span>
            <Button variant="secondary" size="xs">
              Order 100
            </Button>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <IconTile>
              <AlertTriangle size={15} />
            </IconTile>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">Nitrile gloves, medium</span>
              <span className="text-muted-foreground truncate text-xs">1 box left · reorder line 4</span>
            </span>
            <Button variant="secondary" size="xs">
              Order 12
            </Button>
          </div>
        </Stack>

        <section className="bg-card flex items-center gap-3 rounded-xl border p-4">
          <IconTile rose>
            <Receipt size={15} />
          </IconTile>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-rose-300 text-[11px] font-semibold tracking-wider uppercase">The one thing</span>
            <span className="text-sm font-medium">Six invoices crossed 30 days this week — reminders are drafted</span>
          </span>
          <Button size="xs">Send reminders</Button>
        </section>

        <footer className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
          <CalendarClock size={14} />
          Tomorrow&rsquo;s brief drafts itself at 06:30. Nothing to maintain.
        </footer>
      </div>
    </div>
  );
}
