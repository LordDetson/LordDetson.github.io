import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build } from '../src/build.mjs';

export const ROOT = new URL('..', import.meta.url);

// Real public addresses with valid checksums, used only as test fixtures.
export const SAMPLE_ADDRESSES = {
  tron: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  bitcoinLegacy: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  bitcoinSegwit: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
  bitcoinTaproot: 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0',
  ton: 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N',
};

export const SAMPLE_WALLETS = [
  { id: 'usdt-trc20', chain: 'tron', coin: 'USDT', network: 'TRON (TRC-20)', address: SAMPLE_ADDRESSES.tron },
  { id: 'ton', chain: 'ton', coin: 'TON', network: 'TON', address: SAMPLE_ADDRESSES.ton },
  { id: 'btc', chain: 'bitcoin', coin: 'BTC', network: 'Bitcoin', address: SAMPLE_ADDRESSES.bitcoinSegwit },
];

// Replaces one character in the middle with another one from the same alphabet,
// the way a typo or a tampered address would look.
export function corrupt(address) {
  const i = Math.floor(address.length / 2);
  const replacement = address[i] === 'q' ? 'p' : 'q';
  return address.slice(0, i) + replacement + address.slice(i + 1);
}

export async function loadContent() {
  const read = async (name) => JSON.parse(await readFile(new URL(`content/${name}.json`, ROOT), 'utf8'));
  return { en: await read('en'), ru: await read('ru') };
}

export async function buildSite(wallets) {
  const outDir = await mkdtemp(join(tmpdir(), 'support-page-'));
  await build({ content: await loadContent(), wallets, outDir });
  const page = (path) => readFile(join(outDir, path), 'utf8');
  return { outDir, en: await page('index.html'), ru: await page('ru/index.html') };
}
