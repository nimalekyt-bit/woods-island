// Metadata is maintained here; the recovered drawing implementations are injected.
import type { Drawing, DrawnCharacter } from './types';
export type CharacterKind = "liquid" | "none" | "attach" | "slot";
export type CharacterGroup = "island" | "characters" | "creatures" | "things";
export type CharacterBox = [number, number, number, number];
export interface CharacterDefinition {
  id: string;
  name: string;
  desc: string;
  kind: CharacterKind;
  group: CharacterGroup;
  puppet?: Drawing;
  generic?: boolean;
  box?: CharacterBox;
  face?: boolean;
}
export function createCharacterCatalog({
  creatures,
  things,
  renderers,
  language,
}: {
  creatures: DrawnCharacter[];
  things: DrawnCharacter[];
  renderers: Record<string, Drawing>;
  language: () => string;
}) {
  const boxes: Record<string, CharacterBox> = {
    hamster: [-36, -47, 72, 89],
    stick: [-31, -41, 62, 78],
    koi: [-80, -25, 160, 48],
    snail: [-62, -25, 124, 56],
    fire: [-27, -43, 54, 82],
    lava: [-26, -41, 52, 82],
    iris: [-39, -34, 78, 64],
    coffee: [-21, -50, 58, 80],
    cradle: [-68, -37, 136, 71],
    pulse: [-96, -42, 196, 58],
  };
  const describeCharacter =
    (group: CharacterGroup) =>
    (drawing: DrawnCharacter): CharacterDefinition => ({
      id: drawing.id,
      name: drawing.name,
      desc: drawing.desc,
      kind: drawing.outside ? "attach" : "slot",
      group: drawing.outside ? "island" : group,
      puppet: drawing,
      box: boxes[drawing.id],
      face: drawing.face === true,
    });
  const genericBox = (left: number, top: number, right: number, bottom: number): CharacterBox => {
    const halfWidth = Math.max(-left, right) + 10;
    return [-halfWidth, top - 12, halfWidth * 2, bottom + 6 - (top - 12)];
  };
  const catalog: CharacterDefinition[] = [
    {
      id: `liquid`,
      name: `Жидкий остров`,
      group: `island`,
      kind: `liquid`,
      desc: `Остров из магнитной жидкости: тянется к курсору, идёт шипами под музыку, роняет капли и глотает файлы.`,
    },
    ...creatures.filter((e) => e.outside).map(describeCharacter(`island`)),
    {
      id: `none`,
      name: `Без персонажа`,
      group: `island`,
      kind: `none`,
      desc: `Просто чёрный остров, как раньше.`,
    },
    {
      id: `pixel`,
      name: `Пиксель`,
      group: `characters`,
      kind: `slot`,
      desc: `8-битный герой. Оранжевый в покое, двигается по пикселям.`,
    },
    {
      id: `spark`,
      name: `Искра`,
      group: `characters`,
      kind: `slot`,
      puppet: renderers.spark,
      generic: !0,
      box: genericBox(-24, -24, 24, 24),
      desc: `Огонёк, который показывает настроение цветом.`,
    },
    {
      id: `eyes`,
      name: `Глазки`,
      group: `characters`,
      kind: `slot`,
      puppet: renderers.eyes,
      generic: !0,
      box: genericBox(-28, -18, 28, 25),
      desc: `Оживает сам остров: только глаза.`,
    },
    {
      id: `bot`,
      name: `Бот`,
      group: `characters`,
      kind: `slot`,
      puppet: renderers.bot,
      generic: !0,
      box: genericBox(-34, -38, 34, 22),
      desc: `Робот с экраном вместо лица и мигающей антенной.`,
    },
    {
      id: `cat`,
      name: `Котик`,
      group: `characters`,
      kind: `slot`,
      puppet: renderers.cat,
      generic: !0,
      box: genericBox(-30, -35, 30, 29),
      desc: `Мордочка с ушами и усами, колокольчик меняет цвет.`,
    },
    {
      id: `blob`,
      name: `Капля`,
      group: `characters`,
      kind: `slot`,
      puppet: renderers.blob,
      generic: !0,
      box: genericBox(-30, -26, 30, 18),
      desc: `Мягкое желе с румянцем, колышется под музыку.`,
    },
    {
      id: `jelly`,
      name: `Медуза`,
      group: `characters`,
      kind: `slot`,
      puppet: renderers.jelly,
      box: [-35, -40, 70, 79],
      desc: `Светится в тёмной воде, пульсирует, щупальца колышутся.`,
    },
    {
      id: `sloth`,
      name: `Ленивец`,
      group: `characters`,
      kind: `slot`,
      puppet: renderers.sloth,
      box: [-44, -66, 88, 88],
      desc: `Висит, уцепившись за край, и раскачивается.`,
    },
    {
      id: `astro`,
      name: `Космонавт`,
      group: `characters`,
      kind: `slot`,
      puppet: renderers.astro,
      box: [-47, -48, 94, 82],
      desc: `Парит в невесомости, цвет стекла шлема по настроению.`,
    },
    {
      id: `sprout`,
      name: `Росток`,
      group: `characters`,
      kind: `slot`,
      puppet: renderers.sprout,
      box: [-29, -46, 58, 77],
      desc: `Листья качаются, от радости распускается цветок.`,
    },
    {
      id: `swarm`,
      name: `Рой`,
      group: `characters`,
      kind: `slot`,
      puppet: renderers.swarm,
      box: [-52, -38, 104, 62],
      desc: `Стая частиц: волна, кольцо, галочка, «!».`,
    },
    {
      id: `kao`,
      name: `Каомодзи`,
      group: `characters`,
      kind: `slot`,
      puppet: renderers.kao,
      box: [-43, -34, 86, 50],
      desc: `Живая текстовая рожица (・ω・).`,
    },
    ...creatures.filter((e) => !e.outside).map(describeCharacter(`creatures`)),
    ...things.map(describeCharacter(`things`)),
  ];
  const english: Record<string, [string, string]> = {
    liquid: [
      `Liquid island`,
      `An island of ferrofluid: reaches for the cursor, spikes to the music, drips and swallows files.`,
    ],
    tail: [
      `Tail`,
      `Someone lives in the island, but only the tail shows. Wags to the music, curls into a question mark, puffs up when alarmed.`,
    ],
    legs: [
      `Island on legs`,
      `The island itself is the character: eyes inside, legs dangling below. Swings them, taps the beat, hops.`,
    ],
    none: [`No character`, `Just a black island, like before.`],
    pixel: [`Pixel`, `An 8-bit hero. Orange at rest, moves pixel by pixel.`],
    spark: [`Spark`, `A little flame that shows its mood in colour.`],
    eyes: [`Eyes`, `The island itself comes alive: just the eyes.`],
    bot: [`Bot`, `A robot with a screen for a face and a blinking antenna.`],
    cat: [`Kitty`, `A face with ears and whiskers; the bell changes colour.`],
    blob: [`Blob`, `Soft jelly with rosy cheeks, wobbles to the music.`],
    jelly: [`Jellyfish`, `Glows in dark water, pulses, tentacles sway.`],
    sloth: [`Sloth`, `Hangs on to the edge and sways.`],
    astro: [`Astronaut`, `Floats in zero gravity; the visor colour follows the mood.`],
    sprout: [`Sprout`, `Leaves sway, and a flower blooms when it's happy.`],
    swarm: [`Swarm`, `A flock of particles: a wave, a ring, a check mark, a “!”.`],
    kao: [`Kaomoji`, `A living text face (・ω・).`],
    hamster: [
      `Hamster wheel`,
      `Runs in its wheel: the more you do, the faster. Races to the music, sleeps right in the wheel while you're away.`,
    ],
    stick: [
      `Stick figure`,
      `Drawn with a single line and says it all with its body: dances, scratches its chin, waves, dozes sitting up.`,
    ],
    koi: [
      `Koi`,
      `Swims from one end of the island to the other. Makes waves to the music, leaps for joy, sleeps on the bottom.`,
    ],
    snail: [
      `Snail`,
      `Crawls slowly across the island. Its horns stretch out of curiosity; when nobody's around it hides in its shell.`,
    ],
    fire: [
      `Campfire`,
      `A little flame with eyes. Dances to the music, flares up with joy, thinks in smoke rings, smoulders at night.`,
    ],
    lava: [
      `Lava lamp`,
      `Blobs of lava rise and merge in the glass. No face, but hypnotic. The lava colour follows the mood.`,
    ],
    iris: [
      `Lens`,
      `A living camera eye: the aperture blades narrow and open, blink, and spin while the AI thinks.`,
    ],
    coffee: [
      `Coffee`,
      `A mug with character. Steam dances to the music, forms a heart with joy, boils when alarmed, cools down in sleep.`,
    ],
    cradle: [
      `Newton's cradle`,
      `An office toy instead of a character. Balls click to the beat and run as a wave while the AI thinks. The middle ball sees everything.`,
    ],
    pulse: [
      `Pulse`,
      `The island's heart monitor. Beats to the music, races when alarmed, goes almost flat in sleep; brain waves run while the AI thinks.`,
    ],
  };
  if (new Set(catalog.map((character) => character.id)).size !== catalog.length)
    throw Error("Duplicate character ID");
  const fallback = catalog.find((character) => character.id === "none");
  if (!fallback) throw Error("Plain island definition missing");
  return {
    catalog,
    find: (id?: string | null): CharacterDefinition =>
      catalog.find((character) => character.id === id) ?? fallback,
    describe: (character: CharacterDefinition) => {
      const translated = language() === "en" ? english[character.id] : undefined;
      return translated
        ? { name: translated[0], desc: translated[1] }
        : { name: character.name, desc: character.desc };
    },
  };
}
