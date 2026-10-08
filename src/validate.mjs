import { bech32, bech32m } from 'bech32';
import bs58check from 'bs58check';

function base58check(address) {
  try {
    return bs58check.decode(address);
  } catch {
    return null;
  }
}

// TRON: base58check of 21 bytes starting with 0x41.
function isTron(address) {
  const bytes = base58check(address);
  return bytes !== null && bytes.length === 21 && bytes[0] === 0x41;
}

function segwitProgram(address) {
  for (const encoding of [bech32, bech32m]) {
    try {
      const { prefix, words } = encoding.decode(address);
      const version = words[0];
      const program = encoding.fromWords(words.slice(1));
      return { prefix, version, program, encoding };
    } catch {
      // try the other encoding
    }
  }
  return null;
}

// Bitcoin mainnet: P2PKH or P2SH in base58check, or a SegWit address in bech32 (v0) or bech32m (v1+).
function isBitcoin(address) {
  const bytes = base58check(address);
  if (bytes !== null) return bytes.length === 21 && (bytes[0] === 0x00 || bytes[0] === 0x05);

  if (address !== address.toLowerCase() && address !== address.toUpperCase()) return false;
  const segwit = segwitProgram(address.toLowerCase());
  if (segwit === null || segwit.prefix !== 'bc') return false;
  const { version, program, encoding } = segwit;
  if (version === 0) return encoding === bech32 && (program.length === 20 || program.length === 32);
  return version <= 16 && encoding === bech32m && program.length >= 2 && program.length <= 40;
}

function crc16(bytes) {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

// TON user-friendly mainnet address: 36 bytes in base64 or base64url,
// flags + workchain + 32-byte hash + CRC16 of the first 34 bytes.
function isTon(address) {
  if (!/^[A-Za-z0-9+/_-]{48}$/.test(address)) return false;
  const bytes = Buffer.from(address.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (bytes.length !== 36) return false;
  const flags = bytes[0];
  const workchain = bytes[1];
  if (flags !== 0x11 && flags !== 0x51) return false;
  if (workchain !== 0x00 && workchain !== 0xff) return false;
  return crc16(bytes.subarray(0, 34)) === bytes.readUInt16BE(34);
}

const VALIDATORS = { tron: isTron, bitcoin: isBitcoin, ton: isTon };

export function isValidAddress(chain, address) {
  const validator = VALIDATORS[chain];
  return typeof validator === 'function' && typeof address === 'string' && validator(address);
}
