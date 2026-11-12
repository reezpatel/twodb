import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@twodb/blocks";
import { artisanClient, type SkillInfo } from "../../lib/artisan-client.js";
import { SkillDialog } from "./partials/SkillDialog.js";

/** Skills page: space-scoped, optionally pinned to a directory. */
export function SkillsView() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [dialog, setDialog] = useState<"new" | SkillInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setSkills(await artisanClient.listSkills());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold">Skills</h2>
          <p className="text-[12px] text-ink-muted">Space-scoped instructions agents load on demand (read_skill). Optional directory pin, tag matching.</p>
        </div>
        <Button size="sm" variant="primary" onClick={() => setDialog("new")}>
          <Plus className="size-3.5" />
          New skill
        </Button>
      </div>
      {error ? <p className="mb-3 text-[12px] text-destructive">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {skills.map((s) => (
          <Card key={s.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="truncate text-[14px] font-medium">{s.name}</h4>
                  <p className="line-clamp-2 text-[12px] text-ink-muted">{s.description || "no description"}</p>
                </div>
                {s.directory ? <Badge tone="info">pinned</Badge> : <Badge tone="neutral">space</Badge>}
              </div>
              {s.directory ? <p className="truncate font-mono text-[11px] text-ink-muted">{s.directory}</p> : null}
              <div className="flex gap-1.5">
                {s.tags.map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => setDialog(s)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={async () => { await artisanClient.deleteSkill(s.id); void refresh(); }}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {skills.length === 0 ? <p className="text-[12px] text-ink-muted">No skills yet.</p> : null}
      </div>
      {dialog ? (
        <SkillDialog
          skill={dialog === "new" ? null : dialog}
          onClose={() => setDialog(null)}
          onSaved={async () => { setDialog(null); await refresh(); }}
        />
      ) : null}
    </div>
  );
}
