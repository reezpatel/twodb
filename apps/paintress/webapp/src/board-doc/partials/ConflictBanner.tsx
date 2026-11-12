import { Button } from "@twodb/blocks";

export function ConflictBanner(props: { onTheirs(): void; onMine(): void }) {
  return (
    <div role="alert" className="flex items-center gap-3 border-b border-warning bg-warning/15 px-4 py-2 text-[13px]">
      <span className="flex-1">Someone else (or an agent) changed this document while you were editing.</span>
      <Button size="sm" variant="secondary" onClick={props.onTheirs}>
        Use their version
      </Button>
      <Button size="sm" onClick={props.onMine}>
        Keep mine
      </Button>
    </div>
  );
}
