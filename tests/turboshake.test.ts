import { describe, test, expect } from "bun:test";
import {
  bytesToHex,
  hexToBytes,
  turboshake128,
  turboshake256,
  turboshake128Hex,
  createTurboShake128,
  createTurboShake256,
} from "../src/turboshake";

function pattern(length: number): Uint8Array {
  if (!Number.isInteger(length) || length < 0) {
    throw new RangeError("length must be a non-negative integer");
  }
  const result = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    result[i] = i % 0xfb;
  }
  return result;
}

const pow17 = (exp: number): number => {
  let result = 1;
  for (let i = 0; i < exp; i++) {
    result *= 17;
  }
  return result;
};

const patternCache = new Map<number, Uint8Array>();
const getPattern = (length: number): Uint8Array => {
  let cached = patternCache.get(length);
  if (!cached) {
    cached = pattern(length);
    patternCache.set(length, cached);
  }
  return cached;
};

describe("TurboSHAKE128", () => {
  const empty = new Uint8Array(0);

  test("empty message, D=0x1F, 32 bytes", () => {
    const out = turboshake128(empty, 0x1f, 32);
    expect(bytesToHex(out)).toBe(
      "1E415F1C5983AFF2169217277D17BB538CD945A397DDEC541F1CE41AF2C1B74C",
    );
  });

  test("empty message, D=0x1F, 64 bytes", () => {
    const out = turboshake128(empty, 0x1f, 64);
    expect(bytesToHex(out)).toBe(
      "1E415F1C5983AFF2169217277D17BB538CD945A397DDEC541F1CE41AF2C1B74C3E8CCAE2A4DAE56C84A04C2385C03C15E8193BDF58737363321691C05462C8DF",
    );
  });

  test("empty message, D=0x1F, 10032 bytes (last 32)", () => {
    const out = turboshake128(empty, 0x1f, 10032);
    expect(bytesToHex(out.slice(-32))).toBe(
      "A3B9B0385900CE761F22AED548E754DA10A5242D62E8C658E3F3A923A7555607",
    );
  });

  const patternExpectations: Array<[number, string]> = [
    [0, "55CEDD6F60AF7BB29A4042AE832EF3F58DB7299F893EBB9247247D856958DAA9"],
    [1, "9C97D036A3BAC819DB70EDE0CA554EC6E4C2A1A4FFBFD9EC269CA6A111161233"],
    [2, "96C77C279E0126F7FC07C9B07F5CDAE1E0BE60BDBE10620040E75D7223A624D2"],
    [3, "D4976EB56BCF118520582B709F73E1D6853E001FDAF80E1B13E0D0599D5FB372"],
    [4, "DA67C7039E98BF530CF7A37830C6664E14CBAB7F540F58403B1B82951318EE5C"],
    [5, "B97A906FBF83EF7C812517ABF3B2D0AEA0C4F60318CE11CF103925127F59EECD"],
    [6, "35CD494ADEDED2F25239AF09A7B8EF0C4D1CA4FE2D1AC370FA63216FE7B4C2B1"],
  ];

  for (const [exp, expected] of patternExpectations) {
    test(`ptn(17**${exp} bytes), D=0x1F, 32 bytes`, () => {
      const msg = getPattern(pow17(exp));
      const out = turboshake128(msg, 0x1f, 32);
      expect(bytesToHex(out)).toBe(expected);
    });
  }

  const domainVectors: Array<[string, number, string]> = [
    ["FF FF FF", 0x01, "BF323F940494E88EE1C540FE660BE8A0C93F43D15EC006998462FA994EED5DAB"],
    ["FF", 0x06, "8EC9C66465ED0D4A6C35D13506718D687A25CB05C74CCA1E42501ABD83874A67"],
    ["FF FF FF", 0x07, "B658576001CAD9B1E5F399A9F77723BBA05458042D68206F7252682DBA3663ED"],
    ["FF FF FF FF FF FF FF", 0x0b, "8DEEAA1AEC47CCEE569F659C21DFA8E112DB3CEE37B18178B2ACD805B799CC37"],
    ["FF", 0x30, "553122E2135E363C3292BED2C6421FA232BAB03DAA07C7D6636603286506325B"],
    ["FF FF FF", 0x7f, "16274CC656D44CEFD422395D0F9053BDA6D28E122ABA15C765E5AD0E6EAF26F9"],
  ];

  for (const [hex, domain, expected] of domainVectors) {
    test(`M=${hex.replace(/ /g, "")}, D=0x${domain.toString(16).toUpperCase()}, 32 bytes`, () => {
      const msg = hexToBytes(hex);
      const out = turboshake128(msg, domain, 32);
      expect(bytesToHex(out)).toBe(expected);
    });
  }
});

describe("TurboSHAKE256", () => {
  const empty = new Uint8Array(0);

  test("empty message, D=0x1F, 64 bytes", () => {
    const out = turboshake256(empty, 0x1f, 64);
    expect(bytesToHex(out)).toBe(
      "367A329DAFEA871C7802EC67F905AE13C57695DC2C6663C61035F59A18F8E7DB11EDC0E12E91EA60EB6B32DF06DD7F002FBAFABB6E13EC1CC20D995547600DB0",
    );
  });

  test("empty message, D=0x1F, 10032 bytes (last 32)", () => {
    const out = turboshake256(empty, 0x1f, 10032);
    expect(bytesToHex(out.slice(-32))).toBe(
      "ABEFA11630C661269249742685EC082F207265DCCF2F43534E9C61BA0C9D1D75",
    );
  });

  const patternExpectations: Array<[number, string]> = [
    [0, "3E1712F928F8EAF1054632B2AA0A246ED8B0C378728F60BC970410155C28820E90CC90D8A3006AA2372C5C5EA176B0682BF22BAE7467AC94F74D43D39B0482E2"],
    [1, "B3BAB0300E6A191FBE6137939835923578794EA54843F5011090FA2F3780A9E5CB22C59D78B40A0FBFF9E672C0FBE0970BD2C845091C6044D687054DA5D8E9C7"],
    [2, "66B810DB8E90780424C0847372FDC95710882FDE31C6DF75BEB9D4CD9305CFCAE35E7B83E8B7E6EB4B78605880116316FE2C078A09B94AD7B8213C0A738B65C0"],
    [3, "C74EBC919A5B3B0DD1228185BA02D29EF442D69D3D4276A93EFE0BF9A16A7DC0CD4EABADAB8CD7A5EDD96695F5D360ABE09E2C6511A3EC397DA3B76B9E1674FB"],
    [4, "02CC3A8897E6F4F6CCB6FD46631B1F5207B66C6DE9C7B55B2D1A23134A170AFDAC234EABA9A77CFF88C1F020B73724618C5687B362C430B248CD38647F848A1D"],
    [5, "ADD53B06543E584B5823F626996AEE50FE45ED15F20243A7165485ACB4AA76B4FFDA75CEDF6D8CDC95C332BD56F4B986B58BB17D1778BFC1B1A97545CDF4EC9F"],
    [6, "9E11BC59C24E73993C1484EC66358EF71DB74AEFD84E123F7800BA9C4853E02CFE701D9E6BB765A304F0DC34A4EE3BA82C410F0DA70E86BFBD90EA877C2D6104"],
  ];

  for (const [exp, expected] of patternExpectations) {
    test(`ptn(17**${exp} bytes), D=0x1F, 64 bytes`, () => {
      const msg = getPattern(pow17(exp));
      const out = turboshake256(msg, 0x1f, 64);
      expect(bytesToHex(out)).toBe(expected);
    });
  }

  const domainVectors: Array<[string, number, string]> = [
    ["FF FF FF", 0x01, "D21C6FBBF587FA2282F29AEA620175FB0257413AF78A0B1B2A87419CE031D933AE7A4D383327A8A17641A34F8A1D1003AD7DA6B72DBA84BB62FEF28F62F12424"],
    ["FF", 0x06, "738D7B4E37D18B7F22AD1B5313E357E3DD7D07056A26A303C433FA3533455280F4F5A7D4F700EFB437FE6D281405E07BE32A0A972E22E63ADC1B090DAEFE004B"],
    ["FF FF FF", 0x07, "18B3B5B7061C2E67C1753A00E6AD7ED7BA1C906CF93EFB7092EAF27FBEEBB755AE6E292493C110E48D260028492B8E09B5500612B8F2578985DED5357D00EC67"],
    ["FF FF FF FF FF FF FF", 0x0b, "BB36764951EC97E9D85F7EE9A67A7718FC005CF42556BE79CE12C0BDE50E5736D6632B0D0DFB202D1BBB8FFE3DD74CB00834FA756CB03471BAB13A1E2C16B3C0"],
    ["FF", 0x30, "F3FE12873D34BCBB2E608779D6B70E7F86BEC7E90BF113CBD4FDD0C4E2F4625E148DD7EE1A52776CF77F240514D9CCFC3B5DDAB8EE255E39EE389072962C111A"],
    ["FF FF FF", 0x7f, "ABE569C1F77EC340F02705E7D37C9AB7E155516E4A6A150021D70B6FAC0BB40C069F9A9828A0D575CD99F9BAE435AB1ACF7ED9110BA97CE0388D074BAC768776"],
  ];

  for (const [hex, domain, expected] of domainVectors) {
    test(`M=${hex.replace(/ /g, "")}, D=0x${domain.toString(16).toUpperCase()}, 64 bytes`, () => {
      const msg = hexToBytes(hex);
      const out = turboshake256(msg, domain, 64);
      expect(bytesToHex(out)).toBe(expected);
    });
  }
});

describe("Incremental TurboSHAKE", () => {
  test("chunked update matches one-shot TurboSHAKE128", () => {
    const message = getPattern(1024);
    const ctx = createTurboShake128(0x1f);
    let start = 0;
    for (const chunkSize of [0, 1, 7, 128, 169, 255, 464]) {
      const end = Math.min(message.length, start + chunkSize);
      if (end > start) {
        ctx.update(message.subarray(start, end));
      }
      start = end;
    }
    if (start < message.length) {
      ctx.update(message.subarray(start));
    }

    const out = ctx.squeeze(96);
    const expected = turboshake128(message, 0x1f, 96);
    expect(bytesToHex(out)).toBe(bytesToHex(expected));
  });

  test("byte-wise update matches one-shot TurboSHAKE256", () => {
    const message = getPattern(313);
    const ctx = createTurboShake256(0x1f);
    for (let i = 0; i < message.length; i++) {
      ctx.update(message.subarray(i, i + 1));
    }
    const out = ctx.squeeze(128);
    const expected = turboshake256(message, 0x1f, 128);
    expect(bytesToHex(out)).toBe(bytesToHex(expected));
  });

  test("multiple squeeze calls continue output stream", () => {
    const message = getPattern(200);
    const ctx = createTurboShake128(0x1f);
    ctx.update(message.subarray(0, 50));
    ctx.update(message.subarray(50));

    const first = ctx.squeeze(40);
    const second = ctx.squeeze(60);
    const combined = new Uint8Array(100);
    combined.set(first, 0);
    combined.set(second, 40);

    const expected = turboshake128(message, 0x1f, 100);
    expect(bytesToHex(combined)).toBe(bytesToHex(expected));
  });

  test("squeezeHex matches helper", () => {
    const ctx = createTurboShake128(0x1f);
    ctx.update(new Uint8Array([0x01, 0x02, 0x03]));
    const hex = ctx.squeezeHex(64);
    const expected = turboshake128Hex(new Uint8Array([0x01, 0x02, 0x03]), 0x1f, 64);
    expect(hex).toBe(expected);
  });

  test("update after squeeze throws", () => {
    const ctx = createTurboShake256(0x06);
    ctx.update(getPattern(10));
    ctx.squeeze(32);
    expect(() => ctx.update(getPattern(1))).toThrow("Cannot update after squeezing has begun");
  });

  test("squeezeInto writes into provided buffer", () => {
    const ctx = createTurboShake128(0x1f);
    ctx.update(getPattern(32));
    const target = new Uint8Array(64);
    ctx.squeezeInto(target, 16, 32);
    const expected = turboshake128(getPattern(32), 0x1f, 32);
    expect(bytesToHex(target.subarray(16, 48))).toBe(bytesToHex(expected));
  });

  test("empty message works without explicit update", () => {
    const ctx = createTurboShake256(0x1f);
    const out = ctx.squeeze(64);
    const expected = turboshake256(new Uint8Array(0), 0x1f, 64);
    expect(bytesToHex(out)).toBe(bytesToHex(expected));
  });
});
