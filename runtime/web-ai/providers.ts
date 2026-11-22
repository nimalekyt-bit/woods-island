export const webChatProviders = [
  {id: 'chatgpt', label: 'ChatGPT'},
  {id: 'gemini', label: 'Gemini'},
  {id: 'deepseek', label: 'DeepSeek'},
] as const;

export function webChatService(value: unknown): string {
  return webChatProviders.some(provider => provider.id === value) ? value as string : 'island';
}
