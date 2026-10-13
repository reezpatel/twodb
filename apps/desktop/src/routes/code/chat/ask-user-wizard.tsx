import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CircleHelp, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AskUserQuestion {
  question: string;
  options?: string[];
  allowMultiple?: boolean;
}

export type AskUserAnswer = string | string[];

/** Coerces any option shape the model sends (string, number, {label|value|text|…}) into display text. */
function optionText(option: unknown): string {
  if (typeof option === "string") return option;
  if (typeof option === "number" || typeof option === "boolean") return String(option);
  if (option && typeof option === "object") {
    const o = option as Record<string, unknown>;
    for (const key of ["label", "value", "text", "title", "name", "option"]) {
      if (typeof o[key] === "string" || typeof o[key] === "number") return String(o[key]);
    }
    try {
      return JSON.stringify(option);
    } catch {
      return "";
    }
  }
  return "";
}

/**
 * Tool arguments come straight from the model — options may be objects, a
 * comma string, or duplicated; allowMultiple may be "true". Rendering any of
 * those raw crashes React, so the wizard only ever sees this clean shape.
 */
export function normalizeAskUserQuestions(raw: unknown): AskUserQuestion[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
  return list.flatMap((q): AskUserQuestion[] => {
    if (typeof q === "string") return q.trim() ? [{ question: q }] : [];
    if (!q || typeof q !== "object") return [];
    const r = q as Record<string, unknown>;
    const question = optionText(r.question ?? r.text ?? r.prompt).trim();
    if (!question) return [];
    const rawOptions = Array.isArray(r.options) ? r.options : typeof r.options === "string" ? r.options.split(",") : [];
    const options = [...new Set(rawOptions.map((o) => optionText(o).trim()).filter(Boolean))];
    const allowMultiple = r.allowMultiple === true || r.allowMultiple === "true";
    return [{ question, ...(options.length > 0 ? { options } : {}), ...(allowMultiple ? { allowMultiple } : {}) }];
  });
}

function answerText(answer: AskUserAnswer | undefined): string {
  return Array.isArray(answer) ? answer.join(", ") : (answer ?? "");
}

/**
 * Pane-based question wizard replacing the composer while the agent waits on
 * ask_user: one pane per question (options + always a custom answer), then a
 * final review pane — answers are only submitted from there. Stop aborts the
 * run without answering.
 */
export function AskUserWizard({
  questions: rawQuestions,
  onSubmit,
  onStop,
}: {
  questions: AskUserQuestion[];
  onSubmit: (answers: AskUserAnswer[]) => void;
  onStop: () => void;
}) {
  const questions = useMemo(() => normalizeAskUserQuestions(rawQuestions), [rawQuestions]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AskUserAnswer[]>(() => questions.map(() => ""));
  const isSummary = step >= questions.length;
  const current = questions[step] as AskUserQuestion | undefined;

  const setAnswer = (value: AskUserAnswer) =>
    setAnswers((prev) => questions.map((_, i) => (i === step ? value : (prev[i] ?? ""))));
  const currentAnswer = answers[step];
  const answered = (a: AskUserAnswer | undefined) => (Array.isArray(a) ? a.length > 0 : Boolean(a && String(a).trim()));
  const canAdvance = isSummary || answered(currentAnswer);
  const finalAnswers = questions.map((_, i) => answers[i] ?? "");

  const toggleOption = (option: string) => {
    if (current?.allowMultiple) {
      const list = Array.isArray(currentAnswer) ? currentAnswer : currentAnswer ? [String(currentAnswer)] : [];
      setAnswer(list.includes(option) ? list.filter((o) => o !== option) : [...list, option]);
    } else {
      setAnswer(option);
    }
  };

  const isSelected = (option: string) => (Array.isArray(currentAnswer) ? currentAnswer.includes(option) : currentAnswer === option);
  const customText = typeof currentAnswer === "string" && currentAnswer && !current?.options?.includes(currentAnswer) ? currentAnswer : "";

  return (
    <div className="bg-card focus-within:border-ring rounded-lg border">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <CircleHelp size={13} className="text-primary shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-semibold tracking-wide uppercase">Agent question</span>
        <span className="text-muted-foreground ml-auto font-mono text-[11px]">{isSummary ? "review" : `${step + 1} / ${questions.length}`}</span>
      </div>

      {!isSummary && current ? (
        <div className="flex flex-col gap-3 px-3 py-3">
          <p className="text-sm font-medium">{current.question}</p>
          {current.options && current.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {current.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleOption(option)}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                    isSelected(option) ? "bg-primary/15 border-primary text-primary" : "hover:bg-accent/60",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          <Input
            value={customText}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={current.allowMultiple ? "Custom answer (overrides selections)…" : "Custom answer…"}
            className="h-8 text-xs"
            aria-label="Custom answer"
          />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-muted-foreground px-3 py-3 text-sm">The agent sent a question without any readable content. Submit to continue or stop the run.</div>
      ) : (
        <div className="flex flex-col gap-2 px-3 py-3">
          <p className="text-[11px] font-semibold tracking-wide uppercase">Review your answers</p>
          {questions.map((q, i) => (
            <div key={i} className="flex flex-col gap-0.5 border-t pt-2 first:border-t-0 first:pt-0">
              <span className="text-muted-foreground text-xs">{q.question}</span>
              <span className="text-sm font-medium">{answerText(answers[i])}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 border-t px-1.5 py-1">
        <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          <ArrowLeft size={13} /> Back
        </Button>
        <Button variant="destructive" size="sm" className="ml-auto" title="Stop the run without answering" onClick={onStop}>
          <Square size={12} /> Stop
        </Button>
        {isSummary ? (
          <Button size="sm" onClick={() => onSubmit(finalAnswers)}>
            <Send size={13} /> Submit answers
          </Button>
        ) : (
          <Button size="sm" disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>
            Next <ArrowRight size={13} />
          </Button>
        )}
      </div>
    </div>
  );
}
