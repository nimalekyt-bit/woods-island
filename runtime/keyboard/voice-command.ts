const openingWords = new Set(['пожалуйста', 'открой', 'открыть', 'запусти', 'запустить', 'включи', 'включить', 'покажи', 'показать', 'please', 'open', 'launch', 'start', 'run', 'show']);
export function normalizeVoiceCommand(text: string): string {
  const words = text.trim().replace(/[.!?…,]+$/u, '').replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  while (words.length > 1 && openingWords.has(words[0].toLowerCase())) words.shift();
  if (words.length > 1 && ['пожалуйста', 'please'].includes(words.at(-1)!.toLowerCase())) words.pop();
  return words.join(' ');
}
export function canRunVoiceResult(key: string, title: string, query: string): boolean {
  if (['timer', 'remind', 'calc', 'unit', 'money'].includes(key)) return true;
  if (['web', 'ai', 'shell', 'shutdown', 'restart', 'power'].includes(key)) return false;
  if (!key.startsWith('p') && !key.startsWith('a')) return false;
  const phrase = query.trim().toLocaleLowerCase(), label = title.trim().toLocaleLowerCase();
  const begins = (full: string, start: string) => full === start || full.startsWith(start + ' ');
  return phrase.length >= 3 && (begins(label, phrase) || begins(phrase, label));
}
