import { keccak_256 } from "@noble/hashes/sha3.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type AddressValidation =
  | { valid: true }
  | { valid: false; reason: string };

/** Compute the EIP-55 checksum for an address. */
function toChecksumAddress(address: string): string {
  const lower = address.toLowerCase().replace("0x", "");
  const hash = keccak_256(new TextEncoder().encode(lower));
  const hashHex = Array.from(hash).map((b) => b.toString(16).padStart(2, "0")).join("");
  let result = "0x";
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i]!;
    if (ch >= "0" && ch <= "9") {
      result += ch;
    } else {
      const hashByte = parseInt(hashHex[i]!, 16);
      result += hashByte >= 8 ? ch.toUpperCase() : ch;
    }
  }
  return result;
}

/** Validate an EVM address: format, zero-address, and EIP-55 checksum. */
export function validateEvmAddress(address: string): AddressValidation {
  if (!address) return { valid: false, reason: "Address required" };

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return { valid: false, reason: "Must be 0x + 40 hex chars" };
  }

  if (address.toLowerCase() === ZERO_ADDRESS) {
    return { valid: false, reason: "Cannot be zero address" };
  }

  // EIP-55 checksum check — only applies to mixed-case addresses.
  // All-lowercase or all-uppercase addresses are valid but uncheckable.
  const hasUpper = /[A-F]/.test(address);
  const hasLower = /[a-f]/.test(address);
  if (hasUpper && hasLower) {
    const expected = toChecksumAddress(address);
    if (address !== expected) {
      return { valid: false, reason: "Invalid checksum (address may be mistyped)" };
    }
  }

  return { valid: true };
}
