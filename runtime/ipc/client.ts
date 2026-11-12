import type { JsonValue, RustCommands, Settings } from './generated';

export interface AgentChoice { label: string; description?: string }
export interface AgentQuestionData {
  question: string;
  header?: string;
  options: AgentChoice[];
  multiSelect: boolean;
}
export interface AgentAsk {
  id: string;
  kind: 'question';
  agent: string;
  project?: string;
  until: number;
  questions: AgentQuestionData[];
}
export type AgentAnswers = Record<string, string | string[]>;
export type Commands = Omit<RustCommands, 'settings_get' | 'settings_set' | 'agents_answer'> & {
  settings_get: { args: Record<string, never>; result: Settings };
  settings_set: { args: { settings: Partial<Settings> }; result: string[] };
  agents_answer: { args: { id: string; verdict: 'answer' | 'allow' | 'deny' | 'terminal'; answers?: AgentAnswers | null }; result: boolean };
};
declare global {
  interface Window {
    __TAURI_INTERNALS__: {
      invoke<T>(command: string, args?: object): Promise<T>;
      transformCallback(callback: (event: { payload: JsonValue }) => void): number;
    };
  }
}
export function invoke<K extends keyof Commands>(command: K, ...params: {} extends Commands[K]['args']
  ? [args?: Commands[K]['args']] : [args: Commands[K]['args']]): Promise<Commands[K]['result']> {
  return window.__TAURI_INTERNALS__.invoke(command, params[0] ?? {});
}
