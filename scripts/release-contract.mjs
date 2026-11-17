import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const repository = 'nimalekyt-bit/woods-island';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const languages = ['ru', 'en'];
export function keys(value, expected, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label}: expected object`);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label}: unexpected or missing fields`);
}
function text(value, limit, label) {
  assert(typeof value === 'string' && value.trim() && value.length <= limit, `${label}: text must be 1..${limit} characters`);
  assert(!/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value), `${label}: markup/control characters are not allowed`);
  assert(!/\{\{(?!version\}\})/.test(value), `${label}: unknown placeholder`);
}
export function localized(value, limit, label, rich = false) {
  keys(value, languages, label);
  for (const lang of languages) {
    if (!rich) text(value[lang], limit, `${label}.${lang}`);
    else {
      assert(Array.isArray(value[lang]) && value[lang].length > 0 && value[lang].length <= 24, `${label}.${lang}: invalid segments`);
      let length = 0;
      for (const segment of value[lang]) {
        if (typeof segment === 'string') { text(segment, limit, label); length += segment.length; }
        else { keys(segment, ['strong'], label); text(segment.strong, limit, label); length += segment.strong.length; }
      }
      assert(length <= limit, `${label}.${lang}: text exceeds ${limit} characters`);
    }
  }
}
function groups(value, label) {
  assert(Array.isArray(value) && value.length >= 1 && value.length <= 12, `${label}: expected 1..12 groups`);
  const ids = new Set();
  for (const group of value) {
    keys(group, ['id', 'icon', 'title', 'items'], label);
    assert(/^[a-z][a-z0-9-]{0,39}$/.test(group.id) && !ids.has(group.id), `${label}: duplicate/invalid id`); ids.add(group.id);
    assert(['connections','appearance','updates','data'].includes(group.icon), `${label}: unsupported icon`);
    localized(group.title, 100, `${label}.title`);
    assert(Array.isArray(group.items) && group.items.length >= 1 && group.items.length <= 20, `${label}: expected 1..20 facts`);
    group.items.forEach((item, i) => localized(item, 800, `${label}.items[${i}]`, true));
  }
}
export function validateContent(content) {
  keys(content, ['schemaVersion','productId','version','githubNotes','updaterNotes','site'], 'release');
  assert.equal(content.schemaVersion, 1, 'Unsupported release schema');
  assert.equal(content.productId, 'woods-island');
  assert(/^\d+\.\d+\.\d+$/.test(content.version), 'A stable version is required');
  text(content.githubNotes, 16000, 'githubNotes'); text(content.updaterNotes, 2000, 'updaterNotes');
  const site = content.site;
  keys(site, ['seoDescription','summary','groups','updateInstructions','extra','faqUpdate','history'], 'site');
  text(site.seoDescription, 300, 'site.seoDescription');
  localized(site.summary, 140, 'site.summary'); groups(site.groups, 'site.groups');
  localized(site.updateInstructions, 1200, 'site.updateInstructions'); localized(site.extra, 800, 'site.extra');
  localized(site.faqUpdate, 1400, 'site.faqUpdate');
  assert(Array.isArray(site.history) && site.history.length <= 20, 'Too many history releases');
  const versions = new Set([content.version]);
  for (const entry of site.history) {
    keys(entry, ['version','summary','groups','updateInstructions'], 'history');
    assert(/^\d+\.\d+\.\d+$/.test(entry.version) && !versions.has(entry.version), 'Duplicate/invalid history version'); versions.add(entry.version);
    localized(entry.summary, 140, 'history.summary'); groups(entry.groups, 'history.groups');
    localized(entry.updateInstructions, 1200, 'history.updateInstructions');
  }
  return content;
}
export function assetNames(version) {
  return { setup: `Woods-Island-${version}-windows-x64-Setup.exe`, portable: `Woods-Island-${version}-windows-x64-portable.zip`, checksums: 'SHA256SUMS.txt', updater: 'latest.json', signature: `Woods-Island-${version}-windows-x64-Setup.exe.sig` };
}
export function validateManifest(manifest) {
  keys(manifest, ['schemaVersion','releaseId','tag','publishedAt','sourceRevision','acceptanceRunId','contentRevision','content','assets'], 'manifest');
  assert.equal(manifest.schemaVersion, 1); validateContent(manifest.content);
  assert(Number.isSafeInteger(manifest.releaseId) && manifest.releaseId > 0, 'Invalid release ID');
  assert.equal(manifest.tag, `v${manifest.content.version}`);
  assert(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(manifest.publishedAt) && Number.isFinite(Date.parse(manifest.publishedAt)), 'Invalid publication time');
  assert(/^[a-f0-9]{40}$/.test(manifest.sourceRevision), 'Invalid source revision');
  assert(Number.isSafeInteger(manifest.acceptanceRunId) && manifest.acceptanceRunId > 0, 'Installer acceptance run is required');
  assert(/^[a-f0-9]{40}$/.test(manifest.contentRevision), 'Invalid editorial revision');
  const names = assetNames(manifest.content.version);
  keys(manifest.assets, Object.keys(names), 'assets');
  for (const [kind, name] of Object.entries(names)) {
    const asset = manifest.assets[kind]; keys(asset, ['name','bytes','sha256','url'], `assets.${kind}`);
    assert.equal(asset.name, name); assert(Number.isSafeInteger(asset.bytes) && asset.bytes > 0, 'Invalid asset size');
    assert(/^[a-f0-9]{64}$/.test(asset.sha256), 'Invalid asset checksum');
    assert.equal(asset.url, `https://github.com/${repository}/releases/download/${manifest.tag}/${name}`, 'Unexpected download URL');
  }
  return manifest;
}
export function validateReleaseIdentity(manifest, release, resolvedRevision) {
  validateManifest(manifest);
  assert.equal(release.id, manifest.releaseId); assert.equal(release.tag_name, manifest.tag);
  assert.equal(release.draft, false); assert.equal(release.prerelease, false);
  assert.equal(release.published_at, manifest.publishedAt); assert.equal(resolvedRevision, manifest.sourceRevision);
  for (const expected of Object.values(manifest.assets)) {
    const matches = release.assets.filter(asset => asset.name === expected.name);
    assert.equal(matches.length, 1, `Missing/duplicate asset: ${expected.name}`);
    const asset = matches[0]; assert.equal(asset.state, 'uploaded'); assert.equal(asset.size, expected.bytes);
    assert.equal(asset.digest, `sha256:${expected.sha256}`, `GitHub digest mismatch: ${expected.name}`);
    assert.equal(asset.browser_download_url, expected.url);
  }
}
