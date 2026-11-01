/** A file in a zip archive. */
export interface ZipEntry {
  /** Path inside the archive, with forward slashes */
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n++) {
    let c = n;

    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }

  return table;
})();

const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;

  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);

  return (crc ^ 0xffffffff) >>> 0;
};

/**
 * Pack files into a zip archive. Files are stored as they are, since audio
 * barely shrinks, which keeps this small and fast.
 */
export const zip = (entries: readonly ZipEntry[]) => {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length);
    const head = new DataView(local.buffer);

    head.setUint32(0, 0x04034b50, true);
    head.setUint16(4, 20, true);
    // Bit 11: the name is UTF-8
    head.setUint16(6, 0x0800, true);
    head.setUint32(14, crc, true);
    head.setUint32(18, entry.data.length, true);
    head.setUint32(22, entry.data.length, true);
    head.setUint16(26, name.length, true);
    local.set(name, 30);

    const record = new Uint8Array(46 + name.length);
    const view = new DataView(record.buffer);

    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint32(16, crc, true);
    view.setUint32(20, entry.data.length, true);
    view.setUint32(24, entry.data.length, true);
    view.setUint16(28, name.length, true);
    view.setUint32(42, offset, true);
    record.set(name, 46);

    parts.push(local, entry.data);
    central.push(record);
    offset += local.length + entry.data.length;
  }

  const size = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const tail = new DataView(end.buffer);

  tail.setUint32(0, 0x06054b50, true);
  tail.setUint16(8, entries.length, true);
  tail.setUint16(10, entries.length, true);
  tail.setUint32(12, size, true);
  tail.setUint32(16, offset, true);

  const out = new Uint8Array(offset + size + end.length);
  let at = 0;

  for (const part of [...parts, ...central, end]) {
    out.set(part, at);
    at += part.length;
  }

  return out;
};

const inflate = async (data: Uint8Array) => {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate-raw'));

  return new Uint8Array(await new Response(stream).arrayBuffer());
};

/** Read the files of a zip archive, stored or deflated, as made by most tools. */
export const unzip = async (archive: Uint8Array): Promise<ZipEntry[]> => {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const decoder = new TextDecoder();
  let end = -1;

  for (let i = archive.length - 22; i >= Math.max(0, archive.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }

  if (end < 0) throw new Error('Not a zip archive');

  const count = view.getUint16(end + 10, true);
  const entries: ZipEntry[] = [];
  let at = view.getUint32(end + 16, true);

  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error('Damaged zip archive');

    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true);
    const comment = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(archive.subarray(at + 46, at + 46 + nameLength));
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = archive.subarray(start, start + compressed);

    at += 46 + nameLength + extra + comment;
    if (name.endsWith('/')) continue;
    if (method !== 0 && method !== 8) throw new Error(`${name} uses a zip compression this reader can't open`);

    entries.push({ name, data: method === 8 ? await inflate(raw) : raw.slice() });
  }

  return entries;
};
