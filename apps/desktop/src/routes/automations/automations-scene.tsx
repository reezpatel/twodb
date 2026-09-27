import { Workflow } from "lucide-react";

export function AutomationsScene() {
  return (
    <div className="bg-background flex h-full items-center justify-center p-6">
      <section className="bg-card flex w-full max-w-lg flex-col items-center gap-3 rounded-xl border p-10 text-center">
        <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-full">
          <Workflow size={20} />
        </span>
        <h1 className="m-0 text-lg font-semibold">Automations</h1>
        <p className="text-muted-foreground m-0 max-w-sm text-sm leading-relaxed">Automations will turn plain-language routines into repeatable work.</p>
      </section>
    </div>
  );
}
