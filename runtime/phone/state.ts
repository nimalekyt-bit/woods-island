export const MAX_PHONE_FILE = 256 * 1024 * 1024;
export interface PhoneOffer {
  id: string;
  name: string;
  size: number;
  taken: boolean;
}
export interface PhonePending {
  id: string;
  device: string;
  expiresAt: number;
}
export interface PhoneState {
  running: boolean;
  url: string | null;
  network: string | null;
  public: boolean | null;
  connected: boolean;
  device: string | null;
  problem: string | null;
  pending: PhonePending | null;
  expiresAt: number | null;
  offered: PhoneOffer[];
}
export const EMPTY_PHONE: PhoneState = Object.freeze({
  running: false,
  url: null,
  network: null,
  public: null,
  connected: false,
  device: null,
  problem: null,
  pending: null,
  expiresAt: null,
  offered: [],
});
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown, max: number) =>
  typeof value === "string" && value.length <= max ? value : null;
const token = (value: unknown) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : null;
const time = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
export function phoneUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512) return null;
  try {
    const url = new URL(value),
      parts = url.hostname.split(".").map(Number);
    if (
      url.protocol !== "http:" ||
      url.username ||
      url.password ||
      url.pathname !== "/phone/" ||
      url.search ||
      !token(url.hash.slice(1)) ||
      parts.length !== 4 ||
      parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255) ||
      !url.port ||
      Number(url.port) < 1024
    )
      return null;
    if (
      !(
        parts[0] === 10 ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        parts[0] === 127
      )
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
export function phoneState(value: unknown): PhoneState {
  const source = record(value),
    pending = record(source.pending),
    offered = Array.isArray(source.offered) ? source.offered : [];
  const id = token(pending.id),
    device = text(pending.device, 60),
    expiresAt = time(pending.expiresAt);
  return {
    running: source.running === true,
    url: phoneUrl(source.url),
    network: text(source.network, 200),
    public: typeof source.public === "boolean" ? source.public : null,
    connected: source.connected === true,
    device: text(source.device, 60),
    problem: text(source.problem, 500),
    pending: id && device && expiresAt ? { id, device, expiresAt } : null,
    expiresAt: time(source.expiresAt),
    offered: offered.slice(0, 64).flatMap((value) => {
      const item = record(value),
        id = token(item.id),
        name = text(item.name, 300),
        size = item.size;
      return id &&
        name &&
        typeof size === "number" &&
        Number.isSafeInteger(size) &&
        size >= 0 &&
        size <= MAX_PHONE_FILE
        ? [{ id, name, size, taken: item.taken === true }]
        : [];
    }),
  };
}
export function phoneLinked(value: PhoneState | null): boolean {
  return value?.running === true && value.device !== null;
}
export interface ShelfProvenance {
  fromPhone: boolean;
  added: number | null;
}
export function shelfProvenance(item: unknown): ShelfProvenance {
  const value = record(item);
  return { fromPhone: value.fromPhone === true, added: time(value.added) };
}
export function shelfAge(
  added: number | null,
  now = Date.now(),
  lang: "ru" | "en" = "ru",
): string {
  if (!added || added > now + 60_000)
    return lang === "ru" ? "на полке" : "on the shelf";
  const minutes = Math.max(0, Math.floor((now - added) / 60000));
  if (minutes === 0) return lang === "ru" ? "сейчас" : "now";
  if (minutes < 60)
    return lang === "ru" ? `${minutes} мин назад` : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return lang === "ru" ? `${hours} ч назад` : `${hours} h ago`;
  return new Date(added).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "short",
  });
}
