import { useCallback, useEffect, useState } from "react";
import { Check, CircleCheck, CircleDot, ExternalLink, GitMerge, GitPullRequest, Loader2, MessageSquare, X } from "lucide-react";
import { artisanClient, type PrInfo } from "../../../lib/artisan-client.js";
import { useWorkspaceWs } from "../../../lib/workspace-ws.js";
import { SideSection } from "./SidePanel.js";

/**
 * Pull request linked to this session (set by the agent's set_pr tool or
 * removable here). Live status comes from `gh pr view` executed on the
 * session's runner by the artisan server.
 */
export function PrSection({ sessionId, prUrl }: { sessionId: string; prUrl: string | null }) {
  const { onFrame } = useWorkspaceWs();
  const [pr, setPr] = useState<PrInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!prUrl) {
      setPr(null);
      return;
    }
    setLoading(true);
    try {
      const r = await artisanClient.getSessionPr(sessionId);
      setPr(r.pr);
      setError(r.error ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [sessionId, prUrl]);

  useEffect(() => {
    setPr(null);
    void load();
    if (!prUrl) return;
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load, prUrl]);

  // The agent may merge/push mid-run — any finished run can change PR state.
  useEffect(() => onFrame((f) => {
    if (f.sessionId === sessionId && f.type === "done") void load();
  }), [onFrame, sessionId, load]);

  if (!prUrl) return null;

  const remove = () => void artisanClient.updateSession(sessionId, { prUrl: null }).catch(() => undefined);

  const mergeable = pr && !pr.draft && pr.mergeState === "CLEAN";
  const blocked = pr && !pr.draft && ["DIRTY", "BLOCKED", "BEHIND"].includes(pr.mergeState);
  const checksDone = pr ? pr.checks.every((c) => c.status === "COMPLETED") : false;
  const checksFailed = pr ? pr.checks.filter((c) => c.status === "COMPLETED" && !["SUCCESS", "NEUTRAL", "SKIPPED"].includes(c.conclusion)) : [];
  const checksPending = pr ? pr.checks.filter((c) => c.status !== "COMPLETED") : [];
  const reviewLabel = pr
    ? pr.reviewDecision === "APPROVED"
      ? { text: "Approved", cls: "text-success" }
      : pr.reviewDecision === "CHANGES_REQUESTED"
        ? { text: "Changes requested", cls: "text-destructive" }
        : { text: "Review required", cls: "text-warning" }
    : null;

  return (
    <SideSection title="Pull request">
      <div className="flex flex-col gap-2">
        {/* title row */}
        <div className="flex items-start gap-1.5">
          <GitPullRequest className={`mt-0.5 size-3.5 shrink-0 ${pr?.state === "MERGED" ? "text-ion-deep" : pr?.state === "CLOSED" ? "text-destructive" : "text-success"}`} />
          {pr ? (
            <a href={pr.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 text-[12px] font-medium leading-tight text-ink hover:underline">
              <span className="break-words">{pr.title}</span> <span className="text-ink-muted">#{pr.number}</span>
              <ExternalLink className="ml-1 inline size-3 align-baseline text-ink-muted" />
            </a>
          ) : (
            <a href={prUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[12px] text-ink-muted hover:underline">{prUrl}</a>
          )}
          <button type="button" aria-label="Remove pull request" title="Remove pull request from this session" onClick={remove} className="shrink-0 rounded p-0.5 text-ink-muted hover:bg-surface-muted hover:text-destructive">
            <X className="size-3.5" />
          </button>
        </div>

        {loading && !pr ? <p className="flex items-center gap-1.5 text-[11px] text-ink-muted"><Loader2 className="size-3 animate-spin" /> loading…</p> : null}
        {error && !pr ? <p className="text-[11px] text-warning" title={error}>{error}</p> : null}

        {pr ? (
          <>
            {/* state badges */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              {pr.draft ? <span className="rounded bg-surface-muted px-1.5 py-px font-medium text-ink-muted">Draft</span> : null}
              {pr.state === "MERGED" ? <span className="rounded bg-ion-deep/15 px-1.5 py-px font-medium text-ion-deep">Merged</span> : null}
              {pr.state === "CLOSED" ? <span className="rounded bg-destructive/15 px-1.5 py-px font-medium text-destructive">Closed</span> : null}
              {pr.autoMerge ? <span className="rounded bg-info/15 px-1.5 py-px font-medium text-info">Auto-merge</span> : null}
              {reviewLabel ? <span className={`rounded bg-surface-muted px-1.5 py-px font-medium ${reviewLabel.cls}`}>{reviewLabel.text}</span> : null}
            </div>

            {/* checks */}
            {pr.checks.length > 0 ? (
              <div className="flex items-center gap-1.5 text-[11px]">
                {checksPending.length > 0 ? (
                  <><Loader2 className="size-3.5 shrink-0 animate-spin text-warning" /><span className="text-warning">{checksPending.length} check{checksPending.length === 1 ? "" : "s"} running</span></>
                ) : checksFailed.length > 0 ? (
                  <><X className="size-3.5 shrink-0 text-destructive" /><span className="text-destructive">{checksFailed.length}/{pr.checks.length} checks failing</span></>
                ) : (
                  <><CircleCheck className="size-3.5 shrink-0 text-success" /><span className="text-success">{pr.checks.length} checks passing</span></>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-ink-muted"><CircleDot className="size-3.5 shrink-0" /> No checks</div>
            )}
            {checksFailed.length > 0 ? (
              <div className="flex flex-col gap-0.5 border-l border-destructive/30 pl-2">
                {checksFailed.slice(0, 3).map((c) => (
                  <span key={c.name} className="truncate text-[10px] text-destructive" title={c.name}>✕ {c.name}</span>
                ))}
                {checksFailed.length > 3 ? <span className="text-[10px] text-ink-muted">+{checksFailed.length - 3} more</span> : null}
              </div>
            ) : null}

            {/* merge readiness */}
            <div className="flex items-center gap-1.5 text-[11px]">
              <GitMerge className="size-3.5 shrink-0" />
              {pr.state === "MERGED" ? (
                <span className="text-ion-deep">Merged</span>
              ) : pr.draft ? (
                <span className="text-ink-muted">Mark ready for review to merge</span>
              ) : mergeable && checksDone && checksFailed.length === 0 ? (
                <a href={`${pr.url}#partial-pull-merging`} target="_blank" rel="noreferrer" className="rounded bg-success/15 px-1.5 py-0.5 font-medium text-success hover:bg-success/25">
                  Ready to merge ↗
                </a>
              ) : blocked ? (
                <span className="text-warning">{pr.mergeState === "BEHIND" ? "Behind base — update branch" : "Merge blocked"}</span>
              ) : (
                <span className="text-ink-muted">Waiting on checks/review…</span>
              )}
            </div>

            {/* stats */}
            <div className="flex items-center gap-2.5 text-[10px] text-ink-muted tabular-nums">
              <span className="text-success">+{pr.additions}</span>
              <span className="text-destructive">−{pr.deletions}</span>
              <span>{pr.changedFiles} file{pr.changedFiles === 1 ? "" : "s"}</span>
              <span className="ml-auto flex items-center gap-1" title="Open / resolved review comments">
                <MessageSquare className="size-3" />
                {pr.openComments} open · {pr.resolvedComments} resolved
              </span>
            </div>
          </>
        ) : null}
      </div>
    </SideSection>
  );
}

