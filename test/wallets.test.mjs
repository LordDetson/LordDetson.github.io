import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

import jsQR from 'jsqr';
import { PNG } from 'pngjs';

import { build } from '../src/build.mjs';
import { isValidAddress } from '../src/validate.mjs';
import { SAMPLE_ADDRESSES, SAMPLE_WALLETS, buildSite, corrupt, loadContent } from './helpers.mjs';

const VALID = [
  ['tron', SAMPLE_ADDRESSES.tron],
  ['bitcoin', SAMPLE_ADDRESSES.bitcoinLegacy],
  ['bitcoin', SAMPLE_ADDRESSES.bitcoinSegwit],
  ['bitcoin', SAMPLE_ADDRESSES.bitcoinTaproot],
  ['ton', SAMPLE_ADDRESSES.ton],
];

for (const [chain, address] of VALID) {
  test(`accepts a valid ${chain} address ${address}`, () => {
    assert.equal(isValidAddress(chain, address), true);
  });

  test(`rejects a ${chain} address with a typo in ${address}`, () => {
    assert.equal(isValidAddress(chain, corrupt(address)), false);
  });
}

test('rejects an address of another chain', () => {
  assert.equal(isValidAddress('tron', SAMPLE_ADDRESSES.bitcoinLegacy), false);
  assert.equal(isValidAddress('bitcoin', SAMPLE_ADDRESSES.tron), false);
  assert.equal(isValidAddress('ton', SAMPLE_ADDRESSES.tron), false);
});

test('rejects an unknown chain', () => {
  assert.equal(isValidAddress('dogecoin', SAMPLE_ADDRESSES.tron), false);
});

test('the build refuses a wallet with an invalid address', async () => {
  const wallets = [{ ...SAMPLE_WALLETS[0], address: corrupt(SAMPLE_WALLETS[0].address) }];
  await assert.rejects(build({ content: await loadContent(), wallets, outDir: 'unused' }), /usdt-trc20/);
});

function wallets(html) {
  return [...html.matchAll(/<section class="wallet" data-wallet="([^"]+)">([\s\S]*?)<\/section>/g)].map(
    ([, id, body]) => ({
      id,
      address: body.match(/<code class="address">([^<]+)<\/code>/)?.[1],
      qr: body.match(/<img class="qr" src="\/(qr\/[^"]+\.png)"/)?.[1],
    }),
  );
}

test('every wallet shows its address and a QR code of exactly that address', async () => {
  const site = await buildSite(SAMPLE_WALLETS);
  const shown = wallets(site.html);
  assert.deepEqual(shown.map((w) => w.id), SAMPLE_WALLETS.map((w) => w.id));
  for (const wallet of shown) {
    const expected = SAMPLE_WALLETS.find((w) => w.id === wallet.id).address;
    assert.equal(wallet.address, expected);
    const png = PNG.sync.read(await readFile(join(site.outDir, wallet.qr)));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    assert.equal(decoded?.data, expected, `QR of ${wallet.id}`);
  }
});

test('every wallet warns which network to use, in both languages', async () => {
  const site = await buildSite(SAMPLE_WALLETS);
  for (const wallet of SAMPLE_WALLETS) {
    const network = wallet.network.replace(/[()]/g, '\\$&');
    assert.match(site.html, new RegExp(`Send only ${wallet.coin} on the ${network} network`));
    assert.match(site.html, new RegExp(`Отправляйте только ${wallet.coin} в сети ${network}`));
  }
});
