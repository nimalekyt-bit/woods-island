/** Quick actions preserve the payload's spelling and never invoke a shell. */
export function qrCommand(text: string): string | null {
  const payload = /^(?:qr|qrcode|кьюар|куар)(?:[\s-]*(?:код|code))?\s*[:-]?\s+(.+)$/isu.exec(text.trim())?.[1].trim();
  return payload && !/^(код|code)$/iu.test(payload) ? payload : null;
}
export function brightnessCommand(text: string): number | null {
  const match = /^(?:яркость|brightness)\s+(?:(?:на|to)\s+)?(\d{1,3})\s*%?$/iu.exec(text.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return value <= 100 ? value : null;
}
export function keepPlayingMusic(state: {settings?: {autoHideMusic?: boolean;moduleMedia?: boolean}|null;mediaLive?: boolean;media?: {playing?: boolean}|null}): boolean {
  return state.settings?.autoHideMusic === true && state.settings.moduleMedia !== false && state.mediaLive === true && state.media?.playing === true;
}
