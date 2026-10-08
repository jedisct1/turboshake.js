# TurboSHAKE

Pure TypeScript implementation of TurboSHAKE128 and TurboSHAKE256 cryptographic hash functions (XOFs - Extendable Output Functions) based on the Keccak permutation.
It also implements MiniSHAKE128 and MiniSHAKE256.

## Installation

```bash
bun add turboshake
```

## Usage

### Basic Usage

```typescript
import { turboshake128, turboshake256 } from 'turboshake';

// Hash a message with TurboSHAKE128
const message = new TextEncoder().encode('Hello, world!');
const hash128 = turboshake128(message, 0x1F, 32); // 32 bytes output
console.log(hash128); // Uint8Array

// Hash with TurboSHAKE256
const hash256 = turboshake256(message, 0x1F, 64); // 64 bytes output
```

### Hex Output

```typescript
import { turboshake128Hex, turboshake256Hex } from 'turboshake';

const message = new TextEncoder().encode('Hello, world!');
const hexHash = turboshake128Hex(message, 0x1F, 32);
console.log(hexHash); // "56FB68ADE138D9DCC4976725005B012AA48188980E4338CB380D6872FA5B4DF4"
```

### Different Output Lengths

```typescript
import { turboshake128 } from 'turboshake';

const message = new TextEncoder().encode('Hello, world!');

// Generate different length outputs
const hash16 = turboshake128(message, 0x1F, 16);
const hash32 = turboshake128(message, 0x1F, 32);
const hash64 = turboshake128(message, 0x1F, 64);
const hash100 = turboshake128(message, 0x1F, 100);
```

### Incremental Usage

```typescript
import { createTurboShake128 } from 'turboshake';

const ctx = createTurboShake128(0x1F);

// Absorb data in chunks
ctx.update(chunk1);
ctx.update(chunk2);

// Squeeze output incrementally
const first32 = ctx.squeeze(32);
const next32 = ctx.squeeze(32);

// You can also write into an existing buffer
const target = new Uint8Array(64);
ctx.squeezeInto(target, 0, 64);
```

### Domain Separation

The separation byte allows domain separation for different use cases:

```typescript
import { turboshake128 } from 'turboshake';

const message = new TextEncoder().encode('Hello, world!');

// Different domains produce different outputs
const domain1 = turboshake128(message, 0x01, 32);
const domain2 = turboshake128(message, 0x06, 32);
const domain3 = turboshake128(message, 0x1F, 32);
```

### MiniSHAKE

MiniSHAKE comes from the Keccak team ([ePrint 2026/2363](https://eprint.iacr.org/2026/2363)).

It works like TurboSHAKE, but with a permutation half the size.
It's meant for hashing lots of very short messages, for example in zero-knowledge proofs.

A message of up to 67 bytes for MiniSHAKE128, or 35 bytes for MiniSHAKE256, fits in a single block.

```typescript
import { minishake128, minishake256, createMiniShake128 } from 'turboshake';

const message = new TextEncoder().encode('Hello, world!');
const hash128 = minishake128(message, 0x01, 32);
const hash256 = minishake256(message, 0x01, 64);

const ctx = createMiniShake128(0x01);
ctx.update(message);
console.log(ctx.squeezeHex(32)); // "0F4C58EF533BD9068B7B5282A552AF3B66006916044F33A6BD35B314001CA285"
```

The separation byte works the same way as with TurboSHAKE.
If you don't need domain separation, the paper suggests 0x01.

In this library, MiniSHAKE is also much faster than TurboSHAKE, which has to use BigInt.

### Utility Functions

```typescript
import { bytesToHex, hexToBytes } from 'turboshake';

// Convert Uint8Array to hex string
const bytes = new Uint8Array([0x1E, 0x41, 0x5F]);
const hex = bytesToHex(bytes); // "1E415F"

// Convert hex string to Uint8Array
const parsedBytes = hexToBytes("1E415F");
```

## API Reference

### Functions

#### `turboshake128(message, separationByte, outputLength)`

- `message`: `Uint8Array | ArrayBufferView | ArrayLike<number>` - Input message
- `separationByte`: `number` - Domain separation byte (0x01-0x7F)
- `outputLength`: `number` - Desired output length in bytes
- Returns: `Uint8Array` - Hash output

#### `turboshake256(message, separationByte, outputLength)`

- Same parameters as `turboshake128`
- Returns: `Uint8Array` - Hash output

#### `turboshake128Hex(message, separationByte, outputLength)`

- Same parameters as `turboshake128`
- Returns: `string` - Hexadecimal string representation

#### `turboshake256Hex(message, separationByte, outputLength)`

- Same parameters as `turboshake256`
- Returns: `string` - Hexadecimal string representation

#### `createTurboShake128(separationByte)` / `createTurboShake256(separationByte)`

- `separationByte`: `number` - Domain separation byte (0x01-0x7F)
- Returns: `TurboShake` instance configured for TurboSHAKE128 or TurboSHAKE256

#### `minishake128(message, separationByte, outputLength)` / `minishake256(message, separationByte, outputLength)`

- Same parameters as `turboshake128`
- Returns: `Uint8Array` - Hash output

#### `minishake128Hex(message, separationByte, outputLength)` / `minishake256Hex(message, separationByte, outputLength)`

- Same parameters as `turboshake128`
- Returns: `string` - Hexadecimal string representation

#### `createMiniShake128(separationByte)` / `createMiniShake256(separationByte)`

- `separationByte`: `number` - Domain separation byte (0x01-0x7F)
- Returns: `MiniShake` instance configured for MiniSHAKE128 or MiniSHAKE256

### `TurboShake` and `MiniShake` Classes

Both classes are used for incremental hashing, and have the same methods:

- `update(input)` - Absorb additional data (`Uint8Array | ArrayBufferView | ArrayLike<number>`). Throws if called after squeezing.
- `squeeze(length)` - Return the next `length` bytes as a new `Uint8Array`.
- `squeezeInto(target, offset = 0, length = target.length - offset)` - Write the next `length` bytes into `target`.
- `squeezeHex(length)` - Return the next `length` bytes as an uppercase hex string.
- `clone()` - Return an independent copy of the current state.

#### `bytesToHex(bytes)`

- `bytes`: `Uint8Array` - Input bytes
- Returns: `string` - Hexadecimal string

#### `hexToBytes(hex)`

- `hex`: `string` - Hexadecimal string
- Returns: `Uint8Array` - Parsed bytes
