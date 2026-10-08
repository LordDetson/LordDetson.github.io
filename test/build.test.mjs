import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

import { ROOT, SAMPLE_WALLETS, buildSite, exists, loadContent } from './helpers.mjs';

function escape(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function texts(value, key = '') {
  if (typeof value === 'string') return ['lang', 'id', 'url', 'languageName'].includes(key) ? [] : [value];
  if (Array.isArray(value)) return value.flatMap((item) => texts(item));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => texts(v, k));
  return [];
}

test('the site is a single page without a separate Russian copy', async () => {
  const site = await buildSite([]);
  assert.match(site.html, /<html lang="en" data-lang="en"/);
  assert.equal(await exists(join(site.outDir, 'ru')), false);
});

test('the page carries every text in both languages', async () => {
  const { en, ru } = await loadContent();
  const site = await buildSite(SAMPLE_WALLETS);
  const missing = [...texts(en), ...texts(ru)]
    .filter((text) => !text.includes('{'))
    .filter((text) => !site.html.includes(escape(text)));
  assert.deepEqual(missing, []);
});

test('every English text has its Russian pair', async () => {
  const site = await buildSite(SAMPLE_WALLETS);
  const count = (lang) => site.html.match(new RegExp(` lang="${lang}"`, 'g')).length;
  assert.equal(count('ru'), count('en') - 1); // the <html> element itself is lang="en"
});

test('the page has a RU / EN switch', async () => {
  const site = await buildSite([]);
  assert.match(site.html, /<button class="lang-switch" type="button" data-set-lang="ru"[^>]*>RU<\/button>/);
  assert.match(site.html, /<button class="lang-switch" type="button" data-set-lang="en"[^>]*>EN<\/button>/);
});

test('the language script runs in the head before the page is drawn', async () => {
  const site = await buildSite([]);
  const head = site.html.slice(0, site.html.indexOf('</head>'));
  assert.match(head, /<script src="\/lang\.js"><\/script>/);
  assert.ok(await exists(join(site.outDir, 'lang.js')));
});

test('the page knows the title in both languages', async () => {
  const { en, ru } = await loadContent();
  const site = await buildSite([]);
  assert.ok(site.html.includes(`data-title-en="${escape(en.title)}"`));
  assert.ok(site.html.includes(`data-title-ru="${escape(ru.title)}"`));
  assert.ok(site.html.includes(`<title>${escape(en.title)}</title>`));
});

test('the stylesheet hides the language that is not chosen', async () => {
  const css = await readFile(new URL('assets/style.css', ROOT), 'utf8');
  assert.match(css, /html\[data-lang="en"\] \[lang="ru"\]/);
  assert.match(css, /html\[data-lang="ru"\] \[lang="en"\]/);
});

test('the page has no inline scripts or event handlers', async () => {
  const site = await buildSite(SAMPLE_WALLETS);
  for (const [tag] of site.html.matchAll(/<script\b[^>]*>/g)) assert.match(tag, /\bsrc="/, tag);
  assert.doesNotMatch(site.html, /<script\b[^>]*>[^<]+<\/script>/);
  assert.doesNotMatch(site.html, /\son[a-z]+="/);
});

test('the page links every project', async () => {
  const { en } = await loadContent();
  const site = await buildSite([]);
  for (const project of en.projects) assert.ok(site.html.includes(`href="${project.url}"`), project.id);
});

test('Boosty comes before the crypto wallets', async () => {
  const site = await buildSite(SAMPLE_WALLETS);
  const boosty = site.html.indexOf('id="boosty"');
  const crypto = site.html.indexOf('id="crypto"');
  assert.ok(boosty > 0, 'Boosty section');
  assert.ok(crypto > boosty, 'crypto section after Boosty');
});

test('without wallets there is no crypto section', async () => {
  const site = await buildSite([]);
  assert.doesNotMatch(site.html, /id="crypto"/);
});
