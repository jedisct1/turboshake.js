import { bytesToHex, ensureUint8Array, type Input } from "./utils.js";

export interface KeccakState {
  readonly byteLength: number;
  xorBytes(offset: number, bytes: Uint8Array): void;
  xorByte(offset: number, byte: number): void;
  extractBytes(offset: number, target: Uint8Array, targetOffset: number, length: number): void;
  permute(): void;
  copyFrom(other: this): void;
}

/**
 * Code shared by TurboShake and MiniShake.
 */
export abstract class KeccakSponge {
  private readonly rate: number;
  private readonly separationByte: number;
  private readonly state: KeccakState;
  private position = 0;
  private finalized = false;

  protected constructor(state: KeccakState, rate: number, separationByte: number) {
    // Both specs cap the capacity at 512 bits.
    const minRate = state.byteLength - 64;
    if (!Number.isInteger(rate) || rate < minRate || rate >= state.byteLength) {
      throw new RangeError(`rate must be an integer in [${minRate}, ${state.byteLength - 1}]`);
    }
    // Other values break the padding (RFC 9861), and 0x00 even lets different messages collide.
    if (!Number.isInteger(separationByte) || separationByte < 0x01 || separationByte > 0x7f) {
      throw new RangeError("separationByte must be an integer in [0x01, 0x7F]");
    }
    this.rate = rate;
    this.separationByte = separationByte;
    this.state = state;
  }

  /**
   * Creates a deep copy of this instance.
   * @returns New instance with identical state
   */
  clone(): this {
    // Both subclasses take (rate, separationByte).
    const Sponge = this.constructor as new (rate: number, separationByte: number) => this;
    const copy = new Sponge(this.rate, this.separationByte);
    copy.state.copyFrom(this.state);
    copy.position = this.position;
    copy.finalized = this.finalized;
    return copy;
  }

  /**
   * Absorbs input data into the sponge state.
   * @param message - Input data to absorb
   * @returns This instance for method chaining
   * @throws Error if called after squeezing has begun
   */
  update(message: Input): this {
    if (this.finalized) {
      throw new Error("Cannot update after squeezing has begun");
    }

    const chunk = ensureUint8Array(message);
    const { rate, state } = this;
    let offset = 0;

    while (offset < chunk.length) {
      const length = Math.min(rate - this.position, chunk.length - offset);
      state.xorBytes(this.position, chunk.subarray(offset, offset + length));
      this.position += length;
      offset += length;
      if (this.position === rate) {
        state.permute();
        this.position = 0;
      }
    }

    return this;
  }

  /**
   * Squeezes output data from the sponge.
   * @param outputLength - Number of bytes to output
   * @returns Output bytes as Uint8Array
   * @throws RangeError if outputLength is negative or not an integer
   */
  squeeze(outputLength: number): Uint8Array {
    if (outputLength < 0 || !Number.isInteger(outputLength)) {
      throw new RangeError("outputLength must be a non-negative integer");
    }
    const out = new Uint8Array(outputLength);
    this.squeezeInto(out);
    return out;
  }

  /**
   * Squeezes output data directly into a provided array.
   * @param target - Target array to write output into
   * @param offset - Starting offset in target array (default: 0)
   * @param length - Number of bytes to write (default: target.length - offset)
   * @returns The target array for convenience
   * @throws TypeError if target is not Uint8Array
   * @throws RangeError for invalid offset or length parameters
   */
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
      if (this.position === rate) {
        state.permute();
        this.position = 0;
      }

      const chunk = Math.min(rate - this.position, actualLength - produced);
      state.extractBytes(this.position, target, offset + produced, chunk);
      this.position += chunk;
      produced += chunk;
    }

    return target;
  }

  /**
   * Squeezes output data and returns it as a hexadecimal string.
   * @param outputLength - Number of bytes to output
   * @returns Uppercase hexadecimal string representation
   */
  squeezeHex(outputLength: number): string {
    return bytesToHex(this.squeeze(outputLength));
  }

  private ensureFinalized(): void {
    if (this.finalized) {
      return;
    }
    const { state } = this;
    state.xorByte(this.position, this.separationByte);
    state.xorByte(this.rate - 1, 0x80);
    state.permute();
    this.position = 0;
    this.finalized = true;
  }
}
