export interface ExtractedMediaMetadata {
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
const MPEG1_LAYER3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MPEG2_LAYER3_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const AAC_SAMPLE_RATES = [
  96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350,
];

/** Extracts dimensions/duration from validated file bytes without trusting browser metadata. */
export function extractMediaMetadata(bytes: Uint8Array, mimeType: string): ExtractedMediaMetadata {
  if (mimeType === "image/png") return imageMetadata(parsePng(bytes));
  if (mimeType === "image/jpeg") return imageMetadata(parseJpeg(bytes));
  if (mimeType === "image/webp") return imageMetadata(parseWebp(bytes));
  if (mimeType === "audio/mpeg") return audioMetadata(parseMp3Duration(bytes));
  if (mimeType === "audio/aac") return audioMetadata(parseAacDuration(bytes));
  if (mimeType === "audio/mp4" || mimeType === "audio/x-m4a") {
    return audioMetadata(parseMp4Duration(bytes));
  }
  return { width: null, height: null, durationSeconds: null };
}

function imageMetadata(size: { width: number; height: number } | null): ExtractedMediaMetadata {
  return { width: size?.width ?? null, height: size?.height ?? null, durationSeconds: null };
}

function audioMetadata(duration: number | null): ExtractedMediaMetadata {
  return { width: null, height: null, durationSeconds: duration };
}

function parsePng(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || !startsWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) return null;
  return validDimensions(readUint32(bytes, 16), readUint32(bytes, 20));
}

function parseJpeg(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) break;
    const segmentLength = readUint16(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if (SOF_MARKERS.has(marker) && segmentLength >= 7) {
      return validDimensions(readUint16(bytes, offset + 5), readUint16(bytes, offset + 3));
    }
    offset += segmentLength;
  }
  return null;
}

function parseWebp(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30 || !ascii(bytes, 0, "RIFF") || !ascii(bytes, 8, "WEBP")) return null;
  const chunk = ascii(bytes, 12, "VP8X")
    ? "VP8X"
    : ascii(bytes, 12, "VP8L")
      ? "VP8L"
      : ascii(bytes, 12, "VP8 ")
        ? "VP8 "
        : null;
  if (chunk === "VP8X" && bytes.length >= 30) {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return validDimensions(width, height);
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const width = 1 + ((bytes[22] & 0x3f) << 8) + bytes[21];
    const height = 1 + ((bytes[24] & 0x0f) << 10) + (bytes[23] << 2) + ((bytes[22] & 0xc0) >> 6);
    return validDimensions(width, height);
  }
  if (
    chunk === "VP8 " &&
    bytes.length >= 30 &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    return validDimensions(readUint16(bytes, 26) & 0x3fff, readUint16(bytes, 28) & 0x3fff);
  }
  return null;
}

function parseMp3Duration(bytes: Uint8Array): number | null {
  let offset = 0;
  if (ascii(bytes, 0, "ID3") && bytes.length >= 10) {
    const tagSize =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);
    offset = Math.min(bytes.length, 10 + tagSize + (bytes[5] & 0x10 ? 10 : 0));
  }
  let frames = 0;
  let sampleRate = 0;
  while (offset + 4 <= bytes.length) {
    const b0 = bytes[offset];
    const b1 = bytes[offset + 1];
    const b2 = bytes[offset + 2];
    if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) {
      offset += 1;
      continue;
    }
    const version = (b1 >> 3) & 0x03;
    const layer = (b1 >> 1) & 0x03;
    const bitrateIndex = (b2 >> 4) & 0x0f;
    const sampleIndex = (b2 >> 2) & 0x03;
    if (
      version === 1 ||
      layer !== 1 ||
      bitrateIndex === 0 ||
      bitrateIndex === 15 ||
      sampleIndex === 3
    ) {
      offset += 1;
      continue;
    }
    const baseSampleRate = [44100, 48000, 32000][sampleIndex];
    sampleRate =
      version === 3 ? baseSampleRate : version === 2 ? baseSampleRate / 2 : baseSampleRate / 4;
    const bitrateKbps = (version === 3 ? MPEG1_LAYER3_BITRATES : MPEG2_LAYER3_BITRATES)[
      bitrateIndex
    ];
    const padding = (b2 >> 1) & 1;
    const frameLength =
      Math.floor(((version === 3 ? 144 : 72) * bitrateKbps * 1000) / sampleRate) + padding;
    if (frameLength < 24 || offset + frameLength > bytes.length) break;
    frames += 1;
    offset += frameLength;
  }
  if (frames === 0 || sampleRate === 0) return null;
  return positiveDuration((frames * (sampleRate >= 32000 ? 1152 : 576)) / sampleRate);
}

function parseAacDuration(bytes: Uint8Array): number | null {
  let offset = 0;
  let samples = 0;
  let sampleRate = 0;
  while (offset + 7 <= bytes.length) {
    if (bytes[offset] !== 0xff || (bytes[offset + 1] & 0xf6) !== 0xf0) {
      offset += 1;
      continue;
    }
    const rateIndex = (bytes[offset + 2] >> 2) & 0x0f;
    const rate = AAC_SAMPLE_RATES[rateIndex];
    const frameLength =
      ((bytes[offset + 3] & 0x03) << 11) | (bytes[offset + 4] << 3) | (bytes[offset + 5] >> 5);
    if (!rate || frameLength < 7 || offset + frameLength > bytes.length) {
      offset += 1;
      continue;
    }
    sampleRate = rate;
    samples += 1024 * ((bytes[offset + 6] & 0x03) + 1);
    offset += frameLength;
  }
  return samples > 0 && sampleRate > 0 ? positiveDuration(samples / sampleRate) : null;
}

function parseMp4Duration(bytes: Uint8Array): number | null {
  let best: number | null = null;
  for (let offset = 4; offset + 24 <= bytes.length; offset += 1) {
    if (!ascii(bytes, offset, "mvhd") && !ascii(bytes, offset, "mdhd")) continue;
    const boxStart = offset - 4;
    const boxSize = readUint32(bytes, boxStart);
    if (boxSize < 32 || boxStart + boxSize > bytes.length) continue;
    const version = bytes[offset + 4];
    let timescale: number;
    let duration: number;
    if (version === 0 && offset + 24 <= bytes.length) {
      timescale = readUint32(bytes, offset + 16);
      duration = readUint32(bytes, offset + 20);
    } else if (version === 1 && offset + 36 <= boxStart + boxSize) {
      timescale = readUint32(bytes, offset + 24);
      const high = readUint32(bytes, offset + 28);
      const low = readUint32(bytes, offset + 32);
      duration = high * 0x1_0000_0000 + low;
    } else {
      continue;
    }
    const seconds = positiveDuration(duration / timescale);
    if (seconds !== null && (best === null || seconds > best)) best = seconds;
  }
  return best;
}

function validDimensions(width: number, height: number): { width: number; height: number } | null {
  return Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= 50000 &&
    height <= 50000
    ? { width, height }
    : null;
}

function positiveDuration(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0 || value > 86400) return null;
  return Math.round(value * 100) / 100;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, offset: number, value: string): boolean {
  return [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}
