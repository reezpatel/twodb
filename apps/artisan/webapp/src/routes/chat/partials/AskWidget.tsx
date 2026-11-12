import { useState } from "react";
import { Button, Input } from "@twodb/blocks";

/** Inline ask_user widget — options as chips, free text always allowed. */
export function AskWidget(props: {
  questions: Array<{ question: string; options?: string[]; allowMultiple?: boolean }>;
  onAnswer: (answers: Array<string | string[]>) => void;
  onCancel: () => void;
}) {
  const [answers, setAnswers] = useState<Array<string>>(props.questions.map(() => ""));
  const [custom, setCustom] = useState("");

  const submit = () => {
    const out: Array<string | string[]> = props.questions.map((q, i) => {
      const picked = (answers[i] || "").split("|").filter(Boolean);
      if (picked.length > 1) return picked;
      return answers[i] || custom || "";
    });
    props.onAnswer(out);
  };

  return (
    <div className="my-2 space-y-3 rounded-lg border border-info/40 bg-info/5 p-3">
      {props.questions.map((q, i) => (
        <div key={i} className="space-y-1.5">
          <p className="text-[13px] font-medium text-ink">{q.question}</p>
          {q.options?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((opt) => {
                const picked = (answers[i] || "").split("|").filter(Boolean);
                const on = picked.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                      on ? "border-info bg-info/15 text-ink" : "border-outline text-ink-muted hover:text-ink"
                    }`}
                    onClick={() => setAnswers((prev) => {
                      const next = [...prev];
                      const cur = (next[i] || "").split("|").filter(Boolean);
                      if (q.allowMultiple) {
                        next[i] = cur.includes(opt) ? cur.filter((c) => c !== opt).join("|") : [...cur, opt].join("|");
                      } else {
                        next[i] = cur.includes(opt) && cur.length === 1 ? "" : opt;
                      }
                      return next;
                    })}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ))}
      <div className="flex gap-2">
        <Input value={custom} placeholder="or type a custom answer…" onChange={(e) => setCustom(e.target.value)} className="text-[12px]" />
        <Button size="sm" variant="primary" onClick={submit}>Answer</Button>
        <Button size="sm" variant="ghost" onClick={props.onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
