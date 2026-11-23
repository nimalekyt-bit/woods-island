import { React } from "../react";
import type { ReactNode } from "react";
import type { AgentAsk, AgentAnswers } from "../ipc/client";
import { H as translate } from "../compat/shared.js";
import { agentQuestions } from "../agents/question-data";
import "../agents/questions.css";

interface Props {
  ask: AgentAsk;
  where?: ReactNode;
  terminal?: ReactNode;
  onAnswer: (answers: AgentAnswers) => Promise<boolean>;
  onStep: (step: number) => void;
}

export function AgentQuestion({
  ask,
  where,
  terminal,
  onAnswer,
  onStep,
}: Props) {
  const [step, setStep] = React.useState(0);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [pending, setPending] = React.useState(false);
  const [expired, setExpired] = React.useState(
    !Number.isFinite(ask.until) || Date.now() >= ask.until,
  );
  const [failed, setFailed] = React.useState(false);
  const answers = React.useRef<AgentAnswers>(Object.create(null));
  const progress = React.useRef<HTMLDivElement>(null);
  const submitted = React.useRef(false);
  const activeAsk = React.useRef(ask.id);
  const activeStep = React.useRef(0);
  const questions = React.useMemo(
    () => agentQuestions(ask.questions),
    [ask.questions],
  );
  const question = questions[activeAsk.current === ask.id ? step : 0];
  React.useEffect(() => {
    setStep(0);
    setSelected([]);
    answers.current = Object.create(null);
    submitted.current = false;
    activeAsk.current = ask.id;
    activeStep.current = 0;
    setPending(false);
    setFailed(false);
  }, [ask.id]);
  React.useEffect(() => {
    const duration = Math.max(0, ask.until - Date.now());
    setExpired(!Number.isFinite(duration) || duration <= 0);
    if (!Number.isFinite(duration)) return;
    const deadline = window.setTimeout(
      () => setExpired(true),
      Math.min(duration, 2147483647),
    );
    const animation = progress.current?.animate(
      [
        { transform: `scaleX(${Math.min(1, duration / 120000)})` },
        { transform: "scaleX(0)" },
      ],
      { duration, fill: "forwards", easing: "linear" },
    );
    return () => {
      animation?.cancel();
      window.clearTimeout(deadline);
    };
  }, [ask.until]);
  if (!question)
    return (
      <div
        data-agent-ask="question"
        className="wi-agent-question flex h-full flex-col justify-center gap-2 px-4"
      >
        <p className="text-[12px] text-ink-2">
          {translate(
            "Этот вопрос лучше открыть в терминале",
            "Open this question in the terminal",
          )}
        </p>
        {terminal}
      </div>
    );
  const commit = async (labels: string[]) => {
    if (
      submitted.current ||
      expired ||
      Date.now() >= ask.until ||
      activeStep.current !== step
    )
      return;
    setFailed(false);
    answers.current[question.question] = question.multiSelect
      ? labels
      : labels[0];
    if (step + 1 < questions.length) {
      activeStep.current = step + 1;
      setStep(step + 1);
      onStep(step + 1);
      setSelected([]);
    } else {
      const request = ask.id;
      submitted.current = true;
      setPending(true);
      try {
        if (
          !(await onAnswer({ ...answers.current })) &&
          activeAsk.current === request
        ) {
          submitted.current = false;
          setFailed(true);
        }
      } catch {
        if (activeAsk.current === request) {
          submitted.current = false;
          setFailed(true);
        }
      } finally {
        if (activeAsk.current === request) setPending(false);
      }
    }
  };
  const agent =
    ask.agent === "codex"
      ? "Codex"
      : ask.agent === "opencode"
        ? "opencode"
        : "Claude";
  return (
    <div
      data-agent-ask="question"
      className="wi-agent-question relative flex h-full flex-col gap-2 px-4 pt-3 pb-4"
    >
      <div className="wi-agent-question-header flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-[#ffb340]/20 text-[#ffb340]"
        >
          ?
        </span>
        <div className="min-w-0 flex-1 truncate text-[12px] text-ink-2">
          <span className="text-[13px] font-semibold text-ink">
            {translate(`${agent} спрашивает`, `${agent} asks`)}
          </span>
          {where}
          {questions.length > 1 && (
            <span className="ml-2 text-ink-3">
              {step + 1}/{questions.length}
            </span>
          )}
        </div>
        {terminal}
      </div>
      <div
        className="wi-agent-question-text line-clamp-2 text-[13.5px] leading-snug font-semibold text-ink"
        title={question.question}
      >
        {question.question}
      </div>
      <div
        role="group"
        aria-label={question.header || question.question}
        className="wi-agent-question-options flex flex-col gap-1"
      >
        {question.options.map((choice) => {
          const checked = selected.includes(choice.label);
          return (
            <button
              key={choice.label}
              type="button"
              data-ask-choice={choice.label}
              aria-pressed={question.multiSelect ? checked : undefined}
              disabled={pending || expired || submitted.current}
              onClick={() =>
                question.multiSelect
                  ? setSelected((current) =>
                      checked
                        ? current.filter((label) => label !== choice.label)
                        : [...current, choice.label],
                    )
                  : commit([choice.label])
              }
              className="wi-agent-question-choice press flex shrink-0 items-center gap-2 rounded-lg px-2.5 text-left"
            >
              {question.multiSelect && (
                <span
                  aria-hidden
                  style={{
                    borderColor: checked ? "transparent" : "var(--color-line)",
                  }}
                  className={`grid size-4 shrink-0 place-items-center rounded-[5px] border ${checked ? "bg-ink text-island" : ""}`}
                >
                  {checked ? "✓" : ""}
                </span>
              )}
              <span className="min-w-0 flex-1 flex flex-col">
                <span className="wi-agent-question-label text-[12.5px] font-semibold text-ink">
                  {choice.label}
                </span>
                {choice.description && (
                  <span
                    className="wi-agent-question-description text-[11.5px] text-ink-3"
                    title={choice.description}
                  >
                    {choice.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {question.multiSelect && (
        <button
          type="button"
          data-ask-done
          disabled={!selected.length || pending || expired || submitted.current}
          onClick={() => commit(selected)}
          className="press h-8 shrink-0 rounded-lg bg-ink text-[12.5px] font-semibold text-island disabled:opacity-40"
        >
          {translate("Готово", "Done")}
        </button>
      )}
      {(pending || failed || expired) && (
        <p role="status" className="wi-agent-question-status">
          {expired
            ? translate("Время ответа истекло", "The request expired")
            : pending
              ? translate("Отправляю ответ…", "Sending answer…")
              : translate(
                  "Ответ не отправился. Попробуй ещё раз",
                  "Answer was not sent. Try again",
                )}
        </p>
      )}
      <div
        ref={progress}
        className="absolute right-4 bottom-1.5 left-4 h-[2px] origin-left rounded-full opacity-80"
        style={{ background: "var(--color-timer)" }}
      />
    </div>
  );
}
