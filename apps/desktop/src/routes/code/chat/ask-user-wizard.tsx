import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Send, Square } from "lucide-react";
import {
  CodeChatQuestion,
  CodeChatQuestionAction,
  CodeChatQuestionActions,
  CodeChatQuestionBody,
  CodeChatQuestionHeader,
  CodeChatQuestionInput,
  CodeChatQuestionNote,
  CodeChatQuestionOption,
  CodeChatQuestionOptions,
  CodeChatQuestionPrompt,
  CodeChatQuestionReview,
  CodeChatQuestionReviewItem,
  CodeChatQuestionReviewTitle,
} from "@/components/blocks/code/code-chat-footer/code-chat-question";
import { useAnswerEditor } from "@/components/blocks/composer/use-answer-editor";

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

interface AnswerInputProps {
  value: string;
  onChange: (text: string) => void;
  onEnter: () => void;
  files: string[] | null;
  placeholder: string;
  autoFocus: boolean;
}

/** Free-text answer: the chat composer's editor with @ file mentions only. Mounted per step so each question starts fresh. */
function AnswerInput({ value, onChange, onEnter, files, placeholder, autoFocus }: AnswerInputProps) {
  const editor = useAnswerEditor({ value, onChange, onEnter, files, placeholder });

  useEffect(() => {
    if (autoFocus) editor?.commands.focus("end");
  }, [editor, autoFocus]);

  return <CodeChatQuestionInput editor={editor} />;
}

/**
 * Pane-based question wizard replacing the composer while the agent waits on
 * ask_user: one pane per question (options + always a custom answer), then a
 * final review pane — answers are only submitted from there. Stop aborts the
 * run without answering.
 */
export function AskUserWizard({
  questions: rawQuestions,
  files,
  onSubmit,
  onStop,
}: {
  questions: AskUserQuestion[];
  /** File paths for @ mentions in free-text answers — null disables them. */
  files: string[] | null;
  onSubmit: (answers: AskUserAnswer[]) => void;
  onStop: () => void;
}) {
  const questions = useMemo(() => normalizeAskUserQuestions(rawQuestions), [rawQuestions]);
  const [step, setStep] = useState(0);
  // What the user typed per step — keeps typed text that happens to equal an option label in the editor.
  const typed = useRef<Record<number, string>>({});
  const [answers, setAnswers] = useState<AskUserAnswer[]>(() => questions.map(() => ""));
  const isSummary = step >= questions.length;
  const current = questions[step] as AskUserQuestion | undefined;

  const setAnswer = (value: AskUserAnswer) => setAnswers((prev) => questions.map((_, i) => (i === step ? value : (prev[i] ?? ""))));
  const currentAnswer = answers[step];
  const answered = (a: AskUserAnswer | undefined) => (Array.isArray(a) ? a.length > 0 : Boolean(a && String(a).trim()));
  const canAdvance = isSummary || answered(currentAnswer);
  const finalAnswers = questions.map((_, i) => answers[i] ?? "");

  const toggleOption = (option: string) => {
    typed.current[step] = "";
    if (current?.allowMultiple) {
      const list = Array.isArray(currentAnswer) ? currentAnswer : currentAnswer ? [String(currentAnswer)] : [];
      setAnswer(list.includes(option) ? list.filter((o) => o !== option) : [...list, option]);
    } else {
      setAnswer(option);
    }
  };

  const isSelected = (option: string) => (Array.isArray(currentAnswer) ? currentAnswer.includes(option) : currentAnswer === option);
  const customText =
    typeof currentAnswer === "string" && currentAnswer && (!current?.options?.includes(currentAnswer) || currentAnswer === typed.current[step])
      ? currentAnswer
      : "";

  return (
    <CodeChatQuestion>
      <CodeChatQuestionHeader progress={isSummary ? "review" : `${step + 1} / ${questions.length}`} />

      {!isSummary && current ? (
        <CodeChatQuestionBody>
          <CodeChatQuestionPrompt>{current.question}</CodeChatQuestionPrompt>
          {current.options && current.options.length > 0 && (
            <CodeChatQuestionOptions>
              {current.options.map((option) => (
                <CodeChatQuestionOption
                  key={option}
                  label={option}
                  selected={isSelected(option)}

                  onClick={() => toggleOption(option)}
                />
              ))}
            </CodeChatQuestionOptions>
          )}
          <AnswerInput
            key={step}
            value={customText}
            onChange={(text) => {
              typed.current[step] = text;
              setAnswer(text);
            }}
            onEnter={() => canAdvance && setStep((s) => s + 1)}
            files={files}
            placeholder={current.allowMultiple ? "Custom answer (overrides selections)… @ for files" : "Custom answer… @ for files"}
            autoFocus={!current.options?.length}
          />
        </CodeChatQuestionBody>
      ) : questions.length === 0 ? (
        <CodeChatQuestionBody>
          <CodeChatQuestionNote>The agent sent a question without any readable content. Submit to continue or stop the run.</CodeChatQuestionNote>
        </CodeChatQuestionBody>
      ) : (
        <CodeChatQuestionReview>
          <CodeChatQuestionReviewTitle>Review your answers</CodeChatQuestionReviewTitle>
          {questions.map((q, i) => (
            <CodeChatQuestionReviewItem key={i} question={q.question} answer={answerText(answers[i])} />
          ))}
        </CodeChatQuestionReview>
      )}

      <CodeChatQuestionActions>
        <CodeChatQuestionAction kind="back" label="Back" icon={<ArrowLeft />} disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} />
        <CodeChatQuestionAction kind="stop" label="Stop" icon={<Square className="fill-current" />} title="Stop the run without answering" onClick={onStop} />
        {isSummary ? (
          <CodeChatQuestionAction label="Submit answers" icon={<Send />} onClick={() => onSubmit(finalAnswers)} />
        ) : (
          <CodeChatQuestionAction label="Next" icon={<ArrowRight />} iconAfter disabled={!canAdvance} onClick={() => setStep((s) => s + 1)} />
        )}
      </CodeChatQuestionActions>
    </CodeChatQuestion>
  );
}
