/**
 * Lightweight, zero-dependency pure TypeScript QR Code generator.
 * Encodes alphanumeric / byte URLs into SVG QR matrix.
 */

// Simple QR code generator supporting Byte mode, Error Correction Level M/L
export function generateQrSvg(text: string, size = 200, margin = 2): string {
  const qr = createQrMatrix(text);
  const count = qr.length;
  const cellSize = (size - margin * 2 * (size / count)) / count;
  const totalSize = size;
  const offset = (totalSize - count * cellSize) / 2;

  let rects = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr[r][c]) {
        const x = (offset + c * cellSize).toFixed(2);
        const y = (offset + r * cellSize).toFixed(2);
        const w = (cellSize + 0.1).toFixed(2);
        const h = (cellSize + 0.1).toFixed(2);
        rects += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0f172a" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}">
    <rect width="${totalSize}" height="${totalSize}" fill="#ffffff" rx="12" />
    ${rects}
  </svg>`;
}

// Minimal QR Matrix implementation
function createQrMatrix(text: string): boolean[][] {
  // We use standard QR Code Model 2 algorithm
  // For compact strings (URLs up to 120 chars), Version 4-6 with EC Level L/M is ideal.
  const data = new TextEncoder().encode(text);
  const version = getMinVersion(data.length);
  const modulesCount = version * 4 + 17;
  const matrix: (boolean | null)[][] = Array.from({ length: modulesCount }, () => Array(modulesCount).fill(null));

  // 1. Finder patterns (Top-Left, Top-Right, Bottom-Left)
  drawFinder(matrix, 0, 0);
  drawFinder(matrix, modulesCount - 7, 0);
  drawFinder(matrix, 0, modulesCount - 7);

  // 2. Alignment patterns (for Version >= 2)
  if (version >= 2) {
    const alignPos = getAlignPositions(version);
    for (const r of alignPos) {
      for (const c of alignPos) {
        if (
          (r === 6 && c === 6) ||
          (r === 6 && c === modulesCount - 7) ||
          (r === modulesCount - 7 && c === 6)
        ) {
          continue;
        }
        drawAlignment(matrix, r - 2, c - 2);
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < modulesCount - 8; i++) {
    const val = i % 2 === 0;
    if (matrix[6][i] === null) matrix[6][i] = val;
    if (matrix[i][6] === null) matrix[i][6] = val;
  }

  // 4. Dark module
  matrix[modulesCount - 8][8] = true;

  // 5. Reserve format info areas
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
    if (matrix[8][modulesCount - 1 - i] === null) matrix[8][modulesCount - 1 - i] = false;
    if (matrix[modulesCount - 1 - i][8] === null) matrix[modulesCount - 1 - i][8] = false;
  }

  // 6. Encode Data with Reed-Solomon Error Correction
  const bitStream = encodeData(data, version);

  // 7. Place data bits in matrix (zigzag upwards/downwards)
  let bitIdx = 0;
  let dir = -1; // -1 = up, 1 = down
  let col = modulesCount - 1;

  while (col > 0) {
    if (col === 6) col--; // Skip vertical timing pattern column

    const rowStart = dir === -1 ? modulesCount - 1 : 0;
    const rowEnd = dir === -1 ? -1 : modulesCount;

    for (let r = rowStart; r !== rowEnd; r += dir === -1 ? -1 : 1) {
      for (let cOffset = 0; cOffset < 2; cOffset++) {
        const c = col - cOffset;
        if (matrix[r][c] === null) {
          let bit = false;
          if (bitIdx < bitStream.length) {
            bit = bitStream[bitIdx++] === 1;
          }
          // Apply mask 000: (row + col) % 2 === 0
          const mask = (r + c) % 2 === 0;
          matrix[r][c] = bit !== mask;
        }
      }
    }

    dir = -dir;
    col -= 2;
  }

  // 8. Write format info (EC level L + Mask 000 = 0x77c4 with XOR mask 0x5412 => 0x23d6)
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0]; // Standard L mask 0
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i] === 1;
  matrix[8][7] = formatBits[6] === 1;
  matrix[8][8] = formatBits[7] === 1;
  matrix[7][8] = formatBits[8] === 1;
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i] === 1;

  for (let i = 0; i < 8; i++) matrix[modulesCount - 1 - i][8] = formatBits[i] === 1;
  for (let i = 8; i < 15; i++) matrix[8][modulesCount - 15 + i] = formatBits[i] === 1;

  return matrix.map(row => row.map(cell => !!cell));
}

function drawFinder(matrix: (boolean | null)[][], row: number, col: number) {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      if (
        r === 0 || r === 6 || c === 0 || c === 6 ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4)
      ) {
        matrix[row + r][col + c] = true;
      } else {
        matrix[row + r][col + c] = false;
      }
    }
  }
  // Separator
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const nr = row + r;
      const nc = col + c;
      if (nr >= 0 && nr < matrix.length && nc >= 0 && nc < matrix.length) {
        if (matrix[nr][nc] === null) matrix[nr][nc] = false;
      }
    }
  }
}

function drawAlignment(matrix: (boolean | null)[][], row: number, col: number) {
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2)) {
        matrix[row + r][col + c] = true;
      } else {
        matrix[row + r][col + c] = false;
      }
    }
  }
}

function getMinVersion(byteLen: number): number {
  if (byteLen <= 17) return 1;
  if (byteLen <= 32) return 2;
  if (byteLen <= 53) return 3;
  if (byteLen <= 78) return 4;
  if (byteLen <= 106) return 5;
  if (byteLen <= 134) return 6;
  return 7;
}

function getAlignPositions(version: number): number[] {
  if (version === 1) return [];
  if (version === 2) return [6, 18];
  if (version === 3) return [6, 22];
  if (version === 4) return [6, 26];
  if (version === 5) return [6, 30];
  if (version === 6) return [6, 34];
  return [6, 22, 38];
}

const TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172, 196];
const EC_CODEWORDS_L = [0, 7, 10, 15, 20, 26, 36, 40];

function encodeData(data: Uint8Array, version: number): number[] {
  const bits: number[] = [];

  // Mode: Byte (0100)
  bits.push(0, 1, 0, 0);

  // Character count (8 bits for Version 1-9)
  const count = data.length;
  for (let i = 7; i >= 0; i--) {
    bits.push((count >> i) & 1);
  }

  // Data bytes
  for (let i = 0; i < data.length; i++) {
    const b = data[i];
    for (let j = 7; j >= 0; j--) {
      bits.push((b >> j) & 1);
    }
  }

  // Terminator (up to 4 zeroes)
  const totalDataBytes = TOTAL_CODEWORDS[version] - EC_CODEWORDS_L[version];
  const totalDataBits = totalDataBytes * 8;
  while (bits.length < totalDataBits && bits.length % 8 !== 0) {
    bits.push(0);
  }
  while (bits.length < totalDataBits && bits.length < (data.length + 2) * 8 + 4) {
    bits.push(0);
  }

  // Convert to bytes
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byteVal = 0;
    for (let j = 0; j < 8; j++) {
      byteVal = (byteVal << 1) | (bits[i + j] || 0);
    }
    bytes.push(byteVal);
  }

  // Pad bytes (0xEC, 0x11 alternating)
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bytes.length < totalDataBytes) {
    bytes.push(padBytes[padIdx++ % 2]);
  }

  // Calculate Reed-Solomon Error Correction Code
  const ecCount = EC_CODEWORDS_L[version];
  const ecBytes = calculateRs(bytes, ecCount);

  // Final codeword stream
  const finalStream = bytes.concat(ecBytes);
  const resultBits: number[] = [];
  for (const b of finalStream) {
    for (let j = 7; j >= 0; j--) {
      resultBits.push((b >> j) & 1);
    }
  }

  return resultBits;
}

// Reed-Solomon GF(256) calculation
const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);
let x = 1;
for (let i = 0; i < 255; i++) {
  GF256_EXP[i] = x;
  GF256_EXP[i + 255] = x;
  GF256_LOG[x] = i;
  x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF256_EXP[GF256_LOG[a] + GF256_LOG[b]];
}

function calculateRs(data: number[], ecLen: number): number[] {
  // Generator polynomial for ecLen
  let gen = [1];
  for (let i = 0; i < ecLen; i++) {
    const nextGen = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      nextGen[j] ^= gfMul(gen[j], GF256_EXP[i]);
      nextGen[j + 1] ^= gen[j];
    }
    gen = nextGen;
  }

  const msg = new Array(data.length + ecLen).fill(0);
  for (let i = 0; i < data.length; i++) msg[i] = data[i];

  for (let i = 0; i < data.length; i++) {
    const lead = msg[i];
    if (lead !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], lead);
      }
    }
  }

  return msg.slice(data.length);
}
