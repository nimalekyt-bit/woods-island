const freeCharacters = new Set(['liquid', 'none', 'pixel', 'spark', 'eyes']);
export const isFreeCharacter = (id: string) => freeCharacters.has(id);

export function resolveCharacter(id: string | null | undefined, allCharacters: boolean): string {
  const selected = id || 'liquid';
  return allCharacters || isFreeCharacter(selected) ? selected : 'liquid';
}

export function hasLiquidIsland(kind: string, liquidWith: boolean, allCharacters: boolean): boolean {
  // “No character” is an explicit plain island choice, including during pause.
  return kind !== 'none' && (kind === 'liquid' || (liquidWith === true && allCharacters));
}

export function selectCharacter(
  settings: { character?: string; characterMusic?: string } | null | undefined,
  allCharacters: boolean,
  playing: boolean,
): string {
  const music = playing && settings?.characterMusic &&
    (allCharacters || isFreeCharacter(settings.characterMusic)) ? settings.characterMusic : null;
  return resolveCharacter(music ?? settings?.character, allCharacters);
}
