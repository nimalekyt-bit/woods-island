# Character release audit

Scope: every character release row through upstream 1.2.12, plus character clauses in multi-feature release rows. Woods artwork, existing bitmap pets, language support and free access are preserved. This is a source/proof inventory, not a claim that native acceptance is complete.

| Release rows | Woods implementation | Proof / integration still required |
| --- | --- | --- |
| v1.2.12-05, v1.2.11-03 | Five original Woods seasonal vector characters: snowman, frost, bullfinch, ginger, deer. Holiday group, own colors and Russian/English descriptions. | `seasonal-character.test.cjs`; `character-browser-acceptance.cjs`; shared settings holiday section integrated by root. |
| v1.2.12-26, v1.2.11-24 | `liquid.ts`: lower quarter-circle arcs tangent to the sides, wave begins/ends inside the corners. Content clip uses the same geometry. | `liquid-engine.test.cjs`: explicit body paths and exercised celebration clip; historical physics trace preserved independently. |
| v1.2.12-18, v1.2.11-16 (character clause) | Attention mood and badge supported by `CharacterSprite`, `PixelCharacter`, bitmap sprite and attached characters. Root integrated the selected character with attention mood in timer/reminder peeks. | Card event flow still needs combined UI acceptance. |
| v1.2.10-07 | `selection.ts:hasLiquidIsland`; shared island uses `settings.liquidWith`. | Root free-access integration makes this available to every character. Combined app UI proof required. |
| v1.2.9-09 | `characterSize`, `characterRestWidth`, `characterSlotWidth`; 34px and 44px folded character modes. | `island-sizing.test.cjs`; browser fixture checks actual renderer at 60×34 and 80×44. Shared home/island/settings wiring exists. |
| v1.2.8-01 | Own Woods icon is retained. The upstream icon is not copied into Woods branding. | Root branding audit must verify icon, installer, tray and About surfaces. |
| v1.2.8-09, v1.2.5-09, v1.2.2-01 | Liquid envelope, transient detection, fresh frequency bands, spectrum blending and stale audio decay; `PixelCharacter`/bitmap receive music level. | `liquid-engine.test.cjs` proves signal-to-geometry behavior. Player/mixer transport is native media scope and requires native acceptance. |
| v1.2.8-11 | `selection.ts:selectCharacter` supports alternate `characterMusic` selection. | `character-state.test.cjs`; settings and native playback events need combined proof. |
| v1.2.6-09 | Liquid generates rain drops only during idle; sleep generates no new falling drops. Existing drops complete their bounded lifecycle, matching extracted 1.2.12 behavior. | All-mood liquid trace; explicit sleep particle lifecycle check. |
| v1.2.6-14 | Plain-island shadow and light-theme softness belong to shared CSS/layout. | Root must verify the actual no-character island; character sprite bounds alone cannot prove this row. |
| v1.2.5-12, v0.6.1-01 | Folded rest/slot widths and definition-specific fit; `CharacterSprite` reserves 6% extra canvas space for motion. | `island-sizing.test.cjs`; actual folded/large/gallery renderer proof. |
| v1.2.3-05 | Liquid capsule top arcs (`round`), alongside existing notch ears. | `liquid-engine.test.cjs` covers top-rounding and ears across states/dimensions. |
| v1.2.3-06, v0.9.1-01 | Liquid detects shrink/recovery on every fold, including music; shared content receives clip and squash. | Resize/recovery trace and modern content-clip assertions. Actual shared data-liquid-clip/squash hierarchy must be verified in combined app. |
| v1.2.0-04 | `distributeFaceWidgets` splits clock/battery/weather around face; legs eyes stay in the pill. | Sizing/attached tests; combined shared home/pill layout needs native/browser acceptance. |
| v1.1.1-03 | `cursor.ts` tracks screen cursor with native coordinates, 250ms grace and view offsets; pose smooths gaze. | Cursor/pose tests. Actual multi-monitor native cursor delivery belongs to root. |
| v0.9.2-01, v0.9.2-02 | Catalog boxes cover full motions; `CharacterSprite` generic decoration, spring/pop and fit. Corrected coffee/fire/astro/swarm/kao bounds and kept generic sleep symbols within the viewport during the mood-change spring. | `character-browser-acceptance.cjs`: zero clipping across all 26 slot SVGs, eight moods, both themes and all three sizes. Ordinary trace tests cannot prove clipping. |
| v0.9.2-03 | `drawings/creatures.ts`: legs eyes hidden above 40px/no-face and clamped inside the pill when jumping. | `character-attached.test.cjs` plus actual folded layout acceptance. |
| v0.9.0-04 | Liquid idle rain generation with bounded fade and disposal. | Deterministic liquid SVG/particle trace. Weather rain event delivery belongs to shared/native integration. |
| v0.7.0-01 (character clause) | Catalog RU/EN descriptions, seasonal translations, shared language selection. | Catalog tests; complete settings language switch belongs to root acceptance. |
| v0.6.1-02 | Liquid spring dynamics and inertia; folded geometry uses existing layout spring. | Liquid dimension/recovery trace. Native window/layout animation proof belongs to root. |
| v0.6.1-03 (animation clause) | Single shared RAF; original mood cadence; detached drawing work mutates SVG nodes without rebuilding them. | Browser shared-RAF proof and drawing allocation tests. Shared background tab prerender is root scope. |
| v0.6.0-01 | Magnetic cursor edge, music spikes/tint, happy drop return, eat impulse, sleep sag, resize inertia. | `liquid-engine.test.cjs` covers all moods and disposal. Native events remain combined acceptance. |
| v0.6.0-02 | Existing original catalog retained; own seasonal additions and 20 approved bitmap/Codex entries. Live settings previews use the same sprites. | Catalog/drawing/bitmap tests preserve entries and independent state. Shared gallery integration belongs to root. |
| v0.6.0-03 | Pose springs on mood change, poke bounce, real cursor gaze; finite bounded animations. | Pose frame-hash tests, character-state tests and browser transition bounds. |
| v0.6.0-04 | Shared command palette `Change character` opens settings (`runtime/compat/island.js`). | Root command-palette UI acceptance. |
| v0.6.0-05, v0.5.0-05 | Upstream selected-Pixel tray behavior is an integration/branding decision, not a renderer feature. No native tray implementation was found in the audited tree. | Root must resolve as own Woods behavior or add native implementation. Do not count source sprites as proof of tray parity. |
| v0.5.0-01 | Pixel mood palette, blink/gaze, idle and sleep layouts; shared asleep state selects mood. | `character-engine.test.cjs` pixel-layout assertions; actual idle/resume native events belong to root. |
| v0.5.0-06 | Pixel can be disabled by selecting none; current own settings preserve character selection. | Selection tests; combined settings acceptance. |
| v1.0.0-01, v1.0.0-02 (access clauses) | All Woods features and character choices remain free. | Root owns `runtime/free.ts`, global license compatibility and packaging audit. No paywall or trial gate should be added. |

## Evidence and limits

Targeted suite: `seasonal-character.test.cjs`, `character-engine.test.cjs`, `character-state.test.cjs`, `liquid-engine.test.cjs`, `character-attached.test.cjs`, `bitmap-character.test.cjs`. These validate 11 Woods bitmap pets and 9 optional Codex pets remain present, original drawing/physics traces, and seasonal gestures/node reuse.

Browser runner: `scripts/character-browser-acceptance.cjs`, isolated headless Edge profile and Vite fixture. It renders actual `CharacterSprite`, advances a controlled clock through eight moods, checks transformed SVG paint bounds (including internal clips), screenshots both themes, checks own colors, and confirms still/reduced motion cancels RAF. `LiquidIsland` fixtures additionally exercise the actual CSS content clip and fold squash. It does not launch or replace the user's application.

Proof output is stored on E: under `E:/tmp/woods-parity-run-temp/character-browser-proof/`; temporary build/test files use the same E: staging area. Full production build, native media/tray/window/device acceptance and user review remain root responsibilities before release.
