import { useState } from "react";
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

/**
 * Pane-based question wizard replacing the composer while the agent waits on
 * ask_user: one pane per question (options + always a custom answer), then a
 * final review pane — answers are only submitted from there. Stop aborts the
 * run without answering.
 */
export function AskUserWizard({
  questions,
  onSubmit,
  onStop,
}: {
  questions: AskUserQuestion[];
  onSubmit: (answers: AskUserAnswer[]) => void;
  onStop: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AskUserAnswer[]>(() => questions.map(() => ""));
  const isSummary = step >= questions.length;
  const current = questions[step];

  const setAnswer = (value: AskUserAnswer) => setAnswers((prev) => prev.map((a, i) => (i === step ? value : a)));
  const currentAnswer = answers[step];
  const answered = (a: AskUserAnswer | undefined) => (Array.isArray(a) ? a.length > 0 : Boolean(a && String(a).trim()));
  const canAdvance = isSummary || answered(currentAnswer);

  const toggleOption = (option: string) => {
    if (current?.allowMultiple) {
      const list = Array.isArray(currentAnswer) ? currentAnswer : currentAnswer ? [String(currentAnswer)] : [];
      setAnswer(list.includes(option) ? list.filter((o) => o !== option) : [...list, option]);
    } else {
      setAnswer(option);
    }
  };

  const isSelected = (option: string) => (Array.isArray(currentAnswer) ? currentAnswer.includes(option) : currentAnswer === option);
  const customText = typeof currentAnswer === "string" && currentAnswer && !current.options?.includes(currentAnswer) ? currentAnswer : "";

  return (
    <div className="bg-card focus-within:border-ring rounded-lg border">
      <div className="border-b flex items-center gap-2 border-b px-3 py-2">
        <CircleHelp size={13} className="text-primary shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-semibold tracking-wide uppercase">Agent question</span>
        <span className="text-muted-foreground ml-auto font-mono text-[11px]">{isSummary ? "review" : `${step + 1} / ${questions.length}`}</span>
      </div>

      {!isSummary ? (
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
      ) : (
        <div className="flex flex-col gap-2 px-3 py-3">
          <p className="text-[11px] font-semibold tracking-wide uppercase">Review your answers</p>
          {questions.map((q, i) => (
            <div key={i} className="flex flex-col gap-0.5 border-t pt-2 first:border-t-0 first:pt-0">
              <span className="text-muted-foreground text-xs">{q.question}</span>
              <span className="text-sm font-medium">{Array.isArray(answers[i]) ? (answers[i] as string[]).join(", ") : (answers[i] as string)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t flex items-center gap-1 border-t px-1.5 py-1">
        <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          <ArrowLeft size={13} /> Back
        </Button>
        <Button variant="destructive" size="sm" className="ml-auto" title="Stop the run without answering" onClick={onStop}>
          <Square size={12} /> Stop
        </Button>
        {isSummary ? (
          <Button size="sm" onClick={() => onSubmit(answers)}>
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
