import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { ROOT } from './helpers.mjs';

const css = await readFile(new URL('assets/style.css', ROOT), 'utf8');

// All declarations of the rules whose selector list is exactly `selector`.
function rules(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return [...css.matchAll(new RegExp(`(?:^|\\}|\\*/)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[1]);
}

test('the hidden language stays hidden even inside the copied state of a button', () => {
  const body = rules('html[data-lang="en"] [lang="ru"],\nhtml[data-lang="ru"] [lang="en"]');
  assert.equal(body.length, 1);
  assert.match(body[0], /display:\s*none\s*!important/);
});

test('the brand name is hidden only visually on phones, so the link keeps its name', () => {
  for (const body of rules('.brand-name')) assert.doesNotMatch(body, /display:\s*none/);
  assert.equal(rules('.sr-only').length, 1);
  assert.match(rules('.sr-only')[0], /clip:\s*rect\(0,? 0,? 0,? 0\)/);
});

test('the sticky top bar never covers an anchor target or the focused element', () => {
  const html = rules('html').join(' ');
  assert.match(html, /scroll-padding-top:\s*\d+px/);
  // a second offset on sections would add up with the padding
  for (const body of rules('.section')) assert.doesNotMatch(body, /scroll-margin-top/);
});

test('the focus ring on the orange Boosty card is dark', () => {
  const body = rules('.boosty :focus-visible');
  assert.equal(body.length, 1);
  assert.match(body[0], /outline-color:\s*var\(--accent-ink\)/);
});

test('the highlighted ends of a wallet address never break across lines', () => {
  assert.match(rules('.address b').join(' '), /white-space:\s*nowrap/);
});

test('coin badges follow the forced colours instead of a fixed white', () => {
  assert.match(rules('.coin svg').join(' '), /stroke:\s*currentColor/);
});

test('the Boosty chips keep a gap above the main button', () => {
  const margin = rules('.boosty-chips').join(' ').match(/margin:\s*0 0 (\d+)px/);
  assert.ok(margin && Number(margin[1]) >= 16, 'chips margin-bottom');
});
