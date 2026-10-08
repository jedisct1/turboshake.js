export type Input = Uint8Array | ArrayBufferView | ArrayLike<number>;

export function ensureUint8Array(message: Input): Uint8Array {
  if (message instanceof Uint8Array) {
    return message;
  }
  if (ArrayBuffer.isView(message)) {
    return new Uint8Array(message.buffer, message.byteOffset, message.byteLength);
  }
  return Uint8Array.from(message);
}

/**
 * Converts a byte array to an uppercase hexadecimal string.
 * @param bytes - Input byte array
 * @returns Uppercase hexadecimal string representation
 */
export function bytesToHex(bytes: Uint8Array): string {
  const hex: string[] = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    const value = bytes[i];
    hex[i] = value.toString(16).padStart(2, "0").toUpperCase();
  }
  return hex.join("");
}

/**
 * Converts a hexadecimal string to a byte array.
 * @param hex - Hexadecimal string (case-insensitive, non-hex characters ignored)
 * @returns Byte array representation
 * @throws Error if hex string has odd length after cleaning
 */
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
