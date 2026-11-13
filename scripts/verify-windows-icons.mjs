import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const ICON_SIZES = [16, 24, 32, 48, 64, 256];
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const sha256 = data => createHash('sha256').update(data).digest('hex');
const fail = message => { throw new Error(`Windows icon verification: ${message}`); };
const requireThat = (condition, message) => { if (!condition) fail(message); };

function range(buffer, offset, size, label) {
  requireThat(Number.isSafeInteger(offset) && Number.isSafeInteger(size)
    && offset >= 0 && size >= 0 && offset + size <= buffer.length, `${label} is outside file bounds`);
  return buffer.subarray(offset, offset + size);
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ crcTable[(value ^ byte) & 255];
  return (value ^ 0xffffffff) >>> 0;
}

function validatePng(bytes, width, height) {
  requireThat(range(bytes, 0, 8, 'PNG signature').equals(PNG_SIGNATURE), 'ICO frame is not PNG');
  let offset = 8, chunks = 0, sawData = false, sawEnd = false;
  while (offset < bytes.length) {
    const header = range(bytes, offset, 8, 'PNG chunk header');
    const length = header.readUInt32BE(0), type = header.toString('ascii', 4, 8);
    const chunk = range(bytes, offset, length + 12, 'PNG chunk');
    requireThat(/^[A-Za-z]{4}$/.test(type), 'PNG chunk type is invalid');
    requireThat(crc32(chunk.subarray(4, length + 8)) === chunk.readUInt32BE(length + 8), 'PNG chunk CRC mismatch');
    if (chunks === 0) {
      requireThat(type === 'IHDR' && length === 13, 'PNG must start with a 13-byte IHDR');
      requireThat(chunk.readUInt32BE(8) === width && chunk.readUInt32BE(12) === height,
        'PNG dimensions differ from the ICO entry');
      const validDepths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      requireThat(validDepths[chunk[17]]?.includes(chunk[16]), 'PNG color type/bit depth is invalid');
      requireThat(chunk[18] === 0 && chunk[19] === 0 && chunk[20] <= 1, 'PNG coding fields are invalid');
    } else requireThat(type !== 'IHDR', 'PNG contains a second IHDR');
    if (type === 'IDAT') sawData = true;
    offset += length + 12;
    chunks++;
    if (type === 'IEND') {
      requireThat(length === 0 && offset === bytes.length, 'PNG IEND/trailing bytes are invalid');
      sawEnd = true;
      break;
    }
  }
  requireThat(sawData && sawEnd, 'PNG IDAT or IEND is missing');
}

function readIco(bytes) {
  const header = range(bytes, 0, 6, 'ICO header');
  requireThat(header.readUInt16LE(0) === 0 && header.readUInt16LE(2) === 1, 'ICO header is invalid');
  const count = header.readUInt16LE(4);
  requireThat(count === ICON_SIZES.length, `ICO must contain exactly ${ICON_SIZES.length} frames`);
  range(bytes, 6, count * 16, 'ICO directory');
  const frames = new Map(), intervals = [];
  for (let index = 0; index < count; index++) {
    const entry = bytes.subarray(6 + index * 16, 22 + index * 16);
    const width = entry[0] || 256, height = entry[1] || 256;
    requireThat(width === height && ICON_SIZES.includes(width) && !frames.has(width), 'ICO has an unexpected/duplicate size');
    requireThat(entry[2] === 0 && entry[3] === 0, 'ICO entry color/reserved fields are invalid');
    const planes = entry.readUInt16LE(4), bits = entry.readUInt16LE(6);
    requireThat((planes === 0 || planes === 1) && bits === 32, 'ICO PNG entries must have 0/1 planes and 32-bit metadata');
    const size = entry.readUInt32LE(8), offset = entry.readUInt32LE(12);
    requireThat(size > 0 && offset >= 6 + count * 16, 'ICO frame overlaps its directory');
    const payload = range(bytes, offset, size, 'ICO frame');
    validatePng(payload, width, height);
    frames.set(width, { width, height, planes, bits, payload, entry, sha256: sha256(payload) });
    intervals.push([offset, offset + size]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  requireThat(intervals.every((value, index) => index === 0 || value[0] >= intervals[index - 1][1]), 'ICO payloads overlap');
  return frames;
}

function readResources(bytes) {
  requireThat(range(bytes, 0, 64, 'DOS header').toString('ascii', 0, 2) === 'MZ', 'DOS signature is missing');
  const peOffset = bytes.readUInt32LE(0x3c);
  requireThat(peOffset >= 64, 'PE header overlaps the DOS header');
  const coff = range(bytes, peOffset, 24, 'PE/COFF header');
  requireThat(coff.subarray(0, 4).equals(Buffer.from('50450000', 'hex')), 'PE signature is missing');
  const sectionCount = coff.readUInt16LE(6), optionalSize = coff.readUInt16LE(20);
  requireThat(sectionCount > 0 && sectionCount <= 96, 'PE section count is invalid');
  const optional = range(bytes, peOffset + 24, optionalSize, 'PE optional header');
  range(optional, 0, 2, 'PE optional magic');
  const magic = optional.readUInt16LE(0), directoryOffset = magic === 0x20b ? 112 : magic === 0x10b ? 96 : -1;
  requireThat(directoryOffset >= 0, 'Only PE32 and PE32+ headers are supported');
  range(optional, directoryOffset - 4, 28, 'PE resource data-directory entry');
  const directoryCount = optional.readUInt32LE(directoryOffset - 4);
  requireThat(directoryCount >= 3 && directoryCount <= 16, 'PE data-directory count is invalid');
  range(optional, directoryOffset, directoryCount * 8, 'PE data directories');
  const resourceRva = optional.readUInt32LE(directoryOffset + 16), resourceSize = optional.readUInt32LE(directoryOffset + 20);
  requireThat(resourceRva > 0 && resourceSize >= 16 && resourceRva + resourceSize <= 0x100000000, 'PE resource RVA/size is invalid');
  const sectionTable = peOffset + 24 + optionalSize;
  range(bytes, sectionTable, sectionCount * 40, 'PE section table');
  const sections = [];
  for (let index = 0; index < sectionCount; index++) {
    const section = bytes.subarray(sectionTable + index * 40, sectionTable + (index + 1) * 40);
    const rva = section.readUInt32LE(12), rawSize = section.readUInt32LE(16), rawOffset = section.readUInt32LE(20);
    requireThat(rva + rawSize <= 0x100000000, 'PE section RVA overflows');
    if (rawSize) {
      requireThat(rawOffset >= sectionTable + sectionCount * 40, 'PE section overlaps its headers');
      range(bytes, rawOffset, rawSize, 'PE section data');
    }
    sections.push({ rva, rawSize, rawOffset });
  }
  const fileOffset = (rva, size) => {
    const candidates = sections.filter(section => rva >= section.rva && rva + size <= section.rva + section.rawSize);
    requireThat(candidates.length === 1, 'Resource RVA is not uniquely file-backed');
    return candidates[0].rawOffset + rva - candidates[0].rva;
  };
  const base = fileOffset(resourceRva, resourceSize);
  const relative = (offset, size, label) => {
    requireThat(offset >= 0 && offset + size <= resourceSize, `${label} is outside the resource directory`);
    return range(bytes, base + offset, size, label);
  };
  const visited = new Set(), leaves = [];
  let entryCount = 0;
  const directory = (offset, path) => {
    requireThat(path.length <= 2 && !visited.has(offset), 'Resource directory cycle or invalid depth');
    visited.add(offset);
    const header = relative(offset, 16, 'Resource directory header');
    const named = header.readUInt16LE(12), ids = header.readUInt16LE(14), count = named + ids;
    entryCount += count;
    requireThat(entryCount <= 4096, 'Resource tree exceeds the bounded entry limit');
    const entries = relative(offset + 16, count * 8, 'Resource directory entries');
    const keys = new Set();
    for (let index = 0; index < count; index++) {
      const name = entries.readUInt32LE(index * 8), child = entries.readUInt32LE(index * 8 + 4);
      const isNamed = !!(name & 0x80000000);
      requireThat(isNamed === (index < named), 'Resource named/ID entry ordering is invalid');
      let key = name;
      if (isNamed) {
        const nameOffset = name & 0x7fffffff;
        const length = relative(nameOffset, 2, 'Resource name length').readUInt16LE(0);
        requireThat(length > 0, 'Resource name is empty');
        key = relative(nameOffset + 2, length * 2, 'Resource name').toString('utf16le');
      }
      const identity = JSON.stringify(key);
      requireThat(!keys.has(identity), 'Duplicate resource directory key');
      keys.add(identity);
      const nextPath = [...path, key], childOffset = child & 0x7fffffff;
      if (child & 0x80000000) directory(childOffset, nextPath);
      else {
        requireThat(nextPath.length === 3, 'Resource leaf must have type/name/language');
        const data = relative(childOffset, 16, 'Resource data entry');
        const rva = data.readUInt32LE(0), size = data.readUInt32LE(4);
        requireThat(data.readUInt32LE(12) === 0 && size > 0, 'Resource data entry is invalid');
        requireThat(rva >= resourceRva && rva + size <= resourceRva + resourceSize, 'Resource payload escapes its directory range');
        const payload = range(bytes, fileOffset(rva, size), size, 'Resource payload');
        leaves.push({ path: nextPath, payload });
      }
    }
  };
  directory(0, []);
  return leaves;
}

/** Verify all PE icon resources against the six approved source ICO PNG frames. */
export async function verifyWindowsIcons(executable, icoPath) {
  const [bytes, icoBytes] = await Promise.all([readFile(executable), readFile(icoPath)]);
  const approved = readIco(icoBytes), resources = readResources(bytes);
  const groups = resources.filter(resource => resource.path[0] === 14);
  const icons = resources.filter(resource => resource.path[0] === 3);
  requireThat(groups.length === 1, 'PE must contain exactly one RT_GROUP_ICON');
  requireThat(icons.length === ICON_SIZES.length, 'PE must contain exactly six RT_ICON resources');
  const group = groups[0], header = range(group.payload, 0, 6, 'Group icon header');
  requireThat(header.readUInt16LE(0) === 0 && header.readUInt16LE(2) === 1
    && header.readUInt16LE(4) === ICON_SIZES.length && group.payload.length === 6 + 14 * ICON_SIZES.length,
  'Group icon header/count/length differs from the approved ICO');
  const used = new Set(), sizes = new Set(), canonical = Buffer.alloc(group.payload.length), frames = [];
  header.copy(canonical);
  for (let index = 0; index < ICON_SIZES.length; index++) {
    const at = 6 + index * 14, entry = group.payload.subarray(at, at + 14);
    const width = entry[0] || 256, height = entry[1] || 256, expected = approved.get(width);
    requireThat(expected && height === width && !sizes.has(width), 'Group has an old/unexpected/duplicate frame size');
    sizes.add(width);
    const id = entry.readUInt16LE(12);
    let candidates = icons.filter(icon => icon.path[1] === id && icon.path[2] === group.path[2]);
    if (!candidates.length) candidates = icons.filter(icon => icon.path[1] === id);
    requireThat(candidates.length === 1, 'Group frame ID/language is missing or ambiguous');
    const icon = candidates[0], identity = JSON.stringify(icon.path);
    requireThat(!used.has(identity), 'Group references one RT_ICON more than once');
    used.add(identity);
    requireThat(icon.payload.equals(expected.payload), `Icon ${width}x${height} PNG payload differs from source ICO`);
    requireThat(entry.readUInt32LE(8) === icon.payload.length, 'Group frame byte size is invalid');
    const planes = entry.readUInt16LE(4);
    const pngPlaneNormalization = expected.planes === 0 && planes === 1;
    requireThat(planes === expected.planes || pngPlaneNormalization, 'Group icon plane metadata is invalid');
    // PNG ICO planes=0 is unspecified; Windows RC canonicalizes it to one plane.
    expected.entry.subarray(0, 12).copy(canonical, at);
    canonical.writeUInt16LE(planes, at + 4);
    canonical.writeUInt16LE(id, at + 12);
    frames.push({ size: width, resourceId: id, language: icon.path[2], bytes: icon.payload.length,
      sha256: expected.sha256, exactPngPayload: true, sourcePlanes: expected.planes,
      resourcePlanes: planes, pngPlaneNormalization });
  }
  requireThat(canonical.equals(group.payload), 'Group metadata differs from its canonical approved ICO mapping');
  requireThat(used.size === icons.length && sizes.size === approved.size, 'PE contains old/orphan/unreferenced icon frames');
  return { executable: String(executable), sha256: sha256(bytes), icoSha256: sha256(icoBytes),
    groupCount: groups.length, frameCount: icons.length, groupResourcePath: group.path, groupSha256: sha256(group.payload),
    canonicalGroupByteEqual: true, oldOrExtraFrames: 0, frames };
}

const entryPath = process.argv[1] ? await realpath(process.argv[1]).catch(() => null) : null;
if (entryPath && entryPath === await realpath(new URL(import.meta.url))) {
  const [icoPath, ...executables] = process.argv.slice(2);
  if (!icoPath || !executables.length) {
    console.error('Usage: node scripts/verify-windows-icons.mjs ICO EXE [EXE...]');
    process.exitCode = 1;
  } else {
    try {
      for (const executable of executables) console.log(JSON.stringify(await verifyWindowsIcons(executable, icoPath)));
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
