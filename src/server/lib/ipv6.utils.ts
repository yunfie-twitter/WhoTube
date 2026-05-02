/**
 * IPv6 Rotation Utility (Ported from invidious-companion)
 */

export function generateRandomIPv6(ipv6Block: string): string {
  const [baseAddress, blockSize] = ipv6Block.split('/');
  const blockBits = parseInt(blockSize, 10);

  if (isNaN(blockBits) || blockBits < 1 || blockBits > 128) {
    throw new Error('Invalid IPv6 block size');
  }

  const expandedBase = expandIPv6(baseAddress);
  const baseBytes = ipv6ToBytes(expandedBase);

  for (let i = Math.floor(blockBits / 8); i < 16; i++) {
    const bitOffset = Math.max(0, blockBits - i * 8);
    if (bitOffset === 0) {
      baseBytes[i] = Math.floor(Math.random() * 256);
    } else if (bitOffset < 8) {
      const mask = (1 << (8 - bitOffset)) - 1;
      const randomPart = Math.floor(Math.random() * (mask + 1));
      baseBytes[i] = (baseBytes[i] & ~mask) | randomPart;
    }
  }

  return bytesToIPv6(baseBytes);
}

function expandIPv6(address: string): string {
  if (address.includes('::')) {
    const parts = address.split('::');
    const leftParts = parts[0] ? parts[0].split(':') : [];
    const rightParts = parts[1] ? parts[1].split(':') : [];
    const missingParts = 8 - leftParts.length - rightParts.length;
    const middle = Array(missingParts).fill('0000');
    const allParts = [...leftParts, ...middle, ...rightParts];
    return allParts.map((p) => p.padStart(4, '0')).join(':');
  }
  return address.split(':').map((p) => p.padStart(4, '0')).join(':');
}

function ipv6ToBytes(address: string): number[] {
  const parts = address.split(':');
  const bytes: number[] = [];
  for (const part of parts) {
    const value = parseInt(part, 16);
    bytes.push((value >> 8) & 0xff);
    bytes.push(value & 0xff);
  }
  return bytes;
}

function bytesToIPv6(bytes: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < 16; i += 2) {
    const value = (bytes[i] << 8) | bytes[i + 1];
    parts.push(value.toString(16));
  }
  let ipv6 = parts.join(':');
  const zeroSequences = ipv6.match(/(^|:)(0:)+/g);
  if (zeroSequences) {
    const longestZeroSeq = zeroSequences.reduce((a, b) => (a.length > b.length ? a : b));
    ipv6 = ipv6.replace(longestZeroSeq, longestZeroSeq[0] + ':');
  }
  return ipv6;
}
