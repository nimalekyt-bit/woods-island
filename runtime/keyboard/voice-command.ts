const openingWords = new Set([
  'пожалуйста', 'открой', 'открыть', 'запусти', 'запустить', 'включи', 'включить',
  'покажи', 'показать', 'поставь', 'поставить', 'установи', 'установить',
  'сделай', 'сделать', 'создай', 'создать', 'добавь', 'добавить',
  'задай', 'настрой', 'настроить', 'начни', 'начать',
  'please', 'open', 'launch', 'start', 'run', 'show', 'set', 'create', 'make', 'add', 'put', 'enable', 'activate',
]);
const toggleVerbs = new Set([
  'выключи', 'выключить', 'отключи', 'отключить', 'переключи', 'переключить',
  'смени', 'сменить', 'поменяй', 'поменять', 'убери', 'убрать',
  'toggle', 'switch', 'mute', 'unmute', 'disable',
]);
const multiWordVerbs = /^(?:turn\s+(?:on|off)|shut\s+down)\s+/iu;
const powerTarget = /^(?:компьютер|комп|пк|ноутбук|computer|pc|the\s+computer|the\s+pc)(?=\s|$)/iu;
const applicationWords = new Set(['приложение', 'программу', 'программа', 'игру', 'игра', 'the', 'app', 'application', 'program', 'game']);
const prepositions = new Set(['в', 'во', 'на', 'по', 'для', 'к', 'с', 'со', 'из', 'о', 'об', 'про', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'the', 'a', 'an']);

const RU_UNITS: Record<string, number> = {
  ноль: 0, нуль: 0,
  один: 1, одна: 1, одну: 1, одно: 1, раз: 1,
  два: 2, две: 2, пару: 2, пара: 2,
  три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9,
  десять: 10, одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14,
  пятнадцать: 15, шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19,
};
const RU_TENS: Record<string, number> = {
  двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50,
  шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90,
};
const RU_HUNDREDS: Record<string, number> = {
  сто: 100, двести: 200, триста: 300, четыреста: 400, пятьсот: 500,
};
const EN_UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const EN_TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

export function replaceSpokenNumbers(text: string): string {
  const normalized = text
    .replace(/(^|\s)полминуты(?=\s|$)/giu, '$130 секунд')
    .replace(/(^|\s)пол\s*часа(?=\s|$)/giu, '$130 минут')
    .replace(/(^|\s)полтора\s+часа(?=\s|$)/giu, '$190 минут')
    .replace(/(^|\s)полторы\s+минуты(?=\s|$)/giu, '$190 секунд')
    .replace(/(^|\s)half\s+a\s+minute(?=\s|$)/giu, '$130 seconds');
  const tokens = normalized.split(/(\s+)/);
  const out: string[] = [];
  let i = 0;
  const wordAt = (idx: number) => tokens[idx]?.toLowerCase().replace(/ё/g, 'е') ?? '';
  while (i < tokens.length) {
    if (i % 2 === 1) {
      out.push(tokens[i]);
      i++;
      continue;
    }
    const w = wordAt(i);
    if (w in RU_HUNDREDS || w in RU_TENS || w in RU_UNITS || w in EN_TENS || w in EN_UNITS) {
      let total = 0;
      let consumed = 0;
      let j = i;
      const pushNext = (map: Record<string, number>) => {
        const key = wordAt(j);
        if (key in map) {
          total += map[key];
          consumed = j - i + 1;
          j += 2;
          return true;
        }
        return false;
      };
      if (w in RU_HUNDREDS || w in RU_TENS || w in RU_UNITS) {
        pushNext(RU_HUNDREDS);
        if (!pushNext(RU_UNITS)) {
          if (pushNext(RU_TENS)) pushNext(RU_UNITS);
        }
      } else {
        if (pushNext(EN_TENS)) pushNext(EN_UNITS);
        else if (wordAt(i) in EN_UNITS) {
          pushNext(EN_UNITS);
          if (wordAt(j) === 'hundred') {
            total *= 100;
            consumed = j - i + 1;
            j += 2;
            if (pushNext(EN_TENS)) pushNext(EN_UNITS);
            else pushNext(EN_UNITS);
          }
        }
      }
      if (consumed > 0) {
        out.push(String(total));
        i += consumed;
        continue;
      }
    }
    out.push(tokens[i]);
    i++;
  }
  return out.join('');
}

const CYR_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

const APP_SYNONYMS: Record<string, string> = {
  хром: 'chrome', эдж: 'edge', ворд: 'word', эксель: 'excel', пауэрпоинт: 'powerpoint',
  блокнот: 'notepad', ноутпад: 'notepad', калькулятор: 'calculator', проводник: 'explorer',
  впн: 'vpn', обс: 'obs', чатгпт: 'chatgpt', джемини: 'gemini', гемини: 'gemini',
  дипсик: 'deepseek', вскод: 'vscode', зум: 'zoom', скайп: 'skype', ватсап: 'whatsapp',
  вайбер: 'viber', стим: 'steam', спотифай: 'spotify', дискорд: 'discord',
  телеграм: 'telegram', обсидиан: 'obsidian', яндекс: 'yandex', браузер: 'browser',
  музыка: 'music', музыку: 'music', музыки: 'music',
};

const RU_VOWEL_STEM = /[аяуюоеыи]$/u;
export function normalizeRuStem(word: string): string {
  const w = word.toLowerCase().replace(/ё/g, 'е');
  if (/[а-я]/.test(w) && w.length >= 5) return w.replace(RU_VOWEL_STEM, '');
  return w;
}

export function phoneticSkeleton(word: string): string {
  const lower = word.toLowerCase().replace(/ё/g, 'е').trim();
  if (!lower) return '';
  if (lower in APP_SYNONYMS) return phoneticSkeleton(APP_SYNONYMS[lower]);
  let latin = '';
  for (const ch of lower) latin += CYR_MAP[ch] ?? ch;
  return latin
    .replace(/ph/g, 'f')
    .replace(/qu/g, 'kv')
    .replace(/cks|ck/g, 'k')
    .replace(/kh/g, 'h')
    .replace(/th/g, 't')
    .replace(/ee|ea/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/ay|ey|ai/g, 'y')
    .replace(/w/g, 'v')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/(.)\1+/g, '$1');
}

export function cleanTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[:—–.,!?()/_"'«»`~|\\-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeVoiceCommand(text: string): string {
  let cleaned = text.trim().replace(/[.!?…,;:«»"]+$/gu, '').replace(/^[,;:«»"]+/gu, '').replace(/,/g, ' ').trim();
  if (!cleaned) return '';
  if (!/^(?:turn\s+off|shut\s+down)\s+(?:the\s+)?(?:computer|pc)\b/iu.test(cleaned)) {
    cleaned = cleaned.replace(multiWordVerbs, '');
  }
  const words = cleaned.split(/\s+/).filter(Boolean);
  let opening = false;
  while (words.length > 1) {
    const first = words[0].toLowerCase();
    const rest = words.slice(1).join(' ');
    if (openingWords.has(first)) {
      words.shift();
      opening = true;
      continue;
    }
    if (toggleVerbs.has(first) && !powerTarget.test(rest)) {
      words.shift();
      opening = true;
      continue;
    }
    break;
  }
  if (words.length > 1 && ['пожалуйста', 'please'].includes(words.at(-1)!.toLowerCase())) words.pop();
  if (opening) {
    while (words.length > 1 && applicationWords.has(words[0].toLowerCase()) && !['Game', 'App', 'Program'].includes(words[0])) words.shift();
    while (words.length > 1 && applicationWords.has(words.at(-1)!.toLowerCase()) && !['Game', 'App', 'Program'].includes(words.at(-1)!)) words.pop();
  }
  return words.join(' ');
}

function tokenMatches(queryTok: string, targetTok: string): boolean {
  if (queryTok === targetTok) return true;
  if (queryTok.length >= 4 && normalizeRuStem(queryTok) === normalizeRuStem(targetTok)) return true;
  const qp = phoneticSkeleton(queryTok), tp = phoneticSkeleton(targetTok);
  return qp.length >= 3 && qp === tp;
}

export function scoreVoiceSearch(target: string, query: string): number {
  const qTokens = cleanTokens(query);
  const tTokens = cleanTokens(target);
  if (!qTokens.length || !tTokens.length) return 0;
  if (qTokens.length === 1) {
    const q = qTokens[0], qp = phoneticSkeleton(q);
    if (tTokens.some((tok) => tok === q || (qp.length >= 3 && phoneticSkeleton(tok) === qp))) return 92;
    if (q.length >= 3 && qp.length >= 3 && tTokens.some((tok) => phoneticSkeleton(tok).startsWith(qp))) return 72;
    if (q.length >= 4 && normalizeRuStem(q).length >= 4 && tTokens.some((tok) => normalizeRuStem(tok) === normalizeRuStem(q))) return 76;
    return 0;
  }
  const matched = qTokens.filter((q) => tTokens.some((t) => tokenMatches(q, t) || (q.length >= 3 && phoneticSkeleton(t).startsWith(phoneticSkeleton(q)))));
  if (matched.length === qTokens.length) return 88;
  return 0;
}

export function scoreActionKeywords(title: string, keywords: string, query: string): number {
  const qTokens = cleanTokens(query).filter((w) => !prepositions.has(w));
  const titleTokens = cleanTokens(title);
  const kwTokens = cleanTokens(keywords);
  const pool = [...titleTokens, ...kwTokens];
  if (!qTokens.length || !pool.length) return 0;
  if (!qTokens.every((q) => pool.some((p) => tokenMatches(q, p)))) return 0;
  if (qTokens.every((q) => titleTokens.some((t) => tokenMatches(q, t)))) {
    return tokenMatches(qTokens[0], titleTokens[0]) ? 100 : 96;
  }
  const titleHits = qTokens.filter((q) => titleTokens.some((t) => tokenMatches(q, t))).length;
  return titleHits > 0 ? 88 + Math.min(6, titleHits * 2) : 84;
}

const unsafeTitlePatterns = /^(?:заблокировать компьютер|lock the computer|спящий режим|sleep|перезагрузить компьютер|restart the computer|выключить компьютер|shut down the computer)/iu;

export function canRunVoiceResult(key: string, title: string, query: string, keywords?: string): boolean {
  if (['timer', 'remind', 'calc', 'unit', 'money', 'brightness', 'volume', 'qr-text'].includes(key)) return true;
  if (['web', 'ai', 'shell', 'sh-cmd', 'sh-ps', 'shutdown', 'restart', 'power', 'power-cancel'].includes(key)) return false;
  if (!key.startsWith('p') && !key.startsWith('a')) return false;
  if (key.startsWith('a') && unsafeTitlePatterns.test(title.trim())) return false;

  const qRaw = query.trim().toLocaleLowerCase();
  const tRaw = title.trim().toLocaleLowerCase();
  if (qRaw.length < 3) return false;

  const qTokens = cleanTokens(qRaw);
  const tTokens = cleanTokens(tRaw);
  if (!qTokens.length || !tTokens.length) return false;

  const prefixMatch = (a: string[], b: string[], eq: (x: string, y: string) => boolean) =>
    a.length <= b.length && a.every((tok, idx) => eq(tok, b[idx]));

  if (
    prefixMatch(qTokens, tTokens, tokenMatches) ||
    prefixMatch(tTokens, qTokens, tokenMatches)
  ) {
    return true;
  }

  if (key.startsWith('a') && keywords) {
    const kWords = qTokens.filter((w) => !prepositions.has(w));
    const pool = cleanTokens(`${title} ${keywords}`);
    if (kWords.length > 0 && kWords.every((q) => pool.some((p) => tokenMatches(q, p)))) {
      return true;
    }
  }
  return false;
}
