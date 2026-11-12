import type { CharacterDefinition } from './catalog';
import bitmapMetadata from './approved-bitmap.json';
import codexTiming from './codex-timing.json';
import { CODEX_IDS, validateSprite, type BitmapDefinition } from './bitmap';

const english: Record<string, [string, string]> = {
  'artifact-foldling': ['Foldling', 'A paper theatre hides inside an old atlas.'],
  'artifact-knotling': ['Knotling', 'Comes undone when tickled, then pretends it meant to.'],
  'noct-manta': ['Lunar Noct', 'A velvet moonlit manta. Folds its emerald wings and greets you with a gentle flap.'],
  'iskorka-cat': ['Iskorka', 'A ginger kitten with soft paws and an amber star. Plays, waves its tail and falls asleep beside you.'],
  'null-star-thief': ['Null', 'Steals stars and acts innocent.'],
  'paradox-fold': ['Paradox', 'Folds the impossible. Sometimes itself.'],
  kryazhik: ['Kryazhik', 'A living piece of the forest. Grows a leaf and bows when touched.'],
  nokt: ['Noct', 'A night glider with velvet wings and a small constellation on its belly.'],
  latunchik: ['Latunchik', 'A stubborn brass beetle with leather bellows. Greets you with a tiny flag from its horn.'],
  shursh: ['Shursh', 'A folded paper creature. Collects silence in its accordion body and fans out its tail.'],
  skol: ['Skol', 'A quartz crab with a cracked crown. Hides its claws shyly, then clicks them like castanets.'],
};

export const approvedDefinitions: CharacterDefinition[] = [
  ...bitmapMetadata.map(character => ({ ...character, kind: 'slot' as const, group: 'creatures' as const,
    bitmap: validateSprite(character.bitmap as BitmapDefinition) })),
  ...CODEX_IDS.map(id => ({
    id: `codex-pet-${id}`, name: id === 'null-signal' ? 'Null Signal' : id === 'bsod' ? 'BSOD' : id[0].toUpperCase() + id.slice(1),
    desc: 'Питомец из установленного OpenAI Codex. Рисунок импортируется локально.',
    kind: 'slot' as const, group: 'codex' as const,
    bitmap: validateSprite({ source: 'codex', file: id, frameWidth:192, frameHeight:208, columns:8, rows:11,
      animations: codexTiming, lookDirections:16 }),
  })),
].map(character => {
  const [name, desc] = english[character.id] ?? [character.name,
    'A pet from your installed OpenAI Codex. Its artwork is imported locally.'];
  return { ...character, translations: { en: { name, desc } } };
});
