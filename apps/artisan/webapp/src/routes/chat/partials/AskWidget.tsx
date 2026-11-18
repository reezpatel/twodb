import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Pencil, SkipForward } from "lucide-react";
import { Button } from "@twodb/blocks";
import { cn } from "../../../lib/cn.js";

interface Question {
  question: string;
  options?: string[];
  allowMultiple?: boolean;
}

/** Per-question draft: chosen options, an optional custom answer, or an explicit skip. */
interface Draft {
  picked: string[];
  custom: string;
  skipped: boolean;
}

const empty = (): Draft => ({ picked: [], custom: "", skipped: false });

/** The answer parts a draft produces ([] = unanswered / skipped). */
function partsOf(d: Draft): string[] {
  if (d.skipped) return [];
  const custom = d.custom.trim();
  return custom ? [...d.picked, custom] : d.picked;
}

/**
 * ask_user as a stepper: one question per step (options + a custom "Other" answer,
 * or skip), then a final review where every answer can be edited before submitting.
 * Wire format is unchanged — string | string[] per question, "" when skipped.
 */
export function AskWidget(props: {
  questions: Question[];
  onAnswer: (answers: Array<string | string[]>) => void;
  onCancel: () => void;
}) {
  const { questions } = props;
  const total = questions.length;
  // Drafts + step belong to ONE set of questions. A new ask (different
  // questions) must reset them — otherwise a mounted widget reused for a
  // shorter ask indexes past the end (q/draft undefined → crash).
  const questionsKey = useMemo(() => JSON.stringify(questions), [questions]);
  const [drafts, setDrafts] = useState<Draft[]>(() => questions.map(empty));
  const [step, setStep] = useState(0);
  const prevKey = useRef(questionsKey);
  useEffect(() => {
    if (prevKey.current !== questionsKey) {
      prevKey.current = questionsKey;
      setDrafts(questions.map(empty));
      setStep(0);
    }
    // questions identity changes every render in some parents — key on content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionsKey]);
  // 0..total-1 = questions; total = review (only when there is more than one question)
  const hasReview = total > 1;
  const reviewing = hasReview && step === total;
  const idx = Math.min(step, total - 1);
  const q = questions[idx];
  const draft = drafts[idx] ?? empty();

  const patch = (i: number, fn: (d: Draft) => Draft) => setDrafts((prev) => prev.map((d, k) => (k === i ? fn(d) : d)));

  const toggleOption = (i: number, opt: string, multi: boolean) =>
    patch(i, (d) => {
      const on = d.picked.includes(opt);
      const picked = multi ? (on ? d.picked.filter((p) => p !== opt) : [...d.picked, opt]) : on ? [] : [opt];
      // single choice: picking an option replaces any custom answer
      return { picked, custom: multi ? d.custom : "", skipped: false };
    });

  const setCustom = (i: number, multi: boolean, custom: string) =>
    patch(i, (d) => ({ picked: multi ? d.picked : custom ? [] : d.picked, custom, skipped: false }));

  const submit = () =>
    props.onAnswer(
      questions.map((qq, i) => {
        const parts = partsOf(drafts[i]);
        if (parts.length === 0) return "";
        return qq.allowMultiple ? parts : parts.join(", ");
      }),
    );

  const answeredCount = drafts.filter((d) => partsOf(d).length > 0).length;
  const lastQuestion = step === total - 1;
  const next = () => (lastQuestion && !hasReview ? submit() : setStep((s) => Math.min(s + 1, hasReview ? total : total - 1)));
  const skip = () => {
    patch(step, () => ({ picked: [], custom: "", skipped: true }));
    if (lastQuestion && !hasReview) props.onAnswer(questions.map((_, i) => (i === step ? "" : answerFor(i))));
    else setStep((s) => s + 1);
  };
  // answer for question i from current drafts (used when skipping the final lone question)
  const answerFor = (i: number): string | string[] => {
    const parts = partsOf(drafts[i]);
    return parts.length === 0 ? "" : questions[i].allowMultiple ? parts : parts.join(", ");
  };

  return (
    <div
      className="my-2 rounded-lg border border-info/40 bg-info/5"
      onKeyDown={(e) => {
        if (e.key === "Escape") props.onCancel();
      }}
    >
      {/* header: progress */}
      <div className="flex items-center gap-2 border-b border-info/20 px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{reviewing ? "Review answers" : total > 1 ? `Question ${step + 1} of ${total}` : "Question"}</span>
        {hasReview ? (
          <div className="ml-auto flex items-center gap-1.5">
            {Array.from({ length: total + 1 }).map((_, i) => {
              const done = i < total && (partsOf(drafts[i]).length > 0 || drafts[i].skipped);
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={i === total ? "Review" : `Go to question ${i + 1}`}
                  onClick={() => setStep(i)}
                  className={cn(
                    "size-2 rounded-full transition-colors",
                    i === step ? "bg-info" : done ? "bg-info/50" : "bg-outline",
                    i === step && "scale-125",
                  )}
                />
              );
            })}
          </div>
        ) : null}
      </div>

      {reviewing ? (
        <div className="space-y-1 p-3">
          {questions.map((qq, i) => {
            const parts = partsOf(drafts[i]);
            const skipped = parts.length === 0;
            return (
              <div key={i} className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-surface-muted/50">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[10px] text-ink-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-ink-muted">{qq.question}</p>
                  {skipped ? (
                    <p className="text-[13px] italic text-ink-muted/70">Skipped</p>
                  ) : (
                    <p className="break-words text-[13px] text-ink">{parts.join(", ")}</p>
                  )}
                </div>
                <button
                  type="button"
                  title="Edit answer"
                  aria-label={`Edit answer ${i + 1}`}
                  onClick={() => setStep(i)}
                  className="rounded p-1 text-ink-muted opacity-0 transition-opacity hover:bg-surface-muted hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            );
          })}
          <p className="px-2 pt-1 text-[11px] text-ink-muted">
            {answeredCount} of {total} answered{answeredCount < total ? " — skipped questions are left to the agent's judgment" : ""}.
          </p>
        </div>
      ) : !q ? null : (
        <div className="space-y-2.5 p-3">
          <p className="text-[13px] font-medium text-ink">{q.question}</p>
          {q.options?.length ? (
            <div className="flex flex-col gap-1">
              {q.options.map((opt) => {
                const on = draft.picked.includes(opt);
                const multi = !!q.allowMultiple;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleOption(step, opt, multi)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-[13px] transition-colors",
                      on ? "border-info bg-info/15 text-ink" : "border-outline text-ink-muted hover:bg-surface-muted/60 hover:text-ink",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center border",
                        multi ? "rounded" : "rounded-full",
                        on ? "border-info bg-info text-primary-foreground" : "border-outline-strong",
                      )}
                    >
                      {on ? <Check className="size-3" /> : null}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : null}
          <input
            autoFocus={!q.options?.length}
            value={draft.custom}
            placeholder={q.options?.length ? (q.allowMultiple ? "Add your own answer…" : "Or type your own answer…") : "Type your answer…"}
            onChange={(e) => setCustom(step, !!q.allowMultiple, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                next();
              }
            }}
            className="h-8 w-full rounded-md border border-outline bg-paper px-2.5 text-[13px] outline-none placeholder:text-ink-muted focus:border-ink-muted"
          />
          {q.allowMultiple ? <p className="text-[11px] text-ink-muted">Select all that apply.</p> : null}
        </div>
      )}

      {/* footer: navigation */}
      <div className="flex items-center gap-2 border-t border-info/20 px-3 py-2">
        <Button size="sm" variant="ghost" onClick={props.onCancel}>
          Cancel
        </Button>
        <span className="flex-1" />
        {!reviewing ? (
          <Button size="sm" variant="ghost" onClick={skip}>
            <SkipForward className="size-3.5" /> Skip
          </Button>
        ) : null}
        {step > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft className="size-3.5" /> Back
          </Button>
        ) : null}
        {reviewing || (!hasReview && lastQuestion) ? (
          <Button size="sm" variant="primary" onClick={submit}>
            Submit
          </Button>
        ) : (
          <Button size="sm" variant="primary" onClick={next}>
            {lastQuestion ? "Review" : "Next"} <ChevronRight className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
