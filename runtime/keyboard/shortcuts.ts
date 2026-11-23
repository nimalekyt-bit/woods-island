export interface KeyInput {
  code: string;
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}
export interface ShortcutBinding {
  value: string;
  label: string;
}
const labels: Record<string, [string, string]> = {
  hotkeyToggle: ["Открыть остров", "Toggle island"],
  hotkeyPalette: ["Командная строка", "Command bar"],
  hotkeyChat: ["Открыть чат", "Open chat"],
  hotkeyDictate: ["Голос в текст", "Voice to text"],
  hotkeyVoiceCommand: ["Голосовая команда", "Voice command"],
  hotkeyRecord: ["Запись экрана", "Screen recording"],
  hotkeyArea: ["Скриншот области", "Area screenshot"],
  hotkeyScreen: ["Скриншот экрана", "Screen screenshot"],
  hotkeyOcr: ["Текст с экрана", "Text from screen"],
  hotkeyClipboard: ["Буфер обмена", "Clipboard"],
  hotkeyPlainPaste: ["Вставка без оформления", "Paste plain text"],
  hotkeyMic: ["Микрофон", "Microphone"],
  hotkeyColor: ["Пипетка", "Color picker"],
  hotkeyQr: ["QR-код", "QR code"],
  hotkeyThrough: ["Сквозной режим", "Click through"],
  hotkeyVpn: ["VPN", "VPN"],
  hotkeyMediaPill: ["Вид плеера в пилюле", "Music pill style"],
  hotkeyWebAi: ["Окно веб-чата", "Web chat window"],
  hotkeyTheme: ["Тема острова", "Island theme"],
  hotkeyFullscreen: ["Скрытие над полным экраном", "Fullscreen visibility"],
};
export function shortcutBindings(
  settings: Record<string, unknown>,
  translate: (ru: string, en: string) => string,
): ShortcutBinding[] {
  return Object.entries(settings)
    .filter(
      ([key, value]) =>
        key.startsWith("hotkey") && typeof value === "string" && value,
    )
    .map(([key, value]) => ({
      value: value as string,
      label: labels[key] ? translate(...labels[key]) : key,
    }));
}
const codes: Record<string, string> = {
  Space: "Space",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
  Backquote: "Backquote",
  Minus: "Minus",
  Equal: "Equal",
  BracketLeft: "BracketLeft",
  BracketRight: "BracketRight",
  Semicolon: "Semicolon",
  Quote: "Quote",
  Comma: "Comma",
  Period: "Period",
  Slash: "Slash",
  Backslash: "Backslash",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  PrintScreen: "PrintScreen",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  Pause: "Pause",
  CapsLock: "CapsLock",
  NumLock: "NumLock",
  ScrollLock: "ScrollLock",
};
export function modifiers(event: KeyInput) {
  return [
    event.ctrlKey && "Ctrl",
    event.altKey && "Alt",
    event.shiftKey && "Shift",
    event.metaKey && "Super",
  ].filter(Boolean) as string[];
}
export function shortcutKey(code: string) {
  return /^Key[A-Z]$/.test(code)
    ? code.slice(3)
    : /^Digit\d$/.test(code)
      ? code.slice(5)
      : /^F(?:[1-9]|1\d|2[0-4])$/.test(code) ||
          /^Numpad(?:\d|Add|Subtract|Multiply|Divide|Decimal|Enter|Equal)$/.test(
            code,
          )
        ? code
        : codes[code];
}
export function readShortcut(event: KeyInput): {
  kind:
    | "cancel"
    | "clear"
    | "modifier"
    | "missingModifier"
    | "unsupported"
    | "navigate"
    | "save";
  value: string;
} {
  if (event.key === "Escape") return { kind: "cancel", value: "" };
  const held = modifiers(event),
    key = shortcutKey(event.code);
  if (!held.length && ["Backspace", "Delete"].includes(event.key))
    return { kind: "clear", value: "" };
  if (!held.length && event.code === "Tab")
    return { kind: "navigate", value: "" };
  if (/^(?:Control|Alt|Shift|Meta|OS)(?:Left|Right)?$/.test(event.code))
    return { kind: "modifier", value: held.join("+") };
  if (!key) return { kind: "unsupported", value: held.join("+") };
  const value = [...held, key].join("+");
  if (!held.length && !/^F\d+$/.test(key) && key !== "PrintScreen")
    return { kind: "missingModifier", value };
  return { kind: "save", value };
}
const aliases: Record<string, string> = {
  control: "ctrl",
  commandorcontrol: "ctrl",
  cmdorctrl: "ctrl",
  win: "super",
  windows: "super",
  meta: "super",
  command: "super",
  cmd: "super",
  " ": "space",
  esc: "escape",
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  "`": "backquote",
  "-": "minus",
  "=": "equal",
  "[": "bracketleft",
  "]": "bracketright",
  ";": "semicolon",
  "'": "quote",
  ",": "comma",
  ".": "period",
  "/": "slash",
  "\\": "backslash",
};
export function canonicalShortcut(value: string) {
  const parts = value
    .split("+")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .map((v) => aliases[v] || v.replace(/^key(?=[a-z]$)|^digit(?=\d$)/, ""));
  const order = ["ctrl", "alt", "shift", "super"];
  return [
    ...order.filter((mod) => parts.includes(mod)),
    ...parts.filter((key) => !order.includes(key)),
  ].join("+");
}
export function shortcutConflict(
  value: string,
  current: string,
  bindings: ShortcutBinding[],
) {
  const canonical = canonicalShortcut(value);
  if (!canonical || canonical === canonicalShortcut(current)) return null;
  return (
    bindings.find((binding) => canonicalShortcut(binding.value) === canonical)
      ?.label ?? null
  );
}
export function shortcutDisplay(value: string) {
  return value
    .split("+")
    .map((key) =>
      key === "Super"
        ? "Win"
        : key.startsWith("Numpad")
          ? "Num " + key.slice(6)
          : (
              {
                Space: "Space",
                Backquote: "`",
                Minus: "-",
                Equal: "=",
                BracketLeft: "[",
                BracketRight: "]",
                Semicolon: ";",
                Quote: "'",
                Comma: ",",
                Period: ".",
                Slash: "/",
                Backslash: "\\",
              } as Record<string, string>
            )[key] || key,
    );
}
