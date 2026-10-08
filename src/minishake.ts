import { KeccakSponge, type KeccakState } from "./sponge.js";
import { bytesToHex, type Input } from "./utils.js";

const STATE_SIZE = 25;

const ROUND_CONSTANTS = [
  0x00000001, 0x00008082, 0x0000808A, 0x80008000,
  0x0000808B, 0x80000001, 0x80008081, 0x00008009,
  0x0000008A, 0x00000088, 0x80008009, 0x8000000A,
  0x8000808B, 0x0000008B, 0x00008089, 0x00008003,
  0x00008002, 0x00000080, 0x0000800A, 0x8000000A,
  0x80008081, 0x00008080,
];

function rotl32(value: number, shift: number): number {
  return (value << shift) | (value >>> (32 - shift));
}

function keccakP800_12rounds(state: Uint32Array): void {
  let a00 = state[0]; let a01 = state[1]; let a02 = state[2]; let a03 = state[3]; let a04 = state[4];
  let a05 = state[5]; let a06 = state[6]; let a07 = state[7]; let a08 = state[8]; let a09 = state[9];
  let a10 = state[10]; let a11 = state[11]; let a12 = state[12]; let a13 = state[13]; let a14 = state[14];
  let a15 = state[15]; let a16 = state[16]; let a17 = state[17]; let a18 = state[18]; let a19 = state[19];
  let a20 = state[20]; let a21 = state[21]; let a22 = state[22]; let a23 = state[23]; let a24 = state[24];

  for (let roundIndex = 22 - 12; roundIndex < 22; roundIndex++) {
    const c0 = a00 ^ a05 ^ a10 ^ a15 ^ a20;
    const c1 = a01 ^ a06 ^ a11 ^ a16 ^ a21;
    const c2 = a02 ^ a07 ^ a12 ^ a17 ^ a22;
    const c3 = a03 ^ a08 ^ a13 ^ a18 ^ a23;
    const c4 = a04 ^ a09 ^ a14 ^ a19 ^ a24;
    const d0 = c4 ^ rotl32(c1, 1);
    const d1 = c0 ^ rotl32(c2, 1);
    const d2 = c1 ^ rotl32(c3, 1);
    const d3 = c2 ^ rotl32(c4, 1);
    const d4 = c3 ^ rotl32(c0, 1);
    a00 ^= d0; a05 ^= d0; a10 ^= d0; a15 ^= d0; a20 ^= d0;
    a01 ^= d1; a06 ^= d1; a11 ^= d1; a16 ^= d1; a21 ^= d1;
    a02 ^= d2; a07 ^= d2; a12 ^= d2; a17 ^= d2; a22 ^= d2;
    a03 ^= d3; a08 ^= d3; a13 ^= d3; a18 ^= d3; a23 ^= d3;
    a04 ^= d4; a09 ^= d4; a14 ^= d4; a19 ^= d4; a24 ^= d4;

    // b00 to b24 are the lanes after the rho and pi steps.
    const b00 = a00;
    const b10 = rotl32(a01, 1);
    const b20 = rotl32(a02, 30);
    const b05 = rotl32(a03, 28);
    const b15 = rotl32(a04, 27);
    const b16 = rotl32(a05, 4);
    const b01 = rotl32(a06, 12);
    const b11 = rotl32(a07, 6);
    const b21 = rotl32(a08, 23);
    const b06 = rotl32(a09, 20);
    const b07 = rotl32(a10, 3);
    const b17 = rotl32(a11, 10);
    const b02 = rotl32(a12, 11);
    const b12 = rotl32(a13, 25);
    const b22 = rotl32(a14, 7);
    const b23 = rotl32(a15, 9);
    const b08 = rotl32(a16, 13);
    const b18 = rotl32(a17, 15);
    const b03 = rotl32(a18, 21);
    const b13 = rotl32(a19, 8);
    const b14 = rotl32(a20, 18);
    const b24 = rotl32(a21, 2);
    const b09 = rotl32(a22, 29);
    const b19 = rotl32(a23, 24);
    const b04 = rotl32(a24, 14);

    a00 = b00 ^ (~b01 & b02);
    a01 = b01 ^ (~b02 & b03);
    a02 = b02 ^ (~b03 & b04);
    a03 = b03 ^ (~b04 & b00);
    a04 = b04 ^ (~b00 & b01);
    a05 = b05 ^ (~b06 & b07);
    a06 = b06 ^ (~b07 & b08);
    a07 = b07 ^ (~b08 & b09);
    a08 = b08 ^ (~b09 & b05);
    a09 = b09 ^ (~b05 & b06);
    a10 = b10 ^ (~b11 & b12);
    a11 = b11 ^ (~b12 & b13);
    a12 = b12 ^ (~b13 & b14);
    a13 = b13 ^ (~b14 & b10);
    a14 = b14 ^ (~b10 & b11);
    a15 = b15 ^ (~b16 & b17);
    a16 = b16 ^ (~b17 & b18);
    a17 = b17 ^ (~b18 & b19);
    a18 = b18 ^ (~b19 & b15);
    a19 = b19 ^ (~b15 & b16);
    a20 = b20 ^ (~b21 & b22);
    a21 = b21 ^ (~b22 & b23);
    a22 = b22 ^ (~b23 & b24);
    a23 = b23 ^ (~b24 & b20);
    a24 = b24 ^ (~b20 & b21);
    a00 ^= ROUND_CONSTANTS[roundIndex];
  }

  state[0] = a00; state[1] = a01; state[2] = a02; state[3] = a03; state[4] = a04;
  state[5] = a05; state[6] = a06; state[7] = a07; state[8] = a08; state[9] = a09;
  state[10] = a10; state[11] = a11; state[12] = a12; state[13] = a13; state[14] = a14;
  state[15] = a15; state[16] = a16; state[17] = a17; state[18] = a18; state[19] = a19;
  state[20] = a20; state[21] = a21; state[22] = a22; state[23] = a23; state[24] = a24;
}

class KeccakP800 implements KeccakState {
  readonly byteLength = 100;
  private readonly lanes = new Uint32Array(STATE_SIZE);

  xorBytes(offset: number, bytes: Uint8Array): void {
    const lanes = this.lanes;
    let i = 0;
    // Whole lanes at a time when the offset allows it, which is much faster.
    if ((offset & 3) === 0) {
      for (; i + 4 <= bytes.length; i += 4) {
        lanes[(offset + i) >> 2] ^= bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24);
      }
    }
    for (; i < bytes.length; i++) {
      this.xorByte(offset + i, bytes[i]);
    }
  }

  xorByte(offset: number, byte: number): void {
    this.lanes[offset >> 2] ^= byte << ((offset & 3) * 8);
  }

  extractBytes(offset: number, target: Uint8Array, targetOffset: number, length: number): void {
    for (let i = 0; i < length; i++) {
      const index = offset + i;
      target[targetOffset + i] = this.lanes[index >> 2] >>> ((index & 3) * 8);
    }
  }

  permute(): void {
    keccakP800_12rounds(this.lanes);
  }

  copyFrom(other: this): void {
    this.lanes.set(other.lanes);
  }
}

/**
 * Incremental MiniSHAKE hashing.
 * MiniSHAKE works like TurboSHAKE, with a permutation half the size.
 */
export class MiniShake extends KeccakSponge {
  /**
   * Creates a new MiniShake instance.
   * @param rate - The rate parameter in bytes (68 for MiniSHAKE128, 36 for MiniSHAKE256)
   * @param separationByte - Domain separation byte value (0x01-0x7F)
   */
  constructor(rate: number, separationByte: number) {
    super(new KeccakP800(), rate, separationByte);
  }
}

/**
 * Computes MiniSHAKE128 hash with 128-bit security level.
 * @param message - Input message to hash
 * @param separationByte - Domain separation byte (0x01-0x7F)
 * @param outputLength - Desired output length in bytes
 * @returns Hash output as Uint8Array
 */
export function minishake128(message: Input, separationByte: number, outputLength: number): Uint8Array {
  return createMiniShake128(separationByte).update(message).squeeze(outputLength);
}

/**
 * Computes MiniSHAKE256 hash with 256-bit security level.
 * @param message - Input message to hash
 * @param separationByte - Domain separation byte (0x01-0x7F)
 * @param outputLength - Desired output length in bytes
 * @returns Hash output as Uint8Array
 */
export function minishake256(message: Input, separationByte: number, outputLength: number): Uint8Array {
  return createMiniShake256(separationByte).update(message).squeeze(outputLength);
}

/**
 * Computes MiniSHAKE128 hash and returns it as a hexadecimal string.
 * @param message - Input message to hash
 * @param separationByte - Domain separation byte (0x01-0x7F)
 * @param outputLength - Desired output length in bytes
 * @returns Uppercase hexadecimal string representation
 */
export function minishake128Hex(message: Input, separationByte: number, outputLength: number): string {
  return bytesToHex(minishake128(message, separationByte, outputLength));
}

/**
 * Computes MiniSHAKE256 hash and returns it as a hexadecimal string.
 * @param message - Input message to hash
 * @param separationByte - Domain separation byte (0x01-0x7F)
 * @param outputLength - Desired output length in bytes
 * @returns Uppercase hexadecimal string representation
 */
export function minishake256Hex(message: Input, separationByte: number, outputLength: number): string {
  return bytesToHex(minishake256(message, separationByte, outputLength));
}

/**
 * Creates a new MiniShake instance configured for MiniSHAKE128.
 * @param separationByte - Domain separation byte (0x01-0x7F)
 * @returns New MiniShake instance with 128-bit security level
 */
export function createMiniShake128(separationByte: number): MiniShake {
  return new MiniShake(68, separationByte);
}

/**
 * Creates a new MiniShake instance configured for MiniSHAKE256.
 * @param separationByte - Domain separation byte (0x01-0x7F)
 * @returns New MiniShake instance with 256-bit security level
 */
export function createMiniShake256(separationByte: number): MiniShake {
  return new MiniShake(36, separationByte);
}
