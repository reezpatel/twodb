import { Link } from "react-router";
import { Loader2, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmail } from "./email-provider";
import { labelPathName } from "./labels/use-label-tree";
import { ComposeWindow } from "./compose/compose-window";
import { ThreadReader } from "./reader/thread-reader";
import { ThreadList } from "./thread-list";

export function EmailScene() {
  const s = useEmail();
  const accounts = s.accounts.data ?? [];
  const labels = s.labels.data ?? [];

  if (s.accounts.isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!accounts.length) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <span className="bg-muted grid size-12 place-items-center rounded-full">
            <Mail size={20} />
          </span>
          <h2 className="text-lg font-semibold">Connect a mailbox</h2>
          <p className="text-muted-foreground text-sm">
            Add a Gmail, Yahoo or IMAP/SMTP account. Mail is synced and stored locally in twodb — the UI never talks to the provider directly.
          </p>
          <Button asChild>
            <Link to="/apps/settings/accounts">Add an account</Link>
          </Button>
        </div>
      </div>
    );
  }

  const title = s.labelId ? labelPathName(labels, s.labelId) : "";

  return (
    <div className="bg-background relative grid h-full min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[360px_1fr]">
      <ThreadList s={s} title={title} />

      <section className="hidden min-h-0 min-w-0 flex-col lg:flex">
        {s.selected ? (
          <ThreadReader
            key={s.selected}
            threadId={s.selected}
            labels={labels}
            index={s.selectedIndex}
            total={s.visibleCount}
            onStep={s.step}
            onClose={() => s.setSelected(null)}
            onAction={(action, payload) => s.act.mutate({ ids: [s.selected!], action, payload })}
            onCompose={(kind, sourceMessageId) => s.compose.mutate({ composeKind: kind, sourceMessageId })}
            onEditDraft={(id) => s.setComposeId(id)}
          />
        ) : (
          <div className="text-muted-foreground m-auto flex max-w-md flex-col items-center gap-2 p-6 text-center text-sm">
            <Mail size={18} />
            No conversation selected.
          </div>
        )}
      </section>

      {s.composeId ? (
        <ComposeWindow
          key={s.composeId}
          draftId={s.composeId}
          accounts={s.sendingAccounts}
          onClose={() => s.setComposeId(null)}
          onSent={(m, undoSeconds) => {
            s.setComposeId(null);
            s.setUndo({ messageId: m.id, until: Date.now() + undoSeconds * 1000, scheduled: m.status === "scheduled" });
          }}
        />
      ) : null}

      {s.undo || s.actionError ? (
        <div className="bg-foreground text-background absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 text-sm shadow-xl">
          {s.undo ? (
            <>
              <span>{s.undo.scheduled ? "Message scheduled." : "Sending…"}</span>
              <button
                type="button"
                className="font-semibold underline-offset-2 hover:underline"
                disabled={s.cancelUndo.isPending}
                onClick={() => s.cancelUndo.mutate(s.undo!.messageId)}
              >
                Undo
              </button>
            </>
          ) : (
            <span>{s.actionError}</span>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              s.setUndo(null);
              s.setActionError(null);
            }}
          >
            <X size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
