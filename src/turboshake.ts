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

function xorBlock(state: bigint[], block: Uint8Array): void {
  const len = block.length;
  for (let i = 0; i < len; i++) {
    const laneIndex = i >> 3;
    const shift = BigInt((i & 7) * 8);
    state[laneIndex] = (state[laneIndex] ^ (BigInt(block[i]) << shift)) & MASK_64;
  }
}

function readStateBytes(state: bigint[], sourceOffset: number, target: Uint8Array, targetOffset: number, length: number): void {
  for (let i = 0; i < length; i++) {
    const index = sourceOffset + i;
    const laneIndex = index >> 3;
    const shift = BigInt((index & 7) * 8);
    target[targetOffset + i] = Number((state[laneIndex] >> shift) & 0xFFn);
  }
}

function ensureUint8Array(message: Uint8Array | ArrayBufferView | ArrayLike<number>): Uint8Array {
  if (message instanceof Uint8Array) {
    return message;
  }
  if (ArrayBuffer.isView(message)) {
    return new Uint8Array(message.buffer, message.byteOffset, message.byteLength);
  }
  const array = new Uint8Array(message.length);
  for (let i = 0; i < message.length; i++) {
    array[i] = message[i] & 0xff;
  }
  return array;
}

export class TurboShake {
  private readonly rate: number;
  private readonly separationByte: number;
  private readonly state: bigint[];
  private readonly buffer: Uint8Array;
  private bufferLength: number;
  private finalized: boolean;
  private squeezeOffset: number;

  constructor(rate: number, separationByte: number) {
    if (!Number.isInteger(rate) || rate <= 0) {
      throw new RangeError("rate must be a positive integer");
    }
    if (separationByte < 0 || separationByte > 0xff || !Number.isInteger(separationByte)) {
      throw new RangeError("separationByte must be an integer in [0, 255]");
    }
    this.rate = rate;
    this.separationByte = separationByte;
    this.state = new Array(STATE_SIZE).fill(0n);
    this.buffer = new Uint8Array(rate);
    this.bufferLength = 0;
    this.finalized = false;
    this.squeezeOffset = rate; // force refill on first use after finalize
  }

  update(message: Uint8Array | ArrayBufferView | ArrayLike<number>): this {
    if (this.finalized) {
      throw new Error("Cannot update after squeezing has begun");
    }

    const chunk = ensureUint8Array(message);
    const { rate, buffer, state } = this;
    let bufferLength = this.bufferLength;
    let offset = 0;

    if (bufferLength > 0) {
      const toFill = Math.min(rate - bufferLength, chunk.length);
      buffer.set(chunk.subarray(0, toFill), bufferLength);
      bufferLength += toFill;
      offset += toFill;
      if (bufferLength === rate) {
        xorBlock(state, buffer);
        keccakP1600_12rounds(state);
        bufferLength = 0;
      }
    }

    const chunkLength = chunk.length;
    while (offset + rate <= chunkLength) {
      const block = chunk.subarray(offset, offset + rate);
      xorBlock(state, block);
      keccakP1600_12rounds(state);
      offset += rate;
    }

    if (offset < chunkLength) {
      const remaining = chunk.subarray(offset);
      buffer.set(remaining, bufferLength);
      bufferLength += remaining.length;
    }

    this.bufferLength = bufferLength;
    return this;
  }

  squeeze(outputLength: number): Uint8Array {
    if (outputLength < 0 || !Number.isInteger(outputLength)) {
      throw new RangeError("outputLength must be a non-negative integer");
    }
    const out = new Uint8Array(outputLength);
    this.squeezeInto(out);
    return out;
  }

  squeezeInto(target: Uint8Array, offset = 0, length?: number): Uint8Array {
    if (!(target instanceof Uint8Array)) {
      throw new TypeError("target must be a Uint8Array");
    }
    if (!Number.isInteger(offset) || offset < 0 || offset > target.length) {
      throw new RangeError("offset must be an integer within [0, target.length]");
    }
    const actualLength = length === undefined ? target.length - offset : length;
    if (!Number.isInteger(actualLength) || actualLength < 0 || offset + actualLength > target.length) {
      throw new RangeError("length must be a non-negative integer and offset + length must be <= target.length");
    }
    if (actualLength === 0) {
      return target;
    }

    this.ensureFinalized();

    let produced = 0;
    const { rate, state } = this;

    while (produced < actualLength) {
      if (this.squeezeOffset === rate) {
        keccakP1600_12rounds(state);
        this.squeezeOffset = 0;
      }

      const available = rate - this.squeezeOffset;
      const chunk = Math.min(available, actualLength - produced);
      readStateBytes(state, this.squeezeOffset, target, offset + produced, chunk);
      this.squeezeOffset += chunk;
      produced += chunk;
    }

    return target;
  }

  squeezeHex(outputLength: number): string {
    return bytesToHex(this.squeeze(outputLength));
  }

  private ensureFinalized(): void {
    if (this.finalized) {
      return;
    }
    const { rate, state, buffer } = this;

    if (this.bufferLength >= rate) {
      throw new Error("Internal buffer is full before finalization");
    }

    buffer[this.bufferLength++] = this.separationByte;

    xorBlock(state, buffer.subarray(0, this.bufferLength));

    const padIndex = rate - 1;
    const padLane = padIndex >> 3;
    const padShift = BigInt((padIndex & 7) * 8);
    state[padLane] = (state[padLane] ^ (0x80n << padShift)) & MASK_64;

    keccakP1600_12rounds(state);

    this.buffer.fill(0);
    this.bufferLength = 0;
    this.finalized = true;
    this.squeezeOffset = 0;
  }
}

function turboshake(rate: number, message: Uint8Array | ArrayBufferView | ArrayLike<number>, separationByte: number, outputLength: number): Uint8Array {
  const ctx = new TurboShake(rate, separationByte);
  ctx.update(message);
  return ctx.squeeze(outputLength);
}

export function turboshake128(message: Uint8Array | ArrayBufferView | ArrayLike<number>, separationByte: number, outputLength: number): Uint8Array {
  return turboshake(168, message, separationByte, outputLength);
}

export function turboshake256(message: Uint8Array | ArrayBufferView | ArrayLike<number>, separationByte: number, outputLength: number): Uint8Array {
  return turboshake(136, message, separationByte, outputLength);
}

export function turboshake128Hex(message: Uint8Array | ArrayBufferView | ArrayLike<number>, separationByte: number, outputLength: number): string {
  return bytesToHex(turboshake128(message, separationByte, outputLength));
}

export function turboshake256Hex(message: Uint8Array | ArrayBufferView | ArrayLike<number>, separationByte: number, outputLength: number): string {
  return bytesToHex(turboshake256(message, separationByte, outputLength));
}

export function createTurboShake128(separationByte: number): TurboShake {
  return new TurboShake(168, separationByte);
}

export function createTurboShake256(separationByte: number): TurboShake {
  return new TurboShake(136, separationByte);
}

export function bytesToHex(bytes: Uint8Array): string {
  const hex: string[] = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    const value = bytes[i];
    hex[i] = value.toString(16).padStart(2, "0").toUpperCase();
  }
  return hex.join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  if (clean.length % 2 !== 0) {
    throw new Error("Hex string must have an even length");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}
