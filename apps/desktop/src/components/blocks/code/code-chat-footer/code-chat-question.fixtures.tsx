import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Send, Square } from "lucide-react";
import { useAnswerEditor } from "../../composer/use-answer-editor";
import { MOCK_FILES } from "../../composer/composer.fixtures";
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
} from "./code-chat-question";

export type MockQuestion = { question: string; options?: string[]; allowMultiple?: boolean };
type Answer = string | string[];

export const MOCK_QUESTIONS: MockQuestion[] = [
  { question: "Which package manager should the scripts use?", options: ["pnpm", "npm", "yarn"] },
  { question: "Which checks should run before the commit?", options: ["tsc", "prettier", "tests", "build"], allowMultiple: true },
  { question: "Anything else the agent should know?" },
];

const answerText = (answer: Answer | undefined) => (Array.isArray(answer) ? answer.join(", ") : (answer ?? ""));
const isAnswered = (answer: Answer | undefined) => (Array.isArray(answer) ? answer.length > 0 : Boolean(answer && String(answer).trim()));

type MockAnswerInputProps = { value: string; onChange: (text: string) => void; onEnter: () => void; placeholder: string; autoFocus: boolean };

function MockAnswerInput({ value, onChange, onEnter, placeholder, autoFocus }: MockAnswerInputProps) {
  const editor = useAnswerEditor({ value, onChange, onEnter, files: MOCK_FILES, placeholder });
  useEffect(() => {
    if (autoFocus) editor?.commands.focus("end");
  }, [editor, autoFocus]);
  return <CodeChatQuestionInput editor={editor} />;
}

type MockQuestionWizardProps = {
  questions?: MockQuestion[];
  initialStep?: number;
  onSubmit?: (answers: Answer[]) => void;
  onStop?: () => void;
};

/** Story helper: the wizard's step logic, wired to the question blocks. The real one lives in routes/code/chat/ask-user-wizard.tsx. */
export function MockQuestionWizard({ questions = MOCK_QUESTIONS, initialStep = 0, onSubmit, onStop }: MockQuestionWizardProps) {
  const [step, setStep] = useState(initialStep);
  const typed = useRef<Record<number, string>>({});
  const [answers, setAnswers] = useState<Answer[]>(() => questions.map(() => ""));
  const isSummary = step >= questions.length;
  const current = questions[step] as MockQuestion | undefined;
  const currentAnswer = answers[step];

  const setAnswer = (value: Answer) => setAnswers((previous) => questions.map((_, index) => (index === step ? value : (previous[index] ?? ""))));
  const isSelected = (option: string) => (Array.isArray(currentAnswer) ? currentAnswer.includes(option) : currentAnswer === option);
  const toggle = (option: string) => {
    typed.current[step] = "";
    if (!current?.allowMultiple) return setAnswer(option);
    const list = Array.isArray(currentAnswer) ? currentAnswer : currentAnswer ? [String(currentAnswer)] : [];
    setAnswer(list.includes(option) ? list.filter((value) => value !== option) : [...list, option]);
  };
  const customText =
    typeof currentAnswer === "string" && currentAnswer && (!current?.options?.includes(currentAnswer) || currentAnswer === typed.current[step])
      ? currentAnswer
      : "";
  const canAdvance = isAnswered(currentAnswer);

  return (
    <CodeChatQuestion>
      <CodeChatQuestionHeader progress={isSummary ? "review" : `${step + 1} / ${questions.length}`} />

      {!isSummary && current ? (
        <CodeChatQuestionBody>
          <CodeChatQuestionPrompt>{current.question}</CodeChatQuestionPrompt>
          {current.options?.length ? (
            <CodeChatQuestionOptions>
              {current.options.map((option) => (
                <CodeChatQuestionOption
                  key={option}
                  label={option}
                  selected={isSelected(option)}

                  onClick={() => toggle(option)}
                />
              ))}
            </CodeChatQuestionOptions>
          ) : null}
          <MockAnswerInput
            key={step}
            value={customText}
            onChange={(text) => {
              typed.current[step] = text;
              setAnswer(text);
            }}
            onEnter={() => canAdvance && setStep((value) => value + 1)}
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
          {questions.map((question, index) => (
            <CodeChatQuestionReviewItem key={index} question={question.question} answer={answerText(answers[index])} />
          ))}
        </CodeChatQuestionReview>
      )}

      <CodeChatQuestionActions>
        <CodeChatQuestionAction
          kind="back"
          label="Back"
          icon={<ArrowLeft />}
          disabled={step === 0}
          onClick={() => setStep((value) => Math.max(0, value - 1))}
        />
        <CodeChatQuestionAction kind="stop" label="Stop" icon={<Square className="fill-current" />} title="Stop the run without answering" onClick={onStop} />
        {isSummary ? (
          <CodeChatQuestionAction label="Submit answers" icon={<Send />} onClick={() => onSubmit?.(questions.map((_, index) => answers[index] ?? ""))} />
        ) : (
          <CodeChatQuestionAction label="Next" icon={<ArrowRight />} iconAfter disabled={!canAdvance} onClick={() => setStep((value) => value + 1)} />
        )}
      </CodeChatQuestionActions>
    </CodeChatQuestion>
  );
}
