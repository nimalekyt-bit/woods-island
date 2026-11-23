import { canonicalReleases } from "./catalog";
import archive from "../../releases/archive.json";

export type ReleaseParagraph = { text: string; bullet: boolean };
export type ReleaseEntry = {
  version: string;
  summary: { ru: string; en: string };
  paragraphs: { ru: ReleaseParagraph[]; en: ReleaseParagraph[] };
};
export const woodsReleasesUrl =
  "https://github.com/nimalekyt-bit/woods-island/releases";
export function releaseUrl(version: string) {
  return /^\d+\.\d+\.\d+$/.test(version)
    ? `${woodsReleasesUrl}/tag/v${version}`
    : `${woodsReleasesUrl}/latest`;
}
function compare(a: string, b: string) {
  const x = a.split(".").map(Number),
    y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}
function paragraphs(source: string): ReleaseParagraph[] {
  return source
    .trim()
    .split(/\n\s*\n|\n(?=- )/)
    .map((block) => block.trim())
    .filter((block) => block && !block.startsWith("#"))
    .map((block) => ({
      text: block.replace(/^- /, "").replace(/\n/g, " ").trim(),
      bullet: block.startsWith("- "),
    }));
}
const entries = new Map<string, ReleaseEntry>();
const versionText = (value: string, version: string) =>
  value.split("{{version}}").join(version);
for (const release of canonicalReleases) {
  const [ru, en] = release.githubNotes.replace(/\r\n/g, "\n").split(/\n---\n/);
  entries.set(release.version, {
    version: release.version,
    summary: {
      ru: versionText(release.site.summary.ru, release.version),
      en: versionText(release.site.summary.en, release.version),
    },
    paragraphs: {
      ru: paragraphs(versionText(ru, release.version)),
      en: paragraphs(versionText(en || ru, release.version)),
    },
  });
}
// Old releases already have reviewed editorial history; newer records take priority.
for (const release of canonicalReleases)
  for (const entry of release.site.history) {
    if (entries.has(entry.version)) continue;
    const local = (lang: "ru" | "en") =>
      entry.groups.flatMap((group) =>
        group.items.map((item) => ({
          text: versionText(
            item[lang]
              .map((segment) =>
                typeof segment === "string" ? segment : segment.strong,
              )
              .join(""),
            entry.version,
          ),
          bullet: true,
        })),
      );
    entries.set(entry.version, {
      version: entry.version,
      summary: {
        ru: versionText(entry.summary.ru, entry.version),
        en: versionText(entry.summary.en, entry.version),
      },
      paragraphs: { ru: local("ru"), en: local("en") },
    });
  }
// Preserve the pre-editorial Woods history formerly embedded in Settings.
for (const entry of archive) {
  if (entries.has(entry.version)) continue;
  entries.set(entry.version, {
    version: entry.version,
    summary: entry.summary,
    paragraphs: {
      ru: entry.notes.ru.map((text) => ({ text, bullet: true })),
      en: entry.notes.en.map((text) => ({ text, bullet: true })),
    },
  });
}
export function releaseHistory(installed: string) {
  // A failed version lookup must never label an arbitrary release as installed.
  if (!/^\d+\.\d+\.\d+$/.test(installed)) return [];
  return [...entries.values()]
    .filter((entry) => compare(entry.version, installed) <= 0)
    .sort((a, b) => compare(b.version, a.version));
}
