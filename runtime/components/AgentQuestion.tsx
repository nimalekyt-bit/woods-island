import { React } from '../react';
import type { ReactNode } from 'react';
import type { AgentAsk, AgentAnswers } from '../ipc/client';
import { H as translate } from '../compat/shared.js';

interface Props {
  ask: AgentAsk;
  where?: ReactNode;
  terminal?: ReactNode;
  onAnswer: (answers: AgentAnswers) => Promise<boolean>;
  onStep: (step: number) => void;
}

export function AgentQuestion({ ask, where, terminal, onAnswer, onStep }: Props) {
  const [step, setStep] = React.useState(0);
  const [selected, setSelected] = React.useState<string[]>([]);
  const answers = React.useRef<AgentAnswers>({});
  const progress = React.useRef<HTMLDivElement>(null);
  const submitted = React.useRef(false);
  const question = ask.questions[step];
  React.useEffect(() => {
    setStep(0); setSelected([]); answers.current = {}; submitted.current = false;
  }, [ask.id]);
  React.useEffect(() => {
    const duration = Math.max(0, ask.until - Date.now());
    const animation = progress.current?.animate([
      { transform: `scaleX(${Math.min(1, duration / 120000)})` }, { transform: 'scaleX(0)' },
    ], { duration, fill: 'forwards', easing: 'linear' });
    return () => animation?.cancel();
  }, [ask.until]);
  if (!question) return null;
  const commit = async (labels: string[]) => {
    if (submitted.current || Date.now() >= ask.until) return;
    answers.current[question.question] = question.multiSelect ? labels : labels[0];
    if (step + 1 < ask.questions.length) { setStep(step + 1); onStep(step + 1); setSelected([]); }
    else { submitted.current = true; if (!await onAnswer({ ...answers.current })) submitted.current = false; }
  };
  return <div data-agent-ask="question" className="relative flex h-full flex-col gap-2 px-4 pt-3 pb-4">
    <div className="flex items-center gap-3">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-[#ffb340]/20 text-[#ffb340]">?</span>
      <div className="min-w-0 flex-1 truncate text-[12px] text-ink-2">
        <span className="text-[13px] font-semibold text-ink">{translate('Claude спрашивает', 'Claude asks')}</span>
        {where}{ask.questions.length > 1 && <span className="ml-2 text-ink-3">{step + 1}/{ask.questions.length}</span>}
      </div>{terminal}
    </div>
    <div className="line-clamp-2 text-[13.5px] leading-snug font-semibold text-ink">{question.question}</div>
    <div role="group" aria-label={question.header || question.question} className="flex flex-col gap-1">
      {question.options.map(choice => {
        const checked = selected.includes(choice.label);
        return <button key={choice.label} type="button" data-ask-choice={choice.label}
          aria-pressed={question.multiSelect ? checked : undefined}
          onClick={() => question.multiSelect
            ? setSelected(current => checked ? current.filter(label => label !== choice.label) : [...current, choice.label])
            : commit([choice.label])}
          className={`press flex h-[34px] shrink-0 items-center gap-2 rounded-lg px-2.5 text-left ${checked ? 'bg-white/16' : 'bg-white/7 hover:bg-white/12'}`}>
          {question.multiSelect && <span aria-hidden className={`grid size-4 shrink-0 place-items-center rounded-[5px] border ${checked ? 'border-transparent bg-ink text-island' : 'border-white/30'}`}>{checked ? '✓' : ''}</span>}
          <span className="shrink-0 text-[12.5px] font-semibold text-ink">{choice.label}</span>
          {choice.description && <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-3">{choice.description}</span>}
        </button>;
      })}
    </div>
    {question.multiSelect && <button type="button" data-ask-done disabled={!selected.length} onClick={() => commit(selected)}
      className="press h-8 shrink-0 rounded-lg bg-ink text-[12.5px] font-semibold text-island disabled:opacity-40">{translate('Готово', 'Done')}</button>}
    <div ref={progress} className="absolute right-4 bottom-1.5 left-4 h-[2px] origin-left rounded-full opacity-80" style={{ background: 'var(--color-timer)' }} />
  </div>;
}
