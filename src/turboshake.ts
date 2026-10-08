import { KeccakSponge, type KeccakState } from "./sponge.js";
import { bytesToHex, type Input } from "./utils.js";

const STATE_SIZE = 25;
const MASK_64 = (1n << 64n) - 1n;


const ROUND_CONSTANTS = [
  0x0000000000000001n, 0x0000000000008082n,
  0x800000000000808An, 0x8000000080008000n,
  0x000000000000808Bn, 0x0000000080000001n,
  0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008An, 0x0000000000000088n,
  0x0000000080008009n, 0x000000008000000An,
  0x000000008000808Bn, 0x800000000000008Bn,
  0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n,
  0x000000000000800An, 0x800000008000000An,
  0x8000000080008081n, 0x8000000000008080n,
  0x0000000080000001n, 0x8000000080008008n,
];

function rotl64(value: bigint, shift: number): bigint {
  const s = shift & 63;
  if (s === 0) return value & MASK_64;
  return ((value << BigInt(s)) | (value >> BigInt(64 - s))) & MASK_64;
}

const thetaC = new Array<bigint>(5).fill(0n);
const thetaD = new Array<bigint>(5).fill(0n);
const chiRow = new Array<bigint>(5).fill(0n);

function keccakP1600_12rounds(state: bigint[]): void {
  for (let roundIndex = 24 - 12; roundIndex < 24; roundIndex++) {
    // Theta step
    for (let x = 0; x < 5; x++) {
      thetaC[x] =
        state[x] ^
        state[x + 5] ^
        state[x + 10] ^
        state[x + 15] ^
        state[x + 20];
    }

    for (let x = 0; x < 5; x++) {
      thetaD[x] = thetaC[(x + 4) % 5] ^ rotl64(thetaC[(x + 1) % 5], 1);
    }

    for (let x = 0; x < 5; x++) {
      const d = thetaD[x];
      state[x] = (state[x] ^ d) & MASK_64;
      state[x + 5] = (state[x + 5] ^ d) & MASK_64;
      state[x + 10] = (state[x + 10] ^ d) & MASK_64;
      state[x + 15] = (state[x + 15] ^ d) & MASK_64;
      state[x + 20] = (state[x + 20] ^ d) & MASK_64;
    }

    // Rho and Pi steps
    let current = state[1];
    let x = 1;
    let y = 0;
    for (let t = 0; t < 24; t++) {
      const shift = ((t + 1) * (t + 2) / 2) % 64;
      const newX = y;
      const newY = (2 * x + 3 * y) % 5;
      const index = newX + 5 * newY;
      const temp = state[index];
      state[index] = rotl64(current, shift);
      current = temp;
      x = newX;
      y = newY;
    }

    // Chi step
    for (let yCoord = 0; yCoord < 5; yCoord++) {
      const offset = 5 * yCoord;
      for (let xCoord = 0; xCoord < 5; xCoord++) {
        chiRow[xCoord] = state[offset + xCoord];
      }
      for (let xCoord = 0; xCoord < 5; xCoord++) {
        state[offset + xCoord] =
          (chiRow[xCoord] ^ ((~chiRow[(xCoord + 1) % 5] & MASK_64) & chiRow[(xCoord + 2) % 5])) &
          MASK_64;
      }
    }

    // Iota step
    state[0] = (state[0] ^ ROUND_CONSTANTS[roundIndex]) & MASK_64;
  }
}

class KeccakP1600 implements KeccakState {
  readonly byteLength = 200;
  private readonly lanes: bigint[] = new Array<bigint>(STATE_SIZE).fill(0n);

  xorBytes(offset: number, bytes: Uint8Array): void {
    for (let i = 0; i < bytes.length; i++) {
      this.xorByte(offset + i, bytes[i]);
    }
  }

  xorByte(offset: number, byte: number): void {
    this.lanes[offset >> 3] ^= BigInt(byte) << BigInt((offset & 7) * 8);
  }

  extractBytes(offset: number, target: Uint8Array, targetOffset: number, length: number): void {
    for (let i = 0; i < length; i++) {
      const index = offset + i;
      const laneIndex = index >> 3;
      const shift = BigInt((index & 7) * 8);
      target[targetOffset + i] = Number((this.lanes[laneIndex] >> shift) & 0xFFn);
    }
  }

  permute(): void {
    keccakP1600_12rounds(this.lanes);
  }

  copyFrom(other: this): void {
    for (let i = 0; i < STATE_SIZE; i++) {
      this.lanes[i] = other.lanes[i];
    }
  }
}

/**
 * TurboShake class implementing the TurboSHAKE XOF (Extendable Output Function).
 * Provides streaming interface for absorbing input data and squeezing arbitrary-length output.
 */
export class TurboShake extends KeccakSponge {
  /**
   * Creates a new TurboShake instance.
   * @param rate - The rate parameter in bytes (168 for TurboSHAKE128, 136 for TurboSHAKE256)
   * @param separationByte - Domain separation byte value (0x01-0x7F)
   */
  constructor(rate: number, separationByte: number) {
    super(new KeccakP1600(), rate, separationByte);
  }
}

/**
 * Computes TurboSHAKE128 hash with 128-bit security level.
 * @param message - Input message to hash
 * @param separationByte - Domain separation byte (0x01-0x7F)
 * @param outputLength - Desired output length in bytes
 * @returns Hash output as Uint8Array
 */
export function turboshake128(message: Input, separationByte: number, outputLength: number): Uint8Array {
  return createTurboShake128(separationByte).update(message).squeeze(outputLength);
}

/**
 * Computes TurboSHAKE256 hash with 256-bit security level.
 * @param message - Input message to hash
 * @param separationByte - Domain separation byte (0x01-0x7F)
 * @param outputLength - Desired output length in bytes
 * @returns Hash output as Uint8Array
 */
export function turboshake256(message: Input, separationByte: number, outputLength: number): Uint8Array {
  return createTurboShake256(separationByte).update(message).squeeze(outputLength);
}

/**
 * Computes TurboSHAKE128 hash and returns it as a hexadecimal string.
 * @param message - Input message to hash
 * @param separationByte - Domain separation byte (0x01-0x7F)
 * @param outputLength - Desired output length in bytes
 * @returns Uppercase hexadecimal string representation
 */
export function turboshake128Hex(message: Input, separationByte: number, outputLength: number): string {
  return bytesToHex(turboshake128(message, separationByte, outputLength));
}

/**
 * Computes TurboSHAKE256 hash and returns it as a hexadecimal string.
 * @param message - Input message to hash
 * @param separationByte - Domain separation byte (0x01-0x7F)
 * @param outputLength - Desired output length in bytes
 * @returns Uppercase hexadecimal string representation
 */
export function turboshake256Hex(message: Input, separationByte: number, outputLength: number): string {
  return bytesToHex(turboshake256(message, separationByte, outputLength));
}

/**
 * Creates a new TurboShake instance configured for TurboSHAKE128.
 * @param separationByte - Domain separation byte (0x01-0x7F)
 * @returns New TurboShake instance with 128-bit security level
 */
export function createTurboShake128(separationByte: number): TurboShake {
  return new TurboShake(168, separationByte);
}

/**
 * Creates a new TurboShake instance configured for TurboSHAKE256.
 * @param separationByte - Domain separation byte (0x01-0x7F)
 * @returns New TurboShake instance with 256-bit security level
 */
export function createTurboShake256(separationByte: number): TurboShake {
  return new TurboShake(136, separationByte);
}
