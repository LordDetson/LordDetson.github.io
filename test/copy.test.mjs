import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

import { ROOT } from './helpers.mjs';

const ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// Runs assets/copy.js against one fake wallet card.
async function runCopyScript({ clipboard = 'ok', lang = 'ru' } = {}) {
  const code = await readFile(new URL('assets/copy.js', ROOT), 'utf8');
  const written = [];
  const status = { textContent: '' };
  const address = { tag: 'code' };
  const classes = new Set();
  let click;
  const button = {
    dataset: { address: ADDRESS },
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
    addEventListener: (type, fn) => (click = fn),
    closest: () => wallet,
  };
  const wallet = { querySelector: (selector) => ({ '.address': address, '[role="status"]': status })[selector] };
  let selected = null;
  const context = {
    document: {
      documentElement: { lang },
      querySelectorAll: (selector) => (selector === 'button.copy' ? [button] : []),
    },
    navigator: {
      clipboard: clipboard === 'none'
        ? undefined
        : { writeText: (text) => (clipboard === 'ok' ? (written.push(text), Promise.resolve()) : Promise.reject(new Error('denied'))) },
    },
    window: { getSelection: () => ({ selectAllChildren: (node) => (selected = node) }) },
    setTimeout: () => {},
  };
  vm.runInNewContext(code, context);
  await click();
  return { written, classes, status, selected, address };
}

test('the copy button puts exactly the wallet address on the clipboard', async () => {
  const page = await runCopyScript();
  assert.deepEqual(page.written, [ADDRESS]);
  assert.ok(page.classes.has('copied'));
});

test('a screen reader hears that the address was copied, in the page language', async () => {
  assert.equal((await runCopyScript({ lang: 'ru' })).status.textContent, 'Адрес скопирован');
  assert.equal((await runCopyScript({ lang: 'en' })).status.textContent, 'Address copied');
});

test('without the clipboard the address is selected and the visitor is told to copy it', async () => {
  for (const clipboard of ['denied', 'none']) {
    const page = await runCopyScript({ clipboard, lang: 'en' });
    assert.equal(page.selected, page.address, clipboard);
    assert.equal(page.status.textContent, 'Address selected, press Ctrl+C to copy', clipboard);
    assert.ok(!page.classes.has('copied'), clipboard);
  }
});
